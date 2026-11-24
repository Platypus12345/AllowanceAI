// The v2 assistant. Authenticated proxy in front of ai-service's RAG endpoints.
//
// Every route here derives the user from `req.userId`, which verifyJWT set from a signed
// token. A `user_id` in the request body is never read. That is the whole security
// boundary: ai-service will happily answer about whatever user_id it is given, so the
// decision about *which* user is being asked about belongs here, where there is a JWT.
//
// This route replaces nothing. `routes/ai.js` is the v1 assistant: it requires Mongoose
// models and builds its context from them, so it is dead in production with MONGO_URI
// gone. It is left alone rather than edited, because the two share no code path.

const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const assistant = require('../services/assistantClient');

const router = express.Router();
router.use(verifyJWT);

const MAX_QUESTION_LENGTH = 1000;

/** Turn a client error from assistantClient into an honest HTTP response.
 *
 *  Each case gets its own message because they need different actions from whoever reads
 *  it: set an env var, wait for a cold start, or look at logs. "Assistant unavailable"
 *  would cover all three and help with none.
 */
function respondToFailure(res, error) {
  switch (error.code) {
    case 'ASSISTANT_NOT_CONFIGURED':
      return res.status(503).json({
        error:
          'The assistant is not configured on this server. Set INTERNAL_API_TOKEN here and ' +
          'on ai-service.',
        code: error.code,
      });
    case 'ASSISTANT_UNAVAILABLE':
      return res.status(503).json({
        // ai-service's own 503 detail is passed through: it distinguishes "no LLM key" from
        // "no internal token", and both are actionable.
        error: error.message,
        code: error.code,
      });
    case 'ASSISTANT_TIMEOUT':
      return res.status(504).json({
        error:
          'The assistant did not answer in time. Free-tier instances sleep, so the first ' +
          'question after a quiet spell can time out — try once more.',
        code: error.code,
      });
    default:
      console.error('Assistant request failed:', error);
      return res.status(502).json({
        error: 'The assistant could not answer that right now.',
        code: 'ASSISTANT_ERROR',
      });
  }
}

router.get('/status', (req, res) => {
  // Lets the client hide the assistant entirely rather than offering a box that cannot
  // work. Says nothing about any user, so it needs no data access.
  res.json({ configured: assistant.isConfigured() });
});

router.post('/ask', async (req, res) => {
  const { question } = req.body || {};

  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'A question is required' });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res
      .status(400)
      .json({ error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` });
  }

  try {
    // req.userId, never req.body.user_id — see the file header.
    const result = await assistant.ask(req.userId, question.trim());
    res.json(result);
  } catch (error) {
    respondToFailure(res, error);
  }
});

router.post('/retrieve', async (req, res) => {
  // Retrieval with no generation. Works with no LLM key, which is what makes the
  // hybrid-vs-single-arm comparison showable live.
  const { query, k, mode } = req.body || {};

  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'A query is required' });
  }
  if (mode != null && !['hybrid', 'dense', 'lexical'].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'hybrid', 'dense' or 'lexical'" });
  }
  const limit = k == null ? 8 : Number(k);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ error: 'k must be an integer between 1 and 50' });
  }

  try {
    const result = await assistant.retrieveFor(req.userId, query.trim(), { k: limit, mode });
    res.json(result);
  } catch (error) {
    respondToFailure(res, error);
  }
});

router.post('/reindex', async (req, res) => {
  // Backfills this user's whole history. Needed for transactions that predate the
  // assistant, and to repair anything missed while ai-service was asleep — indexing on
  // write is best-effort by design, so there has to be a way to catch up.
  try {
    const result = await assistant.reindexUser(req.userId);
    res.json(result);
  } catch (error) {
    respondToFailure(res, error);
  }
});

module.exports = router;
