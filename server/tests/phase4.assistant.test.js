// Phase 4 — the assistant proxy in server/.
//
// ai-service is stood up as a real local HTTP server rather than mocked. That is the point
// of these tests: what matters is the *wire* — which user_id leaves this process, which
// header goes with it, and what happens when the far end is slow, broken or absent. A
// mocked client would assert none of that.
//
// The headline test is `a client cannot ask about another user`. ai-service answers about
// whatever user_id it receives, so the decision about which user is being asked about
// belongs entirely to this layer, where there is a JWT. If that is wrong, every user's
// spending history is readable by every other user.

const { spawnSync } = require('node:child_process');
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_4';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const INTERNAL_TOKEN = 'phase4-test-internal-token';

const authRoutes = require('../routes/auth');
const assistantRoutes = require('../routes/assistant');
const { cacheQuit } = require('../config/redis');

const stamp = `${Date.now()}-${process.pid}`;

describe('Phase 4 — assistant proxy', () => {
  let server;
  let baseUrl;
  let fake; // the stand-in ai-service
  let fakeUrl;
  let verifyClient;
  const userIds = [];

  // What the fake ai-service saw and what it should do next.
  let received = [];
  let respondWith = { status: 200, body: { answer: 'ok' } };
  let delayMs = 0;

  async function makeUser(label) {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `assistant-${label}-${stamp}@example.com`,
        password: 'correcthorse8',
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    userIds.push(body.user.id);
    return {
      id: body.user.id,
      token: body.token,
      api: async (p, init = {}) => {
        const r = await fetch(`${baseUrl}${p}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${body.token}`,
            ...(init.headers || {}),
          },
        });
        const text = await r.text();
        return { status: r.status, body: text ? JSON.parse(text) : null, text };
      },
    };
  }

  before(async () => {
    verifyClient = new PrismaClient();
    try {
      await verifyClient.$queryRawUnsafe('SELECT 1 FROM users LIMIT 1');
    } catch {
      const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env },
        encoding: 'utf8',
        shell: true,
      });
      if (migrate.status !== 0) {
        throw new Error(
          'prisma migrate deploy failed (is docker-compose postgres up on 5433?).\n' +
            `stdout:\n${migrate.stdout}\nstderr:\n${migrate.stderr}`
        );
      }
    }

    // A real HTTP server playing the part of ai-service, recording every request.
    fake = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        received.push({
          path: req.url,
          token: req.headers['x-internal-token'],
          body: raw ? JSON.parse(raw) : null,
        });
        const send = () => {
          res.writeHead(respondWith.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(respondWith.body));
        };
        if (delayMs > 0) setTimeout(send, delayMs);
        else send();
      });
    });
    await new Promise((resolve) => {
      fake.listen(0, '127.0.0.1', () => {
        fakeUrl = `http://127.0.0.1:${fake.address().port}`;
        resolve();
      });
    });

    process.env.AI_SERVICE_URL = fakeUrl;
    process.env.INTERNAL_API_TOKEN = INTERNAL_TOKEN;

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/assistant', assistantRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    received = [];
    respondWith = { status: 200, body: { answer: 'ok', citations: [] } };
    delayMs = 0;
    process.env.INTERNAL_API_TOKEN = INTERNAL_TOKEN;
    process.env.AI_SERVICE_URL = fakeUrl;
  });

  after(async () => {
    try {
      for (const id of userIds) {
        await verifyClient.user.delete({ where: { id } }).catch(() => {});
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (fake) await new Promise((resolve) => fake.close(resolve));
      if (verifyClient) await verifyClient.$disconnect();
      await cacheQuit();
    }
  });

  test('a client cannot ask about another user', async () => {
    // THE test in this file. ai-service answers about whatever user_id it is handed, so
    // this layer is the only thing deciding whose money is discussed.
    const victim = await makeUser('victim');
    const attacker = await makeUser('attacker');

    const res = await attacker.api('/api/assistant/ask', {
      method: 'POST',
      // Every shape an attacker might try, in one request.
      body: JSON.stringify({
        question: 'what did they spend?',
        user_id: victim.id,
        userId: victim.id,
        user: victim.id,
      }),
    });
    assert.equal(res.status, 200, res.text);

    assert.equal(received.length, 1);
    assert.equal(
      received[0].body.user_id,
      attacker.id,
      'the proxy forwarded a client-supplied user_id instead of the JWT subject'
    );
    assert.notEqual(received[0].body.user_id, victim.id);
  });

  test('the same holds for retrieve and reindex, not only ask', async () => {
    const victim = await makeUser('victim2');
    const attacker = await makeUser('attacker2');

    await attacker.api('/api/assistant/retrieve', {
      method: 'POST',
      body: JSON.stringify({ query: 'anything', user_id: victim.id }),
    });
    await attacker.api('/api/assistant/reindex', {
      method: 'POST',
      body: JSON.stringify({ user_id: victim.id }),
    });

    assert.equal(received.length, 2);
    for (const r of received) {
      assert.equal(r.body.user_id, attacker.id, `${r.path} used a client-supplied user_id`);
    }
  });

  test('every route requires a valid JWT', async () => {
    for (const route of ['/api/assistant/ask', '/api/assistant/retrieve', '/api/assistant/reindex']) {
      for (const headers of [{}, { Authorization: 'Bearer junk' }]) {
        const res = await fetch(`${baseUrl}${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ question: 'q', query: 'q' }),
        });
        assert.ok(res.status === 401 || res.status === 403, `${route} allowed ${JSON.stringify(headers)}`);
      }
    }
    assert.equal(received.length, 0, 'an unauthenticated request still reached ai-service');
  });

  test('the internal token is sent, and never the user JWT', async () => {
    const user = await makeUser('token');
    await user.api('/api/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'how much did I spend' }),
    });

    assert.equal(received[0].token, INTERNAL_TOKEN);
    // Forwarding the user's JWT onward would widen the blast radius of a compromised
    // ai-service from "reads the database" to "acts as that user against this API".
    assert.ok(!JSON.stringify(received[0].body).includes(user.token));
  });

  test('a blank, missing or oversized question is rejected before any outbound call', async () => {
    const user = await makeUser('validate');

    for (const body of [{}, { question: '' }, { question: '   ' }, { question: 123 }, { question: 'x'.repeat(1001) }]) {
      const res = await user.api('/api/assistant/ask', { method: 'POST', body: JSON.stringify(body) });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(received.length, 0, 'an invalid question still reached ai-service');
  });

  test('retrieve validates mode and k before any outbound call', async () => {
    const user = await makeUser('validate2');

    for (const body of [
      { query: 'q', mode: 'bm25' },
      { query: 'q', k: 0 },
      { query: 'q', k: 51 },
      { query: 'q', k: 2.5 },
      { query: '' },
    ]) {
      const res = await user.api('/api/assistant/retrieve', { method: 'POST', body: JSON.stringify(body) });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(received.length, 0);
  });

  test('a question is trimmed and forwarded intact', async () => {
    const user = await makeUser('forward');
    await user.api('/api/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: '  how much did I spend at ZORVEX PANTRY?  ' }),
    });
    assert.equal(received[0].body.question, 'how much did I spend at ZORVEX PANTRY?');
    assert.equal(received[0].path, '/assistant/ask');
  });

  test('ai-service 503 is passed through as 503 with its own reason', async () => {
    // "No LLM key" and "no internal token" are both 503 from ai-service and need
    // different fixes, so the detail is forwarded rather than flattened.
    const user = await makeUser('unavailable');
    respondWith = { status: 503, body: { detail: 'No OPENROUTER_API_KEY or OPENAI_API_KEY is set' } };

    const res = await user.api('/api/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'how much did I spend' }),
    });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /OPENROUTER_API_KEY/);
    assert.equal(res.body.code, 'ASSISTANT_UNAVAILABLE');
  });

  test('an unconfigured server says so instead of calling ai-service', async () => {
    const user = await makeUser('notconfigured');
    delete process.env.INTERNAL_API_TOKEN;

    const res = await user.api('/api/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'how much did I spend' }),
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'ASSISTANT_NOT_CONFIGURED');
    assert.match(res.body.error, /INTERNAL_API_TOKEN/);
    assert.equal(received.length, 0, 'dialled ai-service with no token to send');
  });

  test('status lets the client hide the assistant rather than offer a box that cannot work', async () => {
    const user = await makeUser('status');

    assert.deepEqual((await user.api('/api/assistant/status')).body, { configured: true });

    delete process.env.INTERNAL_API_TOKEN;
    assert.deepEqual((await user.api('/api/assistant/status')).body, { configured: false });
  });

  test('an upstream error becomes 502, not a leaked stack trace', async () => {
    const user = await makeUser('broken');
    respondWith = { status: 500, body: { detail: 'Traceback (most recent call last): secret internals' } };

    const res = await user.api('/api/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'how much did I spend' }),
    });
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'ASSISTANT_ERROR');
    assert.ok(!res.text.includes('Traceback'), 'upstream internals reached the client');
    assert.ok(!res.text.includes('secret internals'));
  });

  test('indexing a transaction never rejects, even with ai-service gone', async () => {
    // The contract that keeps the assistant from being able to break a spend write: it is
    // fire-and-forget and must never produce an unhandled rejection either.
    const { indexTransactionInBackground } = require('../services/assistantClient');

    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1'; // nothing listens here
    assert.doesNotThrow(() => indexTransactionInBackground('11111111-1111-1111-1111-111111111111'));

    delete process.env.INTERNAL_API_TOKEN;
    assert.doesNotThrow(() => indexTransactionInBackground('11111111-1111-1111-1111-111111111111'));

    // Give the failed fetch a moment to settle; an unhandled rejection would surface here.
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
});
