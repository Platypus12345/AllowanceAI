const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const ingest = require('../services/ingestService');
const { invalidateSummary } = require('../services/dashboardService');
const { publishToUser } = require('../services/realtime');
const { indexTransactionInBackground } = require('../services/assistantClient');

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

    // Best-effort assistant indexing. An SMS that produced a durable transactions row has
    // done its job; making it retrievable must not be able to fail that.
    if (result.transaction && result.transaction.id) {
      indexTransactionInBackground(result.transaction.id);
    }

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

    // One AA pull can bring back many transactions, so index each. Same best-effort
    // contract as the SMS path above.
    for (const r of results) {
      if (r.transaction && r.transaction.id) {
        indexTransactionInBackground(r.transaction.id);
      }
    }

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
