const express = require('express');
const cors = require('cors');
const patientRoutes = require('./routes/patients');
const teethRoutes = require('./routes/teeth');

const app = express();

app.use(cors());
app.use(express.json());

// Used by the hosting health check and by the frontend to know the server is awake
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/patients', patientRoutes);
app.use('/api/teeth', teethRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ error: 'Already exists' });
  if (['ValidationError', 'CastError'].includes(err.name)) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
