const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  orderId: { type: String, required: true }, // Reference to order
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

// Index for fast customer queries
notificationSchema.index({ customerEmail: 1, createdAt: -1 });
notificationSchema.index({ customerPhone: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
