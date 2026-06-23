const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  batchId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  qr:       { type: String, required: true },
  stone:    { type: String, required: true },
  colour:   { type: String, required: true },
  qty:      { type: Number, required: true, min: 1 },
  saleBase:  { type: Number, default: 0 },
  saleCgst:  { type: Number, default: 0 },
  saleSgst:  { type: Number, default: 0 },
  saleTotal: { type: Number, default: 0 },
  profit:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);