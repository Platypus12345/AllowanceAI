const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    upiId: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: null },
    avatar: { type: String, default: null },
    totalOwed: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'friends' }
);

friendSchema.pre('save', function setAvatar(next) {
  if (!this.avatar && this.name) {
    this.avatar = this.name.charAt(0).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Friend', friendSchema);
