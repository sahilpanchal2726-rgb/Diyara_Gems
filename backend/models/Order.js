const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // DG-XXXXXX
  customer: {
    name:  { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    addr:  { type: String, required: true },
    city:  { type: String, required: true },
    pin:   { type: String, required: true },
    gst:   { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  items: [{
    name:      String,
    size:      String,
    brand:     String,
    qty:       Number,
    unitPrice: Number,
    lineTotal: Number,
    batchId:   String,
  }],
  subtotal: { type: Number, required: true },
  gst:      { type: Number, required: true },
  total:    { type: Number, required: true },
  status:   { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);