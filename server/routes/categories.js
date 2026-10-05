const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

// List categories (system defaults + user-specific)
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { isDefault: true },
          { userId: req.userId },
        ],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create custom category
router.post('/', async (req, res) => {
  try {
    const { name, isDefault } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await prisma.category.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        isDefault: Boolean(isDefault),
      },
    });
    res.status(201).json(category);
  } catch (error) {
    console.error('Failed to create category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const existing = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Category not found or not editable' });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name: name.trim() },
    });
    res.json(updated);
  } catch (error) {
    console.error('Failed to update category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Category not found or not deletable' });
    }

    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Failed to delete category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
