const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const { startLiveUpdates } = require('./live-updates');

async function main() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const server = http.createServer(app);
  startLiveUpdates(server);
  server.listen(config.port, () => console.log(`Backend running on http://localhost:${config.port}`));

  process.on('SIGTERM', () => {
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  });
}

main().catch(err => {
  console.error('Failed to start the backend:', err.message);
  process.exit(1);
});
