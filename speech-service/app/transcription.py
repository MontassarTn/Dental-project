"""Real-time English speech-to-text with AssemblyAI streaming (Universal-3 Pro).

The browser streams 16 kHz, 16-bit mono PCM to us; we forward it to AssemblyAI and send
every transcript back to the browser as {"type": "transcript", "final": bool, "text": str}.
"""
import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from urllib.parse import urlencode

import websockets
from fastapi import WebSocket, WebSocketDisconnect

from app.config import ASSEMBLYAI_API_KEY

log = logging.getLogger(__name__)

ASSEMBLYAI_URL = "wss://streaming.assemblyai.com/v3/ws"

# Dental vocabulary AssemblyAI should expect (max 100 terms, 50 chars each)
KEYTERMS = [
    "tooth", "teeth", "missing tooth", "implant", "mobility",
    "furcation", "plaque", "dental plaque", "bleeding", "bleeding on probing",
    "gingival margin", "probing depth", "mesial", "distal",
    "buccal", "lingual", "palatal",
]


def _assemblyai_url() -> str:
    params = {
        "speech_model": "universal-3-6-pro",
        "encoding": "pcm_s16le",
        "sample_rate": 16000,
        "language_codes": json.dumps(["en"]),
        "keyterms_prompt": json.dumps(KEYTERMS),
        # Give dictated number sequences ("3, 2, 4") time before the turn ends
        "min_turn_silence": 400,
    }
    return f"{ASSEMBLYAI_URL}?{urlencode(params)}"


async def relay(browser: WebSocket, on_final: Callable[[str], Awaitable[None]]) -> None:
    """Stream audio from the browser to AssemblyAI until the browser disconnects.

    `on_final` is awaited with the text of every completed turn (sentence).
    """
    assembly = await websockets.connect(
        _assemblyai_url(),
        additional_headers={"Authorization": ASSEMBLYAI_API_KEY},
    )

    async def receive_transcripts():
        try:
            async for raw in assembly:
                message = json.loads(raw)
                if message.get("type") == "Termination":
                    log.info("AssemblyAI session ended (%ss of audio)", message.get("audio_duration_seconds"))
                if message.get("type") != "Turn":
                    continue

                text = message.get("transcript", "")
                # A turn is complete only once it is both ended and formatted
                is_final = bool(message.get("end_of_turn")) and message.get("turn_is_formatted", True)
                try:
                    await browser.send_json({"type": "transcript", "final": is_final, "text": text})
                except Exception:
                    pass  # browser already gone; still process the last turn below
                if is_final and text.strip():
                    log.info("Transcript: %s", text)
                    await on_final(text.strip())
        except websockets.ConnectionClosed as closed:
            if closed.rcvd and closed.rcvd.code != 1000:
                log.error("AssemblyAI closed the stream: %s %s", closed.rcvd.code, closed.rcvd.reason)

    receiver = asyncio.create_task(receive_transcripts())

    try:
        while True:
            await assembly.send(await browser.receive_bytes())
    except WebSocketDisconnect:
        log.info("Browser disconnected")
    except websockets.ConnectionClosed:
        pass  # reported by receive_transcripts
    finally:
        # Ask AssemblyAI to flush the last turn, then wait for it before closing
        try:
            await assembly.send(json.dumps({"type": "Terminate"}))
            await asyncio.wait_for(receiver, timeout=10)
        except (websockets.ConnectionClosed, asyncio.TimeoutError):
            pass
        await assembly.close()
