# Backend

Node.js / Express API for the periodontal chart, with live updates over WebSocket.
Data lives in MongoDB (`patients` and `tooths` collections in the `dentalChart` database).

## Run

1. Copy `.env.example` to `.env` and set `MONGODB_URI` (a MongoDB Atlas replica set; live updates
   use change streams).
2. Install and start (Node 18+):

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # same, restarts on file changes
```

## Layout

| File | What it does |
|---|---|
| `src/server.js` | Entry point: connects to MongoDB, starts HTTP + WebSocket server |
| `src/app.js` | Express app: middleware, routes, error handling |
| `src/routes/patients.js` | Patient endpoints |
| `src/routes/teeth.js` | Tooth endpoints |
| `src/live-updates.js` | WebSocket server; pushes tooth changes from a MongoDB change stream |
| `src/models/` | Mongoose schemas for patients and teeth |
| `src/config.js` | Reads settings from `.env` (or the host's environment variables) |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | `{ status: "ok" }` - health check |
| `GET` | `/api/patients/:patientId` | Get a patient (404 if unknown) |
| `POST` | `/api/patients` | Create a patient: `{ firstName, lastName, patientId }` (409 if it exists) |
| `GET` | `/api/teeth?patientId=` | All 64 tooth records of a patient |
| `POST` | `/api/teeth/initialize` | Create a new patient's empty chart: `{ teeth: [...] }` |
| `PUT` | `/api/teeth/:number` | Save one tooth after a manual edit (body includes `patientId`) |

Tooth numbers use FDI notation (`11`-`48`); `16_L` is the palatal/lingual side of tooth 16.

**Live updates:** connect to `ws://localhost:3000?patientId=PAT001`. You receive
`{ type: "INITIAL_DATA", data: [...] }`, then `{ type: "DB_UPDATE", operation, data }` for every change
to that patient's teeth - including those written by the speech service during voice dictation.
