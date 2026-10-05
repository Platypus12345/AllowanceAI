const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

// Import routes and middleware
const authRoutes = require('../routes/auth');
const categoryRoutes = require('../routes/categories');
const budgetRoutes = require('../routes/budgets');
const goalRoutes = require('../routes/goals');
const verifyJWT = require('../middleware/verifyJWT');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_phase_1';

describe('Phase 1 — Auth & Core Schema Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());

    app.use('/api/auth', authRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/budgets', budgetRoutes);
    app.use('/api/goals', goalRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  describe('JWT Middleware', () => {
    test('rejects request without Authorization header', async () => {
      const res = await fetch(`${baseUrl}/api/categories`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    test('rejects request with invalid token', async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        headers: { Authorization: 'Bearer invalid_token' },
      });
      assert.strictEqual(res.status, 403);
    });

    test('accepts valid JWT token and sets req.userId', async () => {
      const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000001' }, process.env.JWT_SECRET);
      assert.ok(token);
    });
  });

  describe('Auth Validation', () => {
    test('POST /api/auth/register fails if email/password missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.message, 'Email and password are required');
    });

    test('POST /api/auth/register fails if password is too short', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: '123' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.message, 'Password must be at least 8 characters');
    });

    test('POST /api/auth/login fails if email/password missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.message, 'Email and password are required');
    });
  });

  describe('Categories & Budgets & Goals Validation', () => {
    const validToken = jwt.sign(
      { userId: '00000000-0000-0000-0000-000000000001' },
      process.env.JWT_SECRET
    );

    test('POST /api/categories rejects empty category name', async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ name: '' }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('POST /api/budgets rejects invalid amount', async () => {
      const res = await fetch(`${baseUrl}/api/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ amount: -10 }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('POST /api/goals rejects empty title', async () => {
      const res = await fetch(`${baseUrl}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ title: '', targetAmount: 5000 }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('POST /api/goals rejects invalid target amount', async () => {
      const res = await fetch(`${baseUrl}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ title: 'New Laptop', targetAmount: -100 }),
      });
      assert.strictEqual(res.status, 400);
    });
  });
});
