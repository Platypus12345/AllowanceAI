const mongoose = require('mongoose');

const budgetGoalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      required: true,
      enum: ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'],
    },
    monthlyLimit: { type: Number, required: true, min: 0 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
  },
  { timestamps: true }
);

budgetGoalSchema.index({ userId: 1, category: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('BudgetGoal', budgetGoalSchema);
