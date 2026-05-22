const mongoose = require('mongoose');

const actionTakenSchema = new mongoose.Schema({
  toolName: String,
  toolParams: mongoose.Schema.Types.Mixed,
  result: String,
  success: Boolean,
  previousValue: mongoose.Schema.Types.Mixed, // for undo support
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  actionTaken: actionTakenSchema,
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'New Conversation' },
  messages: [messageSchema],
  personalityMode: { type: String, default: 'supportive' },
}, { timestamps: true });

// Auto-generate title from first user message
chatSessionSchema.methods.generateTitle = function () {
  const firstUser = this.messages.find(m => m.role === 'user');
  if (!firstUser) return;
  const raw = firstUser.content.trim();
  this.title = raw.length > 40 ? raw.slice(0, 37) + '...' : raw;
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);
