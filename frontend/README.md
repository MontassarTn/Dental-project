# Frontend

Angular 17 app for voice-driven periodontal charting. The dentist opens a patient, dictates
findings, and the chart updates live while the app reads back a short confirmation.

## Run

```bash
npm install
npm start          # http://localhost:4200
```

It expects the backend on `http://localhost:3000` and the speech service on
`http://localhost:5000`. Change these in `src/environments/` (`environment.development.ts` is
used by `npm start`, `environment.ts` by production builds).

```bash
npm run build      # production build -> dist/frontend/browser
npm test           # unit tests (headless Chrome: npm test -- --watch=false --browsers=ChromeHeadless)
```

## Structure

```
src/
├── environments/            # backend + speech service URLs
└── app/
    ├── patient/             # start page: open or create a patient
    ├── dental-chart/        # chart page: patient details, voice card, full chart, zoom
    ├── tooth-display/       # one chart column: tooth image + mobility, implant, furcation,
    │                        #   bleeding, plaque, gingival margin, probing depth
    ├── voice-dictation/     # microphone -> speech service; live transcript + spoken replies
    ├── server-status/       # "Starting the servers…" banner while free hosting wakes up
    ├── services/
    │   ├── patient.service.ts     # patient REST calls, current patient
    │   └── tooth-data.service.ts  # teeth REST calls + live updates over WebSocket
    └── models/              # Patient, Tooth
```

Tooth numbers use FDI notation (11-48). Each tooth has two chart columns: `16` (buccal side)
and `16_L` (palatal side for upper teeth, lingual side for lower teeth).

`src/assets/worklets/pcm-worker.js` converts microphone audio to 16 kHz, 16-bit PCM for the
speech service.

## Deploying

`environment.ts` points at the services deployed on Render (see `render.yaml` at the repository
root). Browsers only allow microphone access on `https://` pages (or `localhost`), so deployed
URLs must use `https://`.
