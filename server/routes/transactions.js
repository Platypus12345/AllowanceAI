const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const prisma = require('../config/prisma');
const ingest = require('../services/ingestService');
const { invalidateSummary } = require('../services/dashboardService');
const { publishToUser } = require('../services/realtime');

const router = express.Router();
router.use(verifyJWT);

router.get('/', async (req, res) => {
  try {
    const rows = await ingest.listTransactions(req.userId);
    res.json(rows);
  } catch (error) {
    console.error('List transactions failed:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Manual entry — the only way to add a transaction from the web client.
// `direction` follows the parser convention: debit is stored positive (a spend),
// credit negative, so spend SUMs stay comparable across sms / setu_aa / manual.
router.post('/', async (req, res) => {
  try {
    const { amount, merchant, categoryId, occurredAt, direction, rawText } = req.body || {};

    const numeric = Number(amount);
    if (amount == null || amount === '' || Number.isNaN(numeric)) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (numeric === 0) {
      return res.status(400).json({ error: 'Amount must not be zero' });
    }
    if (direction != null && !['debit', 'credit'].includes(direction)) {
      return res.status(400).json({ error: "direction must be 'debit' or 'credit'" });
    }
    if (occurredAt != null && Number.isNaN(new Date(occurredAt).getTime())) {
      return res.status(400).json({ error: 'occurredAt must be a valid date' });
    }

    // Same ownership check the budgets route uses: a user may only attach their own
    // categories or a system default, never another user's.
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

    const result = await ingest.createManual({
      userId: req.userId,
      amount: numeric,
      merchant: typeof merchant === 'string' ? merchant.trim() || null : null,
      categoryId: categoryId || null,
      occurredAt,
      direction,
      rawText,
    });

    await invalidateSummary(req.userId);
    publishToUser(req.userId, { type: 'transaction.created' });
    res.status(201).json(result);
  } catch (error) {
    console.error('Create manual transaction failed:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

module.exports = router;
