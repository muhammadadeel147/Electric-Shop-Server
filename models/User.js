
// models/User.js - User model for MongoDB
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin']
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash the token and set it to the schema
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // Token valid for 1 hour

  return resetToken;
};
module.exports = mongoose.model('User', UserSchema);
