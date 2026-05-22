const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', required: false },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    friendName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Split', splitSchema);
