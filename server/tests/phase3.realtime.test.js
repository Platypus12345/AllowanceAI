// Phase 3 DoD — "adding a transaction updates the dashboard live, no refresh needed".
//
// This is the server half: a real websocket client connects to a real HTTP server, a
// transaction is created over HTTP, and the push must arrive unprompted.
//
// The authentication tests are the ones that matter most. The browser WebSocket API
// cannot send an Authorization header, so the JWT travels in the query string — an easy
// place to accidentally accept anything. An unauthenticated socket that is merely left
// open and silent would look identical to a working one in a browser, so it is closed.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { cacheQuit } = require('../config/redis');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_3';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const authRoutes = require('../routes/auth');
const transactionRoutes = require('../routes/transactions');
const realtime = require('../services/realtime');

const stamp = `${Date.now()}-${process.pid}`;

async function readJson(res) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

// Messages are buffered from the moment the socket is created, not from when a test
// gets around to listening. The server sends `connected` the instant it accepts the
// connection, and ws drops any message that arrives with no 'message' listener
// attached — so listening after 'open' resolves loses it to a race.
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.received = [];

    socket.on('message', (raw) => {
      try {
        socket.received.push(JSON.parse(raw.toString()));
      } catch {
        /* ignore non-JSON */
      }
    });

    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('timed out opening socket'));
    }, 5000);

    socket.on('open', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Resolve with a message of `type` — already buffered or newly arriving. */
function nextMessage(socket, type, ms = 5000) {
  const alreadyHere = socket.received.findIndex((m) => m.type === type);
  if (alreadyHere !== -1) {
    return Promise.resolve(socket.received.splice(alreadyHere, 1)[0]);
  }

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + ms;
    const poll = setInterval(() => {
      const i = socket.received.findIndex((m) => m.type === type);
      if (i !== -1) {
        clearInterval(poll);
        resolve(socket.received.splice(i, 1)[0]);
        return;
      }
      if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error(`no "${type}" message within ${ms}ms`));
      }
    }, 25);
  });
}

describe('Phase 3 — websocket push on a new transaction', () => {
  let server;
  let baseUrl;
  let wsBase;
  let verifyClient;
  const userIds = [];
  const sockets = [];

  async function makeUser(label) {
    const res = await readJson(
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `rt-${label}-${stamp}@example.com`,
          password: 'correcthorse8',
        }),
      })
    );
    assert.equal(res.status, 201, res.text);
    userIds.push(res.body.user.id);
    const token = res.body.token;
    return {
      id: res.body.user.id,
      token,
      api: (p, init = {}) =>
        fetch(`${baseUrl}${p}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init.headers || {}),
          },
        }).then(readJson),
    };
  }

  async function openSocket(token) {
    const socket = await connect(`${wsBase}/ws?token=${encodeURIComponent(token)}`);
    sockets.push(socket);
    return socket;
  }

  before(async () => {
    verifyClient = new PrismaClient();

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/transactions', transactionRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        wsBase = `ws://127.0.0.1:${port}`;
        resolve();
      });
    });

    realtime.attach(server);
  });

  after(async () => {
    for (const s of sockets) {
      try {
        s.terminate();
      } catch {
        /* ignore */
      }
    }
    try {
      await realtime.close();
      for (const id of userIds) {
        await verifyClient.user.delete({ where: { id } }).catch(() => {});
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (verifyClient) await verifyClient.$disconnect();
      await cacheQuit();
    }
  });

  test('creating a transaction pushes to that user, with no request from the client', async () => {
    const user = await makeUser('push');
    const socket = await openSocket(user.token);
    await nextMessage(socket, 'connected');

    // Arm the listener BEFORE the write, or the push can arrive first and be missed.
    const pushed = nextMessage(socket, 'transaction.created');

    const created = await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 99, merchant: 'Live Update', direction: 'debit' }),
    });
    assert.equal(created.status, 201, created.text);

    const message = await pushed;
    assert.equal(message.type, 'transaction.created');
  });

  test('a push goes only to its own user, never to another', async () => {
    const alice = await makeUser('alice');
    const bob = await makeUser('bob');

    const aliceSocket = await openSocket(alice.token);
    const bobSocket = await openSocket(bob.token);
    await Promise.all([nextMessage(aliceSocket, 'connected'), nextMessage(bobSocket, 'connected')]);

    const aliceGets = nextMessage(aliceSocket, 'transaction.created');
    // Bob must receive nothing. Assert by timing out, which is the only honest way
    // to show the absence of a message.
    const bobGets = nextMessage(bobSocket, 'transaction.created', 1500).then(
      () => 'RECEIVED',
      () => 'nothing'
    );

    const created = await alice.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 55, merchant: 'Alice Only', direction: 'debit' }),
    });
    assert.equal(created.status, 201, created.text);

    await aliceGets;
    assert.equal(await bobGets, 'nothing', 'Bob must not see another user transaction');
  });

  test('every open socket for the same user is notified', async () => {
    const user = await makeUser('multi');
    const phone = await openSocket(user.token);
    const laptop = await openSocket(user.token);
    await Promise.all([nextMessage(phone, 'connected'), nextMessage(laptop, 'connected')]);

    assert.equal(realtime.connectionCount(user.id), 2, 'both sockets are registered');

    const both = Promise.all([
      nextMessage(phone, 'transaction.created'),
      nextMessage(laptop, 'transaction.created'),
    ]);

    await user.api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 20, merchant: 'Two Devices', direction: 'debit' }),
    });

    const results = await both;
    assert.equal(results.length, 2, 'phone and laptop both got the push');
  });

  test('a socket with no token, a junk token, or one signed with the wrong secret is closed', async () => {
    const cases = [
      [`${wsBase}/ws`, 'no token at all'],
      [`${wsBase}/ws?token=not-a-jwt`, 'junk token'],
      [
        `${wsBase}/ws?token=${jwt.sign({ userId: 'abc' }, 'the-wrong-secret')}`,
        'valid JWT signed with the wrong secret',
      ],
    ];

    for (const [url, label] of cases) {
      const code = await new Promise((resolve) => {
        const socket = new WebSocket(url);
        const timer = setTimeout(() => {
          socket.terminate();
          resolve('STAYED_OPEN');
        }, 3000);
        socket.on('close', (c) => {
          clearTimeout(timer);
          resolve(c);
        });
        socket.on('error', () => {
          clearTimeout(timer);
          resolve('error');
        });
      });

      assert.notEqual(code, 'STAYED_OPEN', `${label} must not be left connected`);
    }
  });

  test('a closed socket is forgotten, so dead connections do not accumulate', async () => {
    const user = await makeUser('cleanup');
    const socket = await openSocket(user.token);
    await nextMessage(socket, 'connected');
    assert.equal(realtime.connectionCount(user.id), 1);

    await new Promise((resolve) => {
      socket.on('close', resolve);
      socket.close();
    });

    // The close handler runs on the server's own event loop turn.
    const deadline = Date.now() + 3000;
    while (realtime.connectionCount(user.id) !== 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(realtime.connectionCount(user.id), 0, 'the socket was removed on close');
  });
});
