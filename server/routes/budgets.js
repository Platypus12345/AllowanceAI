const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

// List all user budgets with category information
router.get('/', async (req, res) => {
  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(budgets);
  } catch (error) {
    console.error('Failed to fetch budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Create a budget
router.post('/', async (req, res) => {
  try {
    const { categoryId, amount, period } = req.body;
    if (amount == null || isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    if (categoryId) {
      const cat = await prisma.category.findFirst({
        where: {
          id: categoryId,
          OR: [{ userId: req.userId }, { isDefault: true }],
        },
      });
      if (!cat) {
        return res.status(400).json({ error: 'Invalid categoryId' });
      }
    }

    const budget = await prisma.budget.create({
      data: {
        userId: req.userId,
        categoryId: categoryId || null,
        amount: Number(amount),
        period: period || 'monthly',
      },
      include: { category: true },
    });
    res.status(201).json(budget);
  } catch (error) {
    console.error('Failed to create budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Update budget
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, period, categoryId } = req.body;

    const existing = await prisma.budget.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const data = {};
    if (amount != null) {
      if (isNaN(Number(amount)) || Number(amount) < 0) {
        return res.status(400).json({ error: 'Valid positive amount is required' });
      }
      data.amount = Number(amount);
    }
    if (period != null) data.period = period;
    if (categoryId !== undefined) data.categoryId = categoryId;

    const updated = await prisma.budget.update({
      where: { id },
      data,
      include: { category: true },
    });
    res.json(updated);
  } catch (error) {
    console.error('Failed to update budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Delete budget
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.budget.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await prisma.budget.delete({ where: { id } });
    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Failed to delete budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

module.exports = router;
