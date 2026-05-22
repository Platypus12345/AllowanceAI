const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const User = require('../models/User');
const verifyJWT = require('../middleware/verifyJWT');
const { syncSmartNotifications } = require('../utils/notificationEngine');

router.use(verifyJWT);

// Create expense
router.post('/', async (req, res) => {
  try {
    const { amount, category, description, date, force } = req.body;

    if (!force) {
      const recentDuplicate = await Expense.findOne({
        userId: req.userId,
        amount,
        description: description?.trim(),
        createdAt: { $gte: new Date(Date.now() - 60000) },
      });

      if (recentDuplicate) {
        return res.status(409).json({
          message: 'Duplicate transaction detected. Was this intentional?',
          duplicate: true,
          existingId: recentDuplicate._id,
        });
      }
    }

    const expense = new Expense({
      userId: req.userId,
      amount,
      category,
      description,
      date: date || new Date()
    });

    await expense.save();

    // Update streak
    const user = await User.findById(req.userId);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const lastCheck = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
    if (lastCheck) lastCheck.setHours(0, 0, 0, 0);

    if (!lastCheck) {
      user.streak = 1;
      user.lastCheckIn = now;
    } else if (now.getTime() > lastCheck.getTime()) {
      const diff = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        user.streak += 1;
      } else {
        user.streak = 1;
      }
      user.lastCheckIn = now;
    }
    await user.save();

    syncSmartNotifications(req.userId).catch((err) =>
      console.error('Notification sync after expense:', err)
    );

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Get all expenses for user
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Delete expense
router.delete('/:id', async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
