const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  batchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  qrCode:      { type: String, required: true }, // QR code for reference
  type:        { type: String, enum: ['INWARD', 'OUTWARD'], required: true }, // INWARD = stock in, OUTWARD = stock out (sale/damage/loss)
  quantity:    { type: Number, required: true, min: 1 },
  reason:      { type: String, default: '' }, // e.g., "Purchase", "Sale", "Damage", "Returned", "Adjusted"
  referenceId: { type: String, default: '' }, // e.g., order ID, sale ID, invoice number
  supplier:    { type: String, default: '' }, // For inward movements
  remarks:     { type: String, default: '' },
  date:        { type: Date, default: Date.now },
  createdBy:   { type: String, default: 'system' },
}, { timestamps: true });

// Index for efficient queries
stockMovementSchema.index({ batchId: 1, date: -1 });
stockMovementSchema.index({ qrCode: 1, date: -1 });
stockMovementSchema.index({ type: 1, date: -1 });
stockMovementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
