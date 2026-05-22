const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  name: { type: String, required: true },
  picture: { type: String },
  allowance: { type: Number, default: 8000 },
  role: { type: String, enum: ['student', 'parent'], default: 'student' },
  linkedAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expoPushToken: { type: String },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastCheckIn: { type: Date },
  lastStreakDate: { type: Date },
  lastCheckin: { type: Date },
  messEatingStreak: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  levelTitle: { type: String, default: 'Broke Freshman' },
  badges: [{
    name: { type: String },
    earnedAt: { type: Date, default: Date.now },
  }],
  aiPersonality: {
    type: String,
    enum: ['strict', 'supportive', 'savage', 'zen'],
    default: 'supportive',
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
