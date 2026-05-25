const mongoose = require('mongoose');

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

const splitExpenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friend', required: true },
    friendName: { type: String, required: true },
    friendUpiId: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true },
    yourShare: { type: Number, required: true },
    friendShare: { type: Number, required: true },
    splitType: { type: String, enum: ['equal', 'custom'], default: 'equal' },
    status: {
      type: String,
      enum: ['pending', 'settled', 'cancelled'],
      default: 'pending',
    },
    category: { type: String, enum: CATEGORIES, default: 'Other' },
    settledAt: { type: Date, default: null },
    lastRemindedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'splitexpenses' }
);

module.exports = mongoose.model('SplitExpense', splitExpenseSchema);
module.exports.CATEGORIES = CATEGORIES;
