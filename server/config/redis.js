// Optional Redis cache.
//
// READ THIS BEFORE MAKING IT REQUIRED. render.yaml provisions no Redis service —
// REDIS_URL exists only in .env.example for local docker-compose. A hard dependency
// here would mean the dashboard 500s in production, which is the exact shape of the
// bug that took the live login down: /api/health gated on a legacy Mongo connection
// that the login path never needed.
//
// So every function in this module is fail-open. If REDIS_URL is unset, or Redis is
// down, or a command errors, the caller gets a cache miss and recomputes from
// PostgreSQL. A cache is an optimisation; it is never the source of truth.

const { createClient } = require('redis');

let client = null;
let connecting = null;
let disabled = false;
let warnedOnce = false;

function cacheDisabledReason() {
  if (!process.env.REDIS_URL) return 'REDIS_URL not set';
  if (disabled) return 'Redis unreachable';
  return null;
}

/** Returns a connected client, or null if the cache is unavailable for any reason. */
async function getClient() {
  if (disabled || !process.env.REDIS_URL) return null;
  if (client && client.isReady) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const c = createClient({
        url: process.env.REDIS_URL,
        socket: {
          // Do not retry forever on a host that will never answer: give up and
          // fall through to PostgreSQL rather than hanging every request.
          connectTimeout: 1500,
          reconnectStrategy: (retries) => (retries > 2 ? false : 150),
        },
      });
      // An 'error' listener is mandatory: without one, node-redis emits an
      // unhandled 'error' event and takes the whole process down.
      c.on('error', () => {
        disabled = true;
      });
      await c.connect();
      client = c;
      return c;
    } catch (err) {
      disabled = true;
      if (!warnedOnce) {
        warnedOnce = true;
        console.warn(
          `Redis cache unavailable (${err.message}) — serving from PostgreSQL. This is not fatal.`
        );
      }
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

async function cacheGet(key) {
  try {
    const c = await getClient();
    if (!c) return null;
    const raw = await c.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 60) {
  try {
    const c = await getClient();
    if (!c) return false;
    await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch {
    return false;
  }
}

async function cacheDel(key) {
  try {
    const c = await getClient();
    if (!c) return false;
    await c.del(key);
    return true;
  } catch {
    return false;
  }
}

/** Test/shutdown helper. Safe to call when nothing was ever connected. */
async function cacheQuit() {
  try {
    if (client && client.isOpen) await client.quit();
  } catch {
    /* ignore */
  } finally {
    client = null;
    connecting = null;
  }
}

/** Test helper: forget a previous "Redis is down" verdict. */
function resetCacheState() {
  disabled = false;
  warnedOnce = false;
}

module.exports = {
  getClient,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheQuit,
  resetCacheState,
  cacheDisabledReason,
};
