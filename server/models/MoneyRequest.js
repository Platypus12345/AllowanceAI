const mongoose = require('mongoose');

const moneyRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friend' },
    friendName: { type: String, required: true },
    friendUpiId: { type: String },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    method: { type: String, enum: ['upi', 'whatsapp'], default: 'upi' },
    status: {
      type: String,
      enum: ['pending', 'received', 'no_response'],
      default: 'pending',
    },
  },
  { timestamps: true, collection: 'moneyrequests' }
);

module.exports = mongoose.model('MoneyRequest', moneyRequestSchema);
