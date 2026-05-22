const express = require('express');
const router = express.Router();
const Split = require('../models/Split');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

// Create a new split
router.post('/', async (req, res) => {
  try {
    const { expenseId, description, amount, friendName } = req.body;
    
    if (!description || !amount || !friendName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const split = new Split({
      userId: req.userId,
      expenseId: expenseId || null,
      description,
      amount,
      friendName
    });

    await split.save();
    res.status(201).json(split);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create split' });
  }
});

// Get all splits for user
router.get('/', async (req, res) => {
  try {
    const splits = await Split.find({ userId: req.userId }).sort({ date: -1 });
    res.json(splits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch splits' });
  }
});

// Settle a split
router.put('/:id/settle', async (req, res) => {
  try {
    const split = await Split.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status: 'settled' },
      { new: true }
    );
    
    if (!split) return res.status(404).json({ error: 'Split not found' });
    
    res.json(split);
  } catch (error) {
    res.status(500).json({ error: 'Failed to settle split' });
  }
});

module.exports = router;
