const express = require('express');
const Tooth = require('../models/tooth');
const asyncHandler = require('../async-handler');

const router = express.Router();

/** All 64 tooth records (32 teeth x 2 sides) of a patient: GET /api/teeth?patientId=PAT001 */
router.get('/', asyncHandler(async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  res.json(await Tooth.find({ patientId }).lean());
}));

/** Create the empty chart of a new patient. Body: { teeth: [...] } */
router.post('/initialize', asyncHandler(async (req, res) => {
  const { teeth } = req.body;
  if (!Array.isArray(teeth)) return res.status(400).json({ error: 'teeth must be an array' });
  if (teeth.some(tooth => !tooth.number || !tooth.patientId)) {
    return res.status(400).json({ error: 'All teeth must have number and patientId' });
  }
  await Tooth.insertMany(teeth);
  res.status(201).json({ success: true, count: teeth.length });
}));

/** Save one tooth after a manual edit on the chart. Body: the tooth, including patientId. */
router.put('/:number', asyncHandler(async (req, res) => {
  // Database-managed fields are never taken from the client
  const { _id, __v, id, createdAt, updatedAt, ...changes } = req.body;
  if (!changes.patientId) return res.status(400).json({ error: 'patientId is required' });

  const tooth = await Tooth.findOneAndUpdate(
    { number: req.params.number, patientId: changes.patientId },
    { ...changes, number: req.params.number },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(tooth);
}));

module.exports = router;
