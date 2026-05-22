const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Expense = require('../models/Expense');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

function calculateLevel(xp) {
  if (xp < 100) return { level: 1, title: 'Broke Freshman' };
  if (xp < 300) return { level: 2, title: 'Budget Apprentice' };
  if (xp < 600) return { level: 3, title: 'Rupee Ranger' };
  if (xp < 1000) return { level: 4, title: 'Frugal Scholar' };
  if (xp < 1500) return { level: 5, title: 'Money Monk' };
  return { level: 6, title: 'Finance God' };
}

// Get gamification stats
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      'xp level levelTitle streak currentStreak longestStreak badges allowance'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const xp = user.xp ?? 0;
    const { level, title } = calculateLevel(xp);

    if (user.level !== level || user.levelTitle !== title) {
      user.level = level;
      user.levelTitle = title;
      await user.save();
    }

    // First Save badge
    const expenseCount = await Expense.countDocuments({ userId: req.userId });
    if (expenseCount > 0 && !user.badges.some((b) => b.name === 'First Save')) {
      user.badges.push({ name: 'First Save' });
      await user.save();
    }

    res.json({
      xp,
      level,
      levelTitle: title,
      streak: user.currentStreak ?? user.streak ?? 0,
      longestStreak: user.longestStreak ?? 0,
      badges: user.badges,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gamification stats' });
  }
});

module.exports = router;
module.exports.calculateLevel = calculateLevel;
