const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI - copy backend/.env.example to backend/.env and fill it in');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongodbUri: process.env.MONGODB_URI,
};
