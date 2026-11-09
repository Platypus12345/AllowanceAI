const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const ingest = require('../services/ingestService');

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

module.exports = router;
