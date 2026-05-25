const express = require('express');
const router = express.Router();
const Friend = require('../models/Friend');
const SplitExpense = require('../models/SplitExpense');
const verifyJWT = require('../middleware/verifyJWT');
const { isValidUPI, normalizeUPI } = require('../utils/upi');

router.use(verifyJWT);

function formatFriend(f) {
  return {
    _id: f._id,
    name: f.name,
    upiId: f.upiId,
    phone: f.phone,
    avatar: f.avatar || f.name?.charAt(0)?.toUpperCase(),
    totalOwed: f.totalOwed,
    createdAt: f.createdAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const friends = await Friend.find({ userId: req.userId }).sort({ name: 1 });
    res.json(friends.map(formatFriend));
  } catch (err) {
    console.error('GET /friends', err);
    res.status(500).json({ message: 'Failed to fetch friends' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, upiId, phone } = req.body;
    if (!name?.trim() || !upiId?.trim()) {
      return res.status(400).json({ message: 'Name and UPI ID are required' });
    }
    if (!isValidUPI(upiId)) {
      return res.status(400).json({ message: 'Invalid UPI ID format' });
    }

    const normalized = normalizeUPI(upiId);
    const duplicate = await Friend.findOne({ userId: req.userId, upiId: normalized });
    if (duplicate) {
      return res.status(400).json({ message: 'A friend with this UPI ID already exists' });
    }

    const friend = await Friend.create({
      userId: req.userId,
      name: name.trim(),
      upiId: normalized,
      phone: phone?.trim() || null,
    });

    res.status(201).json(formatFriend(friend));
  } catch (err) {
    console.error('POST /friends', err);
    res.status(500).json({ message: 'Failed to add friend' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, upiId, phone } = req.body;
    const friend = await Friend.findOne({ _id: req.params.id, userId: req.userId });
    if (!friend) return res.status(404).json({ message: 'Friend not found' });

    if (name?.trim()) friend.name = name.trim();
    if (phone !== undefined) friend.phone = phone?.trim() || null;
    if (upiId?.trim()) {
      if (!isValidUPI(upiId)) {
        return res.status(400).json({ message: 'Invalid UPI ID format' });
      }
      const normalized = normalizeUPI(upiId);
      const dup = await Friend.findOne({
        userId: req.userId,
        upiId: normalized,
        _id: { $ne: friend._id },
      });
      if (dup) return res.status(400).json({ message: 'UPI ID already used by another friend' });
      friend.upiId = normalized;
    }

    await friend.save();
    res.json(formatFriend(friend));
  } catch (err) {
    console.error('PUT /friends/:id', err);
    res.status(500).json({ message: 'Failed to update friend' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const friend = await Friend.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!friend) return res.status(404).json({ message: 'Friend not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /friends/:id', err);
    res.status(500).json({ message: 'Failed to delete friend' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const friend = await Friend.findOne({ _id: req.params.id, userId: req.userId });
    if (!friend) return res.status(404).json({ message: 'Friend not found' });

    const splits = await SplitExpense.find({
      userId: req.userId,
      friendId: friend._id,
    }).sort({ createdAt: -1 });

    const totalExchanged = splits.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      friend: formatFriend(friend),
      splits,
      totalExchanged,
      splitCount: splits.length,
    });
  } catch (err) {
    console.error('GET /friends/:id/history', err);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

module.exports = router;
