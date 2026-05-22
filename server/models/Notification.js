const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['SAFE', 'WARNING', 'CRITICAL', 'INSIGHT', 'ACHIEVEMENT'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
      type: String,
      enum: ['safe', 'warning', 'critical', 'insight', 'achievement'],
      required: true,
    },
    isRead: { type: Boolean, default: false },
    metadata: {
      key: { type: String },
      recommendation: { type: String },
      category: { type: String },
      priority: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, 'metadata.key': 1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
