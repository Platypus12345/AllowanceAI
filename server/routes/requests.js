const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Friend = require('../models/Friend');
const MoneyRequest = require('../models/MoneyRequest');
const verifyJWT = require('../middleware/verifyJWT');
const { isValidUPI } = require('../utils/upi');

router.use(verifyJWT);

router.get('/', async (req, res) => {
  try {
    const requests = await MoneyRequest.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(requests);
  } catch (err) {
    console.error('GET /requests', err);
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

router.post('/upi-collect', async (req, res) => {
  try {
    const { friendId, amount, note, senderUpiId } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const yourUpi = senderUpiId || user.upiId;
    if (!yourUpi || !isValidUPI(yourUpi)) {
      return res.status(400).json({ message: 'Set your UPI ID in profile first' });
    }

    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > 100000) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const friend = await Friend.findOne({ _id: friendId, userId: req.userId });
    if (!friend) return res.status(404).json({ message: 'Friend not found' });
    if (!isValidUPI(friend.upiId)) {
      return res.status(400).json({ message: 'Friend has no valid UPI ID' });
    }

    const payeeName = encodeURIComponent(user.upiName || user.name);
    const txnNote = encodeURIComponent(`${note || 'Payment'} via AllowanceAI`);
    // pa = your UPI (you receive); collect request asks friend to pay you
    const deepLink =
      `upi://collect?pa=${encodeURIComponent(yourUpi)}` +
      `&pn=${payeeName}&am=${amt.toFixed(2)}&tn=${txnNote}&cu=INR`;

    await MoneyRequest.create({
      userId: req.userId,
      friendId: friend._id,
      friendName: friend.name,
      friendUpiId: friend.upiId,
      amount: amt,
      note: note || '',
      method: 'upi',
      status: 'pending',
    });

    res.json({
      deepLink,
      friendName: friend.name,
      amount: amt,
    });
  } catch (err) {
    console.error('POST /requests/upi-collect', err);
    res.status(500).json({ message: 'Failed to create UPI collect request' });
  }
});

router.post('/whatsapp', async (req, res) => {
  try {
    const { friendId, amount, note, senderUpiId } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const yourUpi = senderUpiId || user.upiId;
    if (!yourUpi || !isValidUPI(yourUpi)) {
      return res.status(400).json({ message: 'Set your UPI ID in profile first' });
    }

    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > 100000) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const friend = await Friend.findOne({ _id: friendId, userId: req.userId });
    if (!friend) return res.status(404).json({ message: 'Friend not found' });

    const message =
      `Hey ${friend.name}! You owe me ₹${amt} for ${note || 'expenses'}. ` +
      `Please send it to ${yourUpi}. — via AllowanceAI`;

    const deepLink = `https://wa.me/${friend.phone ? friend.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(message)}`;
    const whatsappLink = friend.phone
      ? deepLink
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    await MoneyRequest.create({
      userId: req.userId,
      friendId: friend._id,
      friendName: friend.name,
      friendUpiId: friend.upiId,
      amount: amt,
      note: note || '',
      method: 'whatsapp',
      status: 'pending',
    });

    res.json({
      deepLink: whatsappLink,
      message,
      friendName: friend.name,
      amount: amt,
    });
  } catch (err) {
    console.error('POST /requests/whatsapp', err);
    res.status(500).json({ message: 'Failed to create WhatsApp request' });
  }
});

module.exports = router;
