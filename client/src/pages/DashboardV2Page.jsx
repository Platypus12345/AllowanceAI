// The v2 dashboard — the first screen in this client that talks to the PostgreSQL API.
//
// Every other page here still calls v1 Mongoose routes (/budget/stats, /expenses, ...),
// which fail once MONGO_URI is removed. This page reads one endpoint,
// GET /api/dashboard/summary, which is backed by Prisma + PostgreSQL and tested.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import AddTransactionForm from '../components/AddTransactionForm';
import useLiveUpdates from '../hooks/useLiveUpdates';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function money(value) {
  return inr.format(Number(value) || 0);
}

function StatCard({ label, value, hint, tone = 'default' }) {
  const toneClass =
    tone === 'warn'
      ? 'text-error'
      : tone === 'good'
        ? 'text-secondary'
        : 'text-on-surface';
  return (
    <div className="rounded-2xl bg-surface-container p-5 border border-outline-variant/40">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold tracking-tight ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

function ProgressBar({ percent, over }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden"
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          over ? 'bg-error' : 'bg-primary-container'
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function SourceTag({ source }) {
  const label =
    source === 'sms' ? 'SMS' : source === 'setu_aa' ? 'Bank' : source === 'manual' ? 'Manual' : source;
  return (
    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
      {label}
    </span>
  );
}

export default function DashboardV2Page() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ fresh = false } = {}) => {
    try {
      setError(null);
      const [sumRes, catRes] = await Promise.all([
        api.get(`/dashboard/summary${fresh ? '?fresh=1' : ''}`),
        api.get('/categories').catch(() => ({ data: [] })),
      ]);
      setSummary(sumRes.data);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (err) {
      console.error('Dashboard load failed', err);
      setError(
        err.response?.data?.error ||
          'Could not load your dashboard. The API may still be waking up — try again in a moment.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A transaction can arrive without this tab doing anything — the mobile SMS parser,
  // a Setu AA pull, another browser. Refetch when the server says so. `fresh` bypasses
  // the 60s cache, which the write already invalidated, but a cache the server could
  // not reach would otherwise leave this showing a stale number.
  const { connected } = useLiveUpdates(
    useCallback(() => {
      load({ fresh: true });
    }, [load])
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface grid place-items-center">
        <p className="text-on-surface-variant">Loading your dashboard…</p>
      </div>
    );
  }

  const spend = summary?.spend || { month: 0, today: 0, transactionCount: 0 };
  const totals = summary?.totals || { budgeted: 0, remaining: 0 };
  const budgets = summary?.budgets || [];
  const goals = summary?.goals || [];
  const recent = summary?.recentTransactions || [];

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {user?.name ? `Hey, ${user.name.split(' ')[0]}` : 'Your money'}
            </h1>
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              This month so far
              {connected ? (
                <span className="flex items-center gap-1.5 text-secondary">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary" />
                  Live
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load({ fresh: true })}
              className="rounded-full border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container"
            >
              Refresh
            </button>
            {logout ? (
              <button
                onClick={logout}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container"
              >
                Log out
              </button>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-error/40 bg-error-container/20 p-4">
            <p className="text-sm">{error}</p>
            <button
              onClick={() => load({ fresh: true })}
              className="mt-3 rounded-full bg-primary-container px-4 py-1.5 text-sm text-on-primary-container font-semibold"
            >
              Retry
            </button>
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Spent this month" value={money(spend.month)} hint={`${spend.transactionCount} transactions`} />
          <StatCard label="Spent today" value={money(spend.today)} />
          <StatCard
            label="Left of budget"
            value={money(totals.remaining)}
            hint={totals.budgeted > 0 ? `of ${money(totals.budgeted)} budgeted` : 'No budget set yet'}
            tone={totals.budgeted > 0 && totals.remaining < 0 ? 'warn' : 'good'}
          />
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">Add a spend</h2>
          <p className="text-sm text-on-surface-variant">
            Cash, or anything your bank did not text you about.
          </p>
          <div className="mt-3">
            <AddTransactionForm categories={categories} onAdded={() => load({ fresh: true })} />
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-bold">Budgets</h2>
            {budgets.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">
                No budgets yet. Create one and it will track itself from your transactions.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {budgets.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-2xl bg-surface-container p-4 border border-outline-variant/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{b.categoryName}</span>
                      <span className={`text-sm ${b.overBudget ? 'text-error' : 'text-on-surface-variant'}`}>
                        {money(b.spent)} / {money(b.amount)}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar percent={b.percentUsed} over={b.overBudget} />
                    </div>
                    <p className={`mt-2 text-xs ${b.overBudget ? 'text-error' : 'text-on-surface-variant'}`}>
                      {b.overBudget
                        ? `Over by ${money(Math.abs(b.remaining))}`
                        : `${money(b.remaining)} left · ${b.percentUsed}% used`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold">Goals</h2>
            {goals.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">No goals yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {goals.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-2xl bg-surface-container p-4 border border-outline-variant/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{g.title}</span>
                      <span className="text-sm text-on-surface-variant">
                        {money(g.currentAmount)} / {money(g.targetAmount)}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar percent={g.percent} over={false} />
                    </div>
                    <p className="mt-2 text-xs text-on-surface-variant">{g.percent}% saved</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold">Recent transactions</h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">
              Nothing yet. Add a spend above, or sync your SMS.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-outline-variant/30 rounded-2xl bg-surface-container border border-outline-variant/40">
              {recent.map((t) => {
                const isCredit = t.amount < 0;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{t.merchant || 'Unknown'}</span>
                        <SourceTag source={t.source} />
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(t.occurredAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {t.categoryName ? ` · ${t.categoryName}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 font-semibold ${isCredit ? 'text-secondary' : ''}`}>
                      {isCredit ? '+' : '−'}
                      {money(Math.abs(t.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
