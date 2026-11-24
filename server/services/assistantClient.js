// The only place this API talks to ai-service.
//
// Two jobs, and the first is a security boundary. ai-service's /assistant/* endpoints take
// a `user_id` in the body and return that user's financial history. The browser must never
// be able to choose that value, so the chain is:
//
//     browser -> server/ (verifyJWT establishes WHO) -> ai-service (internal token)
//
// Every function here takes the userId from `req.userId`, never from a request body. A
// `user_id` sent by a client is ignored, not validated — there is no legitimate reason for
// one to arrive, so there is nothing to validate it against.
//
// Second job: every call is non-essential. Indexing a transaction for the assistant must
// never be able to fail the write that created it, and a sleeping ai-service must never
// take the dashboard down with it. So the indexing paths swallow their errors by design and
// the ask path returns a typed failure the route can turn into an honest message.

const DEFAULT_TIMEOUT_MS = 20000;
// Generation waits on an upstream LLM, so it gets its own, longer budget.
const ASK_TIMEOUT_MS = 45000;

function baseUrl() {
  return (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
}

function internalToken() {
  return process.env.INTERNAL_API_TOKEN || '';
}

/** Whether the assistant can be called at all. Checked before dialling, so a missing
 *  token produces a clear message instead of a 401 from another service. */
function isConfigured() {
  return Boolean(internalToken());
}

async function call(path, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!isConfigured()) {
    const err = new Error('INTERNAL_API_TOKEN is not set on the API server');
    err.code = 'ASSISTANT_NOT_CONFIGURED';
    throw err;
  }

  // AbortController rather than relying on a library default: ai-service on a free tier can
  // take 30s+ to wake, and a request with no ceiling would hold a connection indefinitely.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken(),
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { detail: text };
    }

    if (!res.ok) {
      const err = new Error(
        (parsed && (parsed.detail || parsed.error)) || `ai-service returned ${res.status}`
      );
      err.code = res.status === 503 ? 'ASSISTANT_UNAVAILABLE' : 'ASSISTANT_ERROR';
      err.status = res.status;
      throw err;
    }
    return parsed;
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error(`ai-service did not respond within ${timeoutMs}ms`);
      err.code = 'ASSISTANT_TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Ask a question as `userId`. The caller must have established userId from a JWT. */
async function ask(userId, question) {
  return call('/assistant/ask', { user_id: userId, question }, { timeoutMs: ASK_TIMEOUT_MS });
}

/** Retrieval only — no LLM involved, so this works with no model key configured. */
async function retrieveFor(userId, query, { k = 8, mode = 'hybrid' } = {}) {
  return call('/assistant/retrieve', { user_id: userId, query, k, mode });
}

/** Rebuild every document for one user. Used to backfill history. */
async function reindexUser(userId) {
  return call('/assistant/index/user', { user_id: userId });
}

/**
 * Index one transaction, swallowing every failure.
 *
 * Called after a transaction is written. It must never be able to fail that write: a spend
 * the user recorded is the product, and its searchability by the assistant is a
 * convenience. If ai-service is asleep, unconfigured or broken, the transaction is still
 * saved and still on the dashboard — it is just not yet retrievable, which
 * `POST /api/assistant/reindex` repairs.
 *
 * Deliberately not awaited by its callers, and deliberately never rejects, so an unhandled
 * rejection cannot take the process down either.
 */
function indexTransactionInBackground(transactionId) {
  if (!isConfigured()) return;
  call('/assistant/index/transaction', { transaction_id: transactionId }).catch((error) => {
    console.warn(
      `Assistant indexing skipped for transaction ${transactionId}: ${error.code || ''} ${error.message}`
    );
  });
}

module.exports = {
  ask,
  retrieveFor,
  reindexUser,
  indexTransactionInBackground,
  isConfigured,
};
