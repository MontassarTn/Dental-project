# Dental Chart: voice-driven periodontal charting

The dentist speaks, the periodontal chart fills itself in, and the assistant confirms out loud
what it saved.

**Live demo:** https://dental-chart-voice.onrender.com
(free hosting: the first visit can take up to a minute while the servers wake up)

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon)
on the **Realtime Speech-to-Text API** path: AssemblyAI real-time speech-to-text, with our own
LLM (Groq) and our own voice output.

## The problem

When a dentist checks a patient's mouth, every tooth has findings to record: missing teeth,
implants, mobility, bleeding, plaque, gum level and pocket depth at several points around the
tooth. That is hundreds of values in one exam, and today they end up on paper. The dentist's
hands are busy with the probe and the mirror, so they keep stopping the exam to write, and the
paper chart still has to be typed into the computer afterwards.

## The solution

The dentist just speaks while checking the mouth ("Tooth 16, probing depth 3, 2, 4",
"Teeth 12 and 13 are missing") and the app saves everything for them. The chart fills in live
and the assistant confirms out loud what it recorded, so the dentist never has to put the
instruments down, look away from the patient, or write anything on paper.

## What it does

- **Speak naturally.** "Tooth 16, probing depth 3, 2, 4." / "Teeth 12 and 13 are missing." /
  "Tooth 24, bleeding mesial and distal."
- **The chart updates live** while you talk, on every screen showing that patient.
- **The assistant answers out loud**: "Done. Tooth 16: probing depth 3, 2, 4." or
  "I couldn't find tooth 19." The answer is built from what was actually saved in the database,
  never from free LLM text, so it only confirms what really happened.
- **It remembers the conversation.** Say "Tooth 12 and 13", stop, and later say "are missing":
  both teeth are marked missing. The memory is kept per patient and shown as the on-screen transcript.
- **Live transcript** of what it heard, next to each reply.
- Everything can also be edited by hand on the chart.

## How it works

```
                        audio (16 kHz PCM)                     ┌─▶ AssemblyAI real-time speech-to-text
  Browser (Angular) ──── WebSocket ──────▶ Speech service ─────┼─▶ Groq LLM (openai/gpt-oss-120b)
   │  ▲  ▲                                  (FastAPI)          └─▶ MongoDB Atlas: save findings
   │  │  └── live transcript + reply ─────────┘                         │
   │  │      (spoken by the browser)                                    │ change stream
   │  └───── live chart updates ── WebSocket ── Backend (Express) ◀─────┘
   └──────── patients & teeth ──── REST ─────▶ Backend
```

1. The browser streams the microphone to the speech service, which relays it to AssemblyAI.
2. Each finished sentence goes to the LLM in two steps: rephrase it into a complete sentence using
   the patient's conversation so far, then extract one JSON object per tooth.
3. The findings are saved to MongoDB. The backend sees the change and pushes it to the chart.
4. The speech service sends back a confirmation, and the browser reads it aloud.

## How we use AssemblyAI

- **Real-time streaming** (Universal-3 Pro, WebSocket API v3): partial transcripts appear on
  screen while the dentist speaks.
- **Dental vocabulary** through `keyterms_prompt` (furcation, gingival margin, probing depth,
  mesial, distal, lingual…), so clinical words are recognized correctly.
- **Turn detection** decides when a sentence is finished: we act only on turns that are ended
  and formatted, one LLM call per sentence. `min_turn_silence` is tuned so dictated number
  series ("3, 2, 4") are not cut in half.
- **Clean shutdown:** when recording stops we send `Terminate`, so the last sentence is still processed.
- The microphone sends silence while the assistant is speaking, so it never transcribes its own voice.

The code is in [`speech-service/app/transcription.py`](speech-service/app/transcription.py).

## Tech stack

| Part | Technology |
|---|---|
| Speech-to-text | AssemblyAI real-time streaming (Universal-3 Pro) |
| Language model | Groq, `openai/gpt-oss-120b` |
| Voice output | Browser speech synthesis |
| Frontend | Angular 17 |
| Backend | Node.js, Express, WebSocket, Mongoose |
| Speech service | Python, FastAPI |
| Database | MongoDB Atlas (change streams for live updates) |
| Hosting | Render (free plan), see [`render.yaml`](render.yaml) |

## Run it locally

You need Node.js 20+, Python 3.11+, a MongoDB Atlas cluster (the free tier works), an
[AssemblyAI API key](https://www.assemblyai.com/app/api-keys) and a
[Groq API key](https://console.groq.com/keys).

```bash
# 1. Backend - http://localhost:3000
cd backend
cp .env.example .env          # set MONGODB_URI
npm install
npm start

# 2. Speech service - http://localhost:5000
cd speech-service
cp .env.example .env          # set ASSEMBLYAI_API_KEY, GROQ_API_KEY, MONGODB_URI
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
.venv/Scripts/uvicorn app.main:app --port 5000    # macOS/Linux: .venv/bin/uvicorn

# 3. Frontend - http://localhost:4200
cd frontend
npm install
npm start
```

Open http://localhost:4200, create a patient, click **Start Voice Command** and speak.

## Deploy (Render, free)

1. In the [Render dashboard](https://dashboard.render.com): **New → Blueprint**, then select this repository.
2. Enter the secrets it asks for: `MONGODB_URI` (twice), `ASSEMBLYAI_API_KEY`, `GROQ_API_KEY`.
3. In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0` (Render's addresses change).

This creates the frontend, the backend and the speech service over HTTPS, which browsers require
for microphone access.

## Project structure

```
backend/          Express API + live chart updates over WebSocket   (see backend/README.md)
frontend/         Angular app: patient page, chart, voice dictation  (see frontend/README.md)
speech-service/   FastAPI: AssemblyAI streaming, Groq LLM, memory    (see speech-service/README.md)
render.yaml       One-click deployment on Render
```

## License

[MIT](LICENSE)
