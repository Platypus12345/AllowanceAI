const mongoose = require('mongoose');

const splitExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    share: { type: Number },
    settled: { type: Boolean, default: false }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SplitExpense', splitExpenseSchema);
