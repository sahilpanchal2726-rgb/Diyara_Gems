const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  city: { type: String, default: '' },
  address: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
