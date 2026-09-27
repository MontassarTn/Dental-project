"""HTTP/WebSocket entry point. Run with: uvicorn app.main:app --port 5000"""
import asyncio
import logging
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app import memory
from app.llm import process_transcript
from app.replies import build_reply, error_reply
from app.transcription import relay

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(memory.create_indexes)
    yield


app = FastAPI(title="Dental Project speech service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptQueue:
    """Runs one session's transcripts through the LLM one at a time, in the order spoken,
    and sends one {"type": "reply"} message back per transcript."""

    def __init__(self, patient_id: str | None, send: Callable[[dict], Awaitable[None]]):
        self.patient_id = patient_id
        self._send = send
        self._queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._worker = asyncio.create_task(self._run())

    async def add(self, transcript: str) -> None:
        await self._queue.put(transcript)

    async def close(self) -> None:
        """Finish the transcripts still waiting, then stop."""
        await self._queue.put(None)
        await self._worker

    async def _run(self) -> None:
        patient_key = self.patient_id or ""
        while (transcript := await self._queue.get()) is not None:
            extracted = ""
            try:
                history = await asyncio.to_thread(memory.chat_history, patient_key)
                extracted, results = await process_transcript(transcript, history, self.patient_id)
                reply = build_reply(results)
            except Exception:
                log.exception("LLM processing failed for: %s", transcript)
                reply = error_reply()
            # Remembered even when nothing was charted, so the sentence can be completed later
            try:
                turn = memory.Turn(said=transcript, extracted=extracted, reply=reply)
                await asyncio.to_thread(memory.remember, patient_key, turn)
            except Exception:
                log.exception("Could not save the dictation memory")
            log.info("Reply: %s", reply or "(nothing charted)")
            await self._send({"type": "reply", "text": reply, "speak": bool(reply)})


@app.websocket("/transcribe")
async def transcribe(websocket: WebSocket):
    """Live dictation (English). Query param: segment=<patient id>.

    Browser -> server: binary 16 kHz 16-bit mono PCM audio.
    Server -> browser: {"type": "transcript", "final": bool, "text": str} while speaking, then
                       {"type": "reply", "text": str, "speak": bool} once each sentence is charted.
    """
    patient_id = websocket.query_params.get("segment")
    log.info("Dictation started - patient %s", patient_id)
    await websocket.accept()

    async def send(message: dict) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            pass  # browser already disconnected

    queue = TranscriptQueue(patient_id, send)
    try:
        await relay(websocket, on_final=queue.add)
    except Exception:
        log.exception("Transcription failed")
        try:
            await websocket.close(code=1011)
        except RuntimeError:
            pass  # already closed
    finally:
        await queue.close()
        log.info("Dictation ended - patient %s", patient_id)


@app.get("/health")
async def health():
    """Used by the hosting health check and by the frontend to know the service is awake."""
    return {"status": "ok"}


@app.get("/memory/{patient_id}")
async def get_memory(patient_id: str):
    """What the assistant remembers for this patient (shown as the transcript history)."""
    turns = await asyncio.to_thread(memory.turns, patient_id)
    return {"turns": [{"said": t.said, "reply": t.reply} for t in turns]}


@app.delete("/memory/{patient_id}")
async def clear_memory(patient_id: str):
    """Forget this patient's dictation context (the transcript "Clear" button)."""
    await asyncio.to_thread(memory.forget, patient_id)
    return {"status": "memory cleared"}
