const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  type: { type: String, enum: ['inward', 'outward'], required: true },
  stone: { type: String },
  colour: { type: String },
  shape: { type: String },
  size: { type: String },
  grade: { type: String },
  qty: { type: Number, required: true, min: 1 },
  date: { type: String },
  time: { type: String },
  vendor: { type: String, default: '' },
  customer: { type: String, default: '' },
  ref: { type: String, default: '' },
  purchasePrice: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'priced'], default: 'pending' },
  source: { type: String, enum: ['stock_manager', 'accountant', 'system'], default: 'stock_manager' },
  pricedBy: { type: String, default: '' },
  pricedAt: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
