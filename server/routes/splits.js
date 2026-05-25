const express = require('express');
const router = express.Router();
const SplitExpense = require('../models/SplitExpense');
const Friend = require('../models/Friend');
const User = require('../models/User');
const verifyJWT = require('../middleware/verifyJWT');
const { CATEGORIES } = require('../models/SplitExpense');

router.use(verifyJWT);

const MAX_AMOUNT = 100000;

function validateShares(totalAmount, yourShare, friendShare) {
  const total = Number(totalAmount);
  const yours = Number(yourShare);
  const friend = Number(friendShare);
  if (total <= 0 || total > MAX_AMOUNT) return 'Amount must be between ₹1 and ₹1,00,000';
  if (yours < 0 || friend < 0) return 'Shares cannot be negative';
  if (yours > total || friend > total) return 'Share cannot exceed total amount';
  if (Math.abs(yours + friend - total) > 0.01) return 'Shares must add up to total amount';
  return null;
}

async function adjustFriendOwed(friendId, userId, delta) {
  const friend = await Friend.findOne({ _id: friendId, userId });
  if (friend) {
    friend.totalOwed = (friend.totalOwed || 0) + delta;
    await friend.save();
  }
}

router.get('/pending-count', async (req, res) => {
  try {
    const count = await SplitExpense.countDocuments({
      userId: req.userId,
      status: 'pending',
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Failed to count pending splits' });
  }
});

router.get('/', async (req, res) => {
  try {
    const splits = await SplitExpense.find({ userId: req.userId }).sort({ createdAt: -1 });
    const pending = splits.filter((s) => s.status === 'pending');
    const settled = splits.filter((s) => s.status === 'settled').slice(0, 5);

    const friends = await Friend.find({ userId: req.userId });
    const totalOwedToYou = friends.reduce((sum, f) => sum + Math.max(0, f.totalOwed || 0), 0);
    const totalYouOwe = friends.reduce((sum, f) => sum + Math.max(0, -(f.totalOwed || 0)), 0);
    const peopleOweYou = friends.filter((f) => (f.totalOwed || 0) > 0).length;

    res.json({
      pending,
      settled,
      totalOwedToYou,
      totalYouOwe,
      peopleOweYou,
    });
  } catch (err) {
    console.error('GET /splits', err);
    res.status(500).json({ message: 'Failed to fetch splits' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      friendId,
      description,
      totalAmount,
      splitType = 'equal',
      yourShare,
      friendShare,
      category = 'Other',
    } = req.body;

    if (!friendId || !description?.trim() || !totalAmount) {
      return res.status(400).json({ message: 'friendId, description, and totalAmount are required' });
    }

    const friend = await Friend.findOne({ _id: friendId, userId: req.userId });
    if (!friend) return res.status(404).json({ message: 'Friend not found' });

    const total = Number(totalAmount);
    let yours = Number(yourShare);
    let theirs = Number(friendShare);

    if (splitType === 'equal') {
      theirs = Math.round((total / 2) * 100) / 100;
      yours = Math.round((total - theirs) * 100) / 100;
    }

    const shareErr = validateShares(total, yours, theirs);
    if (shareErr) return res.status(400).json({ message: shareErr });

    const cat = CATEGORIES.includes(category) ? category : 'Other';

    const split = await SplitExpense.create({
      userId: req.userId,
      friendId: friend._id,
      friendName: friend.name,
      friendUpiId: friend.upiId,
      description: description.trim(),
      totalAmount: total,
      yourShare: yours,
      friendShare: theirs,
      splitType,
      category: cat,
      status: 'pending',
    });

    await adjustFriendOwed(friend._id, req.userId, theirs);

    res.status(201).json(split);
  } catch (err) {
    console.error('POST /splits', err);
    res.status(500).json({ message: 'Failed to create split' });
  }
});

router.put('/:id/settle', async (req, res) => {
  try {
    const split = await SplitExpense.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: 'pending',
    });
    if (!split) return res.status(404).json({ message: 'Pending split not found' });

    split.status = 'settled';
    split.settledAt = new Date();
    await split.save();

    await adjustFriendOwed(split.friendId, req.userId, -split.friendShare);

    const user = await User.findById(req.userId).select('name upiId upiName');
    let upiPayLink = null;
    if (split.friendUpiId) {
      const pn = encodeURIComponent(split.friendName);
      const tn = encodeURIComponent(`${split.description} - AllowanceAI`);
      upiPayLink =
        `upi://pay?pa=${encodeURIComponent(split.friendUpiId)}` +
        `&pn=${pn}&am=${split.friendShare.toFixed(2)}&tn=${tn}&cu=INR`;
    }

    res.json({ split, upiPayLink, yourUpiId: user?.upiId });
  } catch (err) {
    console.error('PUT /splits/:id/settle', err);
    res.status(500).json({ message: 'Failed to settle split' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const split = await SplitExpense.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: 'pending',
    });
    if (!split) return res.status(404).json({ message: 'Pending split not found' });

    await adjustFriendOwed(split.friendId, req.userId, -split.friendShare);
    await split.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /splits/:id', err);
    res.status(500).json({ message: 'Failed to delete split' });
  }
});

router.post('/:id/remind', async (req, res) => {
  try {
    const split = await SplitExpense.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: 'pending',
    });
    if (!split) return res.status(404).json({ message: 'Pending split not found' });

    const user = await User.findById(req.userId).select('name upiId');
    if (!user?.upiId) {
      return res.status(400).json({ message: 'Set your UPI ID in profile first' });
    }

    const now = new Date();
    if (split.lastRemindedAt) {
      const hoursSince = (now - split.lastRemindedAt) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return res.status(429).json({
          message: 'Reminder already sent in the last 24 hours',
          lastRemindedAt: split.lastRemindedAt,
        });
      }
    }

    const message =
      `Hey ${split.friendName}! Just a reminder — you owe me ` +
      `₹${split.friendShare} for ${split.description}. ` +
      `UPI: ${user.upiId} — AllowanceAI`;

    split.lastRemindedAt = now;
    await split.save();

    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

    res.json({
      message,
      whatsappLink,
      lastRemindedAt: split.lastRemindedAt,
    });
  } catch (err) {
    console.error('POST /splits/:id/remind', err);
    res.status(500).json({ message: 'Failed to send reminder' });
  }
});

module.exports = router;
