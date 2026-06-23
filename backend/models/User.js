const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  email:    { type: String, default: '' },
  role:     { type: String, default: 'staff' },
  active:   { type: Boolean, default: true },
  permissions: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
