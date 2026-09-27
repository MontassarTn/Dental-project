const WebSocket = require('ws');
const Tooth = require('./models/tooth');

/**
 * Live chart updates over WebSocket.
 *
 * A browser connects with ?patientId=PAT001, receives that patient's teeth
 * ({ type: 'INITIAL_DATA', data }), then every change to them
 * ({ type: 'DB_UPDATE', operation, data }) - from manual edits or from voice dictation,
 * which the speech service writes straight to MongoDB. Changes come from a MongoDB change stream.
 */
function startLiveUpdates(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    const patientId = new URL(req.url, 'http://localhost').searchParams.get('patientId');
    if (!patientId) {
      ws.close(1008, 'patientId is required');
      return;
    }
    ws.patientId = patientId;
    ws.on('error', err => console.error('WebSocket error:', err.message));

    try {
      send(ws, { type: 'INITIAL_DATA', data: await Tooth.find({ patientId }).lean() });
    } catch (err) {
      console.error(`Could not load teeth for patient ${patientId}:`, err.message);
      send(ws, { type: 'ERROR', message: 'Failed to load initial data' });
    }
  });

  watchTeeth(change => {
    const tooth = change.fullDocument;
    if (!tooth) return; // deletes carry no patientId (the app never deletes teeth)

    const message = { type: 'DB_UPDATE', operation: change.operationType, data: tooth };
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && client.patientId === tooth.patientId) {
        send(client, message);
      }
    }
  });
}

/** Calls onChange for every change to the teeth collection; restarts the stream if it fails. */
function watchTeeth(onChange) {
  const stream = Tooth.watch([], { fullDocument: 'updateLookup' });
  let restarting = false;

  const restart = reason => {
    if (restarting) return;
    restarting = true;
    console.error(`Change stream stopped (${reason}), restarting in 5s`);
    stream.close().catch(() => {});
    setTimeout(() => watchTeeth(onChange), 5000);
  };

  stream.on('change', onChange);
  stream.on('error', err => restart(err.message));
  stream.on('close', () => restart('closed'));
}

function send(ws, message) {
  ws.send(JSON.stringify(message));
}

module.exports = { startLiveUpdates };
