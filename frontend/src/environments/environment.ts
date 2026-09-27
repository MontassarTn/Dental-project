// Production settings (used by `ng build`): the services deployed on Render (see render.yaml).
// WebSocket URLs are derived from them (http -> ws, https -> wss).
export const environment = {
  /** Backend: REST API + live tooth updates */
  backendUrl: 'https://dental-chart-voice-api.onrender.com',
  /** Speech service: voice dictation */
  speechServiceUrl: 'https://dental-chart-voice-speech.onrender.com',
};
