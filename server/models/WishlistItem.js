const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    productUrl: { type: String, required: true },
    targetPrice: { type: Number, required: true },
    currentPrice: { type: Number, default: null },
    originalPrice: { type: Number, default: null },
    imageUrl: { type: String, default: null },
    platform: { type: String, default: null },
    category: {
      type: String,
      enum: ['Tech', 'Fashion', 'Food', 'Books', 'Sports', 'Other'],
      default: 'Other',
    },
    status: {
      type: String,
      enum: ['tracking', 'purchased', 'dropped'],
      default: 'tracking',
    },
    inStock: { type: Boolean, default: true },
    priceAlertSent: { type: Boolean, default: false },
    affordabilityAlertSent: { type: Boolean, default: false },
    dropAlertSent: { type: Boolean, default: false },
    priceUpAlertSent: { type: Boolean, default: false },
    lastChecked: { type: Date, default: null },
    linkedJarId: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsJar', default: null },
    aiBuyTip: { type: String, default: null },
    aiAlternative: { type: String, default: null },
  },
  { timestamps: true, collection: 'wishlistitems' }
);

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);
