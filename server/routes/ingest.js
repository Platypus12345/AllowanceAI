const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const ingest = require('../services/ingestService');
const { invalidateSummary } = require('../services/dashboardService');
const { publishToUser } = require('../services/realtime');

const router = express.Router();
router.use(verifyJWT);

router.post('/sms', async (req, res) => {
  try {
    const { sender, body, receivedAt } = req.body || {};
    if (!sender || !body) {
      return res.status(400).json({ error: 'sender and body are required' });
    }
    const result = await ingest.ingestSms({
      userId: req.userId,
      sender,
      body,
      receivedAt,
    });
    await invalidateSummary(req.userId);
    publishToUser(req.userId, { type: 'transaction.created' });
    res.status(201).json({
      ...ingest.serializeTransaction(result.transaction),
      duplicateOf: result.duplicateOf,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('SMS ingest failed:', error);
    res.status(status).json({ error: error.message || 'SMS ingest failed' });
  }
});

router.post('/setu/consent', async (req, res) => {
  try {
    const linked = await ingest.saveSetuConsent({
      userId: req.userId,
      consentHandle: req.body?.consentHandle,
    });
    res.status(201).json(linked);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Setu consent failed:', error);
    res.status(status).json({ error: error.message || 'Setu consent failed' });
  }
});

router.post('/setu', async (req, res) => {
  try {
    const { consentHandle, fiData } = req.body || {};
    if (!fiData || typeof fiData !== 'object') {
      return res.status(400).json({ error: 'fiData JSON object is required' });
    }
    const { linkedAccount, results } = await ingest.ingestSetu({
      userId: req.userId,
      consentHandle,
      fiData,
    });
    await invalidateSummary(req.userId);
    publishToUser(req.userId, { type: 'transaction.created' });
    res.status(201).json({
      linkedAccount,
      transactions: results.map((r) => ({
        ...ingest.serializeTransaction(r.transaction),
        duplicateOf: r.duplicateOf,
      })),
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Setu ingest failed:', error);
    res.status(status).json({ error: error.message || 'Setu ingest failed' });
  }
});

module.exports = router;
