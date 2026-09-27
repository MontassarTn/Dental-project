const express = require('express');
const Patient = require('../models/patient');
const asyncHandler = require('../async-handler');

const router = express.Router();

router.get('/:patientId', asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { firstName, lastName, patientId } = req.body;
  if (!firstName || !lastName || !patientId) {
    return res.status(400).json({ error: 'firstName, lastName and patientId are required' });
  }
  if (await Patient.exists({ patientId })) {
    return res.status(409).json({ error: 'Patient already exists' });
  }
  const patient = await Patient.create({ firstName, lastName, patientId });
  res.status(201).json(patient);
}));

module.exports = router;
