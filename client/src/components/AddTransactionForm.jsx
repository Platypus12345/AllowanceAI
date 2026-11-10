// Posts to the v2 Prisma endpoint POST /api/transactions.
//
// The server stores a debit positive and a credit negative so spend SUMs agree across
// sms / setu_aa / manual. This form sends `direction` and never a pre-signed amount, so
// the convention stays owned by one place (the server) rather than two.

import { useState } from 'react';
import api from '../api/axios';

export default function AddTransactionForm({ categories = [], onAdded }) {
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [direction, setDirection] = useState('debit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const numeric = Number(amount);
    if (!amount || Number.isNaN(numeric) || numeric <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/transactions', {
        amount: numeric,
        merchant: merchant.trim() || null,
        categoryId: categoryId || null,
        direction,
      });

      // The server flags a spend that repeats one already ingested from SMS or the bank
      // instead of rejecting it. Say so, or the total looks wrong to the user.
      if (res.data?.duplicateOf) {
        setNotice(
          'Saved, but it looks like a duplicate of a transaction already recorded, so it is not counted in your spend.'
        );
      } else {
        setNotice('Saved.');
      }

      setAmount('');
      setMerchant('');
      setCategoryId('');
      if (onAdded) onAdded();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save that. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-surface-container p-4 border border-outline-variant/40"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs text-on-surface-variant">Amount</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="240"
            className="mt-1 w-full rounded-xl bg-surface-container-high px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
          />
        </label>

        <label className="block">
          <span className="text-xs text-on-surface-variant">What for</span>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Campus canteen"
            className="mt-1 w-full rounded-xl bg-surface-container-high px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
          />
        </label>

        <label className="block">
          <span className="text-xs text-on-surface-variant">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-xl bg-surface-container-high px-3 py-2 text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-primary-container px-5 py-2.5 font-semibold text-on-primary-container disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Add'}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {['debit', 'credit'].map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="radio"
              name="direction"
              value={d}
              checked={direction === d}
              onChange={() => setDirection(d)}
            />
            {d === 'debit' ? 'Money out' : 'Money in'}
          </label>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-secondary">{notice}</p> : null}
    </form>
  );
}
