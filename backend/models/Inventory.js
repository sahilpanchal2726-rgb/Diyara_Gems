const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  qr:          { type: String, required: true, unique: true }, // e.g. GV-1001
  stone:       { type: String, required: true },
  colour:      { type: String, required: true },
  shape:       { type: String, required: true },
  size:        { type: String, required: true },
  plating:     { type: String, required: true },
  grade:       { type: String, required: true },
  time:        { type: String, default: '' },
  qty:         { type: Number, required: true, min: 0 },
  originalQty: { type: Number, required: true },
  // Price fields (kept but hidden in UI per business requirement)
  pp:     { type: Number, default: 0 },
  sp:     { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);