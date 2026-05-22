const express = require('express');
const router = express.Router();
const RecurringExpense = require('../models/RecurringExpense');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

// Create a new recurring expense
router.post('/', async (req, res) => {
  try {
    const { amount, category, description, frequency, nextDate } = req.body;
    
    if (!amount || !category || !description || !frequency || !nextDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const recurring = new RecurringExpense({
      userId: req.userId,
      amount,
      category,
      description,
      frequency,
      nextDate: new Date(nextDate)
    });

    await recurring.save();
    res.status(201).json(recurring);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create recurring expense' });
  }
});

// Get all recurring expenses for user
router.get('/', async (req, res) => {
  try {
    const expenses = await RecurringExpense.find({ userId: req.userId }).sort({ nextDate: 1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recurring expenses' });
  }
});

// Delete recurring expense
router.delete('/:id', async (req, res) => {
  try {
    const expense = await RecurringExpense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!expense) return res.status(404).json({ error: 'Recurring expense not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recurring expense' });
  }
});

module.exports = router;
