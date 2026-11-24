// Safety score + safe-to-spend — the Phase 3 dashboard metrics.
//
// Reads the `health` block that GET /api/dashboard/summary now returns. All the
// arithmetic lives in server/services/spendingHealth.js; this file renders it and does
// not recompute anything, so the browser and the API can never disagree about what is
// safe to spend.
//
// Three states, and the third is the interesting one:
//   * scored      — an allowance or monthly budget exists, so there is a real figure
//   * exhausted   — the budget is gone; shown as its own state, never as "safe"
//   * no basis    — nobody has said what there is to spend, so nothing is scored and
//                   the card asks for an allowance instead of inventing a verdict
// A fourth possibility is handled too: an older API that returns no `health` key at all,
// in which case the card renders nothing rather than throwing on undefined.

import { useState } from 'react';
import api from '../api/axios';
import { ProgressRing } from './ui/ProgressRing';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function money(value) {
  return inr.format(Number(value) || 0);
}

// Matches the status bands in server/services/spendingHealth.js. `status` is about
// TODAY'S PACE, so this tone is only ever applied to today's figures.
const TONE = {
  safe: { ring: '#44e2cd', text: 'text-secondary' },
  moderate: { ring: '#8083ff', text: 'text-on-surface' },
  tight: { ring: '#ffb690', text: 'text-tertiary' },
  danger: { ring: '#ffb4ab', text: 'text-error' },
};

// The ring is coloured by the SCORE, not by the status, and this is deliberate.
//
// The two numbers answer different questions: `safetyScore` is how much of the month's
// money survives, and `status` is whether today's pace is sustainable. They legitimately
// disagree — spending 2,144 in one day on a 12,000 allowance leaves 82% of the month
// intact while being 152% of today's safe rate. Both figures are right.
//
// Colouring an 82 ring red because today was heavy made the card read as a contradiction
// (observed in an end-to-end run before this was changed). So the ring tracks the score it
// displays, today's pace gets its own clearly-labelled badge, and the card states in words
// that they measure different things.
function scoreTone(score) {
  if (score >= 60) return { ring: '#44e2cd', text: 'text-secondary' };
  if (score >= 30) return { ring: '#ffb690', text: 'text-tertiary' };
  return { ring: '#ffb4ab', text: 'text-error' };
}

/** Prompt shown when there is no allowance and no monthly budget to divide. */
function SetAllowance({ onSaved }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put('/auth/me/allowance', { allowance: amount });
      setValue('');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5">
      <h2 className="text-lg font-bold">How much do you have this month?</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Tell us your monthly allowance and we will work out what is safe to spend each day.
        Without it there is nothing to divide, so we would rather ask than guess.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-start gap-2">
        <label className="sr-only" htmlFor="allowance-input">
          Monthly allowance in rupees
        </label>
        <input
          id="allowance-input"
          type="number"
          inputMode="decimal"
          min="1"
          step="any"
          placeholder="e.g. 8000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary-container"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary-container disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Set allowance'}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}

export default function SpendingHealthCard({ health, onChanged }) {
  const [showWhy, setShowWhy] = useState(false);

  // An API without the health block (an older deploy) renders nothing rather than
  // crashing the whole dashboard on a missing key.
  if (!health) return null;

  if (!health.basis) {
    return <SetAllowance onSaved={onChanged} />;
  }

  const tone = TONE[health.status] || TONE.moderate;
  const ringTone = scoreTone(health.safetyScore);

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5">
      <div className="flex flex-wrap items-center gap-6">
        <ProgressRing percentage={health.safetyScore} size={116} strokeWidth={10} color={ringTone.ring}>
          <span className={`text-2xl font-extrabold tracking-tight ${ringTone.text}`}>
            {health.safetyScore}%
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
            month left
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-on-surface-variant">Safe to spend today</p>
            <span
              className={`rounded-full bg-surface-container-high px-2.5 py-0.5 text-[11px] font-semibold ${tone.text}`}
            >
              today: {health.statusLabel}
            </span>
          </div>

          <p className={`mt-1 text-4xl font-extrabold tracking-tight ${tone.text}`}>
            {money(health.safeToSpendToday)}
          </p>

          <p className="mt-2 text-sm text-on-surface-variant">
            {health.exhausted ? (
              health.message
            ) : (
              <>
                {money(health.safeToSpendPerDay)}/day for the {health.daysLeft} day
                {health.daysLeft === 1 ? '' : 's'} left ·{' '}
                {money(health.remaining)} of {money(health.budget)} remaining
              </>
            )}
          </p>

          {health.spentToday > 0 && !health.exhausted ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {money(health.spentToday)} already spent today · {money(health.avgDailySpend)}/day
              average so far
            </p>
          ) : null}

          {/* Said in words, because the ring and the badge can legitimately disagree and
              a user should not have to work out why. */}
          {!health.exhausted && health.safetyScore >= 60 && (health.status === 'tight' || health.status === 'danger') ? (
            <p className="mt-2 text-xs text-on-surface-variant">
              Most of your month is still intact — today was just a heavy day.
            </p>
          ) : null}
        </div>
      </div>

      {/* A number a user cannot interrogate is a number they will not trust — and it
          makes the maths reviewable in a demo without opening the source. */}
      <div className="mt-4 border-t border-outline-variant/30 pt-3">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
        >
          {showWhy ? 'Hide the maths' : 'Why am I seeing this?'}
        </button>
        {showWhy ? (
          <dl className="mt-3 space-y-1.5 text-xs text-on-surface-variant">
            <div>
              <dt className="inline font-semibold text-on-surface">Formula: </dt>
              <dd className="inline">{health.explain.formula}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-on-surface">This month: </dt>
              <dd className="inline font-mono">{health.explain.calculation}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-on-surface">Basis: </dt>
              <dd className="inline">{health.explain.basisLabel}</dd>
            </div>
            {health.projectedMonthEndBalance != null ? (
              <div>
                <dt className="inline font-semibold text-on-surface">At this pace: </dt>
                <dd className="inline">
                  {health.projectedMonthEndBalance >= 0
                    ? `${money(health.projectedMonthEndBalance)} left at month end`
                    : `${money(Math.abs(health.projectedMonthEndBalance))} short before month end`}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
