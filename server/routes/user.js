const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyJWT = require('../middleware/verifyJWT');
const { VALID_PERSONALITIES } = require('../utils/personalityPrompts');
const { isValidUPI, normalizeUPI } = require('../utils/upi');

router.use(verifyJWT);

router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      'name email picture allowance xp level levelTitle upiId upiName aiPersonality'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        allowance: user.allowance,
        xp: user.xp,
        level: user.level,
        levelTitle: user.levelTitle,
        upiId: user.upiId,
        upiName: user.upiName || user.name,
        aiPersonality: user.aiPersonality,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

router.put('/upi', async (req, res) => {
  try {
    const { upiId, upiName } = req.body;
    if (!upiId?.trim()) {
      return res.status(400).json({ success: false, message: 'UPI ID is required' });
    }
    if (!isValidUPI(upiId)) {
      return res.status(400).json({ success: false, message: 'Invalid UPI ID format' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        upiId: normalizeUPI(upiId),
        upiName: upiName?.trim() || undefined,
      },
      { new: true }
    ).select('upiId upiName name');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      upiId: user.upiId,
      upiName: user.upiName || user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to save UPI ID' });
  }
});

router.get('/personality', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('aiPersonality');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      personality: user.aiPersonality || 'supportive',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch personality' });
  }
});

router.put('/personality', async (req, res) => {
  try {
    const { personality } = req.body;

    if (!VALID_PERSONALITIES.includes(personality)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid personality',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { aiPersonality: personality },
      { new: true }
    ).select('aiPersonality');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      personality: user.aiPersonality,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Failed to update personality',
    });
  }
});

module.exports = router;
