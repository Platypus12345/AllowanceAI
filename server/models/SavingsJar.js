const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

const savingsJarSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    category: {
      type: String,
      enum: ['Travel', 'Tech', 'Health', 'Emergency', 'Fun', 'Other'],
      default: 'Other',
    },
    icon: { type: String, default: '🎯' },
    color: { type: String, default: '#8083ff' },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active',
    },
    autoContributeEnabled: { type: Boolean, default: false },
    autoContributeAmount: { type: Number, default: 0 },
    contributions: [contributionSchema],
    completedAt: { type: Date, default: null },
    milestonesSent: { type: [Number], default: [] },
    linkedWishlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'WishlistItem', default: null },
  },
  { timestamps: true, collection: 'savingsjars' }
);

module.exports = mongoose.model('SavingsJar', savingsJarSchema);
