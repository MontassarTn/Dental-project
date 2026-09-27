# Speech service

Voice dictation (English) for the periodontal chart. The dentist speaks ("tooth 16, probing depth 3, 2, 4")
and the chart updates live.

```
browser mic ──audio──▶ /transcribe ──▶ AssemblyAI (speech-to-text)
                                            │ finished sentence
                                            ▼
                                        Groq LLM (openai/gpt-oss-120b)
                                            │ 1. rephrase  2. extract JSON per tooth
                                            ▼
                                        MongoDB "tooths" ──▶ backend ──▶ chart updates in browser
```

## Layout

| File | What it does |
|---|---|
| `app/main.py` | FastAPI app: `/transcribe` WebSocket and `/memory` endpoints |
| `app/transcription.py` | Streams audio to AssemblyAI and returns transcripts (dental vocabulary lives here) |
| `app/llm.py` | Sends each finished sentence to Groq and saves the extracted findings |
| `app/memory.py` | Dictation memory per patient, stored in MongoDB (finish a sentence later, even after a restart) |
| `app/replies.py` | Builds the spoken confirmation ("Done. Tooth 11: marked as missing.") from what was saved |
| `app/prompts.py` | The LLM prompts (rephrase with context, then JSON extraction) |
| `app/teeth_repository.py` | Applies a finding to a tooth document in MongoDB |
| `app/database.py` | The MongoDB connection (`dentalChart` database, shared with the backend) |
| `app/config.py` | Reads settings from `.env` |

## Setup

1. Copy `.env.example` to `.env` and fill in the AssemblyAI key, Groq key and MongoDB URI.
2. Install and run (Python 3.11+):

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 5000
```

The frontend expects the service on `http://localhost:5000`. For deployment on Render, see the
`render.yaml` file at the repository root.

## API

- `WS /transcribe?segment=<patientId>` - English dictation. Send 16 kHz, 16-bit mono PCM audio as binary
  messages. You receive:
  - `{"type": "transcript", "final": bool, "text": str}` - live transcript while speaking
  - `{"type": "reply", "text": str, "speak": bool}` - one per finished sentence, e.g.
    `"Done. Tooth 11: marked as missing."` (empty when nothing was charted). The frontend reads it aloud.
- `GET /health` - `{"status": "ok"}`, health check.
- `GET /memory/{patientId}` - what the assistant remembers for this patient: `{"turns": [{"said", "reply"}]}`.
  Kept across recordings, so "Tooth 12 and 13" ... (stop, start) ... "are missing" marks both teeth missing.
  Stored in the `dictations` collection, so it survives restarts and redeploys. The latest 12
  sentences per patient are used as context and returned here.
- `DELETE /memory/{patientId}` - forget it (the transcript "Clear" button).
