const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyJWT = require('../middleware/verifyJWT');
const { VALID_PERSONALITIES } = require('../utils/personalityPrompts');

router.use(verifyJWT);

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
