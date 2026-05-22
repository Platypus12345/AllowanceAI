const mongoose = require('mongoose');

const recurringExpenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'],
    },
    description: { type: String, required: true },
    frequency: { type: String, enum: ['weekly', 'monthly'], required: true },
    nextDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecurringExpense', recurringExpenseSchema);
