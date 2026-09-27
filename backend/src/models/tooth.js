const mongoose = require('mongoose');

const range = (label, min, max) => ({
  type: Number,
  default: 0,
  min: [min, `${label} must be at least ${min}`],
  max: [max, `${label} cannot exceed ${max}`],
});

const siteFlags = () => ({
  mesial: { type: Boolean, default: false },
  mid: { type: Boolean, default: false },
  distal: { type: Boolean, default: false },
});

const siteMeasurements = (label, max) => ({
  mesial: range(label, 0, max),
  mid: range(label, 0, max),
  distal: range(label, 0, max),
});

/**
 * One side of one tooth on the chart. `number` is the FDI tooth number ("16");
 * "16_L" is the palatal/lingual side of the same tooth.
 * Written by the frontend (manual edits) and by the speech service (voice dictation).
 */
const toothSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      match: [/^[1-4][1-8](_L)?$/, '{VALUE} is not a valid tooth number'],
    },
    patientId: { type: String, required: true, index: true },
    missing: { type: Boolean, default: false },
    implant: { type: Boolean, default: false },
    mobility: range('Mobility', 0, 3),
    furcation: range('Furcation', 0, 3),
    furcation_mesial: range('Furcation', 0, 3),
    furcation_distal: range('Furcation', 0, 3),
    plaque: siteFlags(),
    bleeding: siteFlags(),
    gingivalMargin: siteMeasurements('Gingival margin', 10),
    probingDepth: siteMeasurements('Probing depth', 15),
  },
  { timestamps: true }
);

// Collection name "tooths" (Mongoose's plural) is also used by the speech service.
module.exports = mongoose.model('Tooth', toothSchema);
