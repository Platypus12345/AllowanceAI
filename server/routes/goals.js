const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

// List all user goals
router.get('/', async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId },
      orderBy: { targetDate: 'asc' },
    });
    res.json(goals);
  } catch (error) {
    console.error('Failed to fetch goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Create a goal
router.post('/', async (req, res) => {
  try {
    const { title, targetAmount, currentAmount, targetDate } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Goal title is required' });
    }
    if (targetAmount == null || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
      return res.status(400).json({ error: 'Valid positive target amount is required' });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.userId,
        title: title.trim(),
        targetAmount: Number(targetAmount),
        currentAmount: currentAmount != null ? Number(currentAmount) : 0,
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });
    res.status(201).json(goal);
  } catch (error) {
    console.error('Failed to create goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Update a goal
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, targetAmount, currentAmount, targetDate } = req.body;

    const existing = await prisma.goal.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (targetAmount !== undefined) data.targetAmount = Number(targetAmount);
    if (currentAmount !== undefined) data.currentAmount = Number(currentAmount);
    if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null;

    const updated = await prisma.goal.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (error) {
    console.error('Failed to update goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// Delete a goal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.goal.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await prisma.goal.delete({ where: { id } });
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Failed to delete goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
