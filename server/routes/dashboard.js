const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const { buildSummary, cacheKey } = require('../services/dashboardService');
const { cacheGet, cacheSet } = require('../config/redis');

const router = express.Router();
router.use(verifyJWT);

const TTL_SECONDS = 60;

// One read that paints the whole v2 dashboard: month spend, per-budget progress,
// goal progress and the latest transactions.
//
// Redis caches it for 60s, but the cache is strictly an optimisation — see
// config/redis.js. If Redis is absent (it is not provisioned on Render) or down,
// `cacheGet` returns null, we compute from PostgreSQL, and the response is identical
// apart from the `cached` flag. The endpoint must never fail because a cache is missing.
router.get('/summary', async (req, res) => {
  const key = cacheKey(req.userId);
  const wantsFresh = req.query.fresh === '1' || req.query.fresh === 'true';

  try {
    if (!wantsFresh) {
      const hit = await cacheGet(key);
      if (hit) {
        return res.json({ ...hit, cached: true });
      }
    }

    const summary = await buildSummary(req.userId);
    await cacheSet(key, summary, TTL_SECONDS);
    res.json({ ...summary, cached: false });
  } catch (error) {
    console.error('Dashboard summary failed:', error);
    res.status(500).json({ error: 'Failed to build dashboard summary' });
  }
});

module.exports = router;
