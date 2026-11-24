// Holding screen for the v1 screens that have not been ported to the v2 API yet.
//
// Why this exists rather than just leaving the routes pointing at the old pages:
// every screen listed below fetches a v1 Mongoose route (/jars, /wishlist,
// /budget/stats, /analytics/wrapped, /user/personality, /requests, ...). Production
// has no MONGO_URI any more, so those requests do not degrade — they 500, and the
// page renders an error state or a blank screen. A typed URL, a stale bookmark or a
// back button was enough to land on one.
//
// The v1 page components are deliberately NOT deleted. They are the reference for the
// port (see Tracker.md), and deleting them would lose the UI work. They are just no
// longer reachable by a route until the data layer behind them is real.

import { Link, useLocation } from 'react-router-dom';

// What each retired route was, and what it needs before it can come back. Keyed by
// path so one component serves them all and the copy stays specific — a generic
// "coming soon" tells a user nothing about whether their data is safe.
const RETIRED = {
  '/v1': {
    name: 'The old dashboard',
    was: 'The v1 dashboard — spending overview, recent expenses, split reminders.',
    needs: 'Superseded. Everything it did now lives on the dashboard, reading PostgreSQL.',
    superseded: true,
  },
  '/jars': {
    name: 'Savings jars',
    was: 'Virtual envelopes you moved allowance between, with AI jar suggestions.',
    needs: 'A `jars` table on PostgreSQL. The v1 version stored them in MongoDB.',
  },
  '/wishlist': {
    name: 'Wishlist',
    was: 'Tracked items you were saving for, with price-drop checks and AI buy/wait advice.',
    needs: 'A `wishlist_items` table, plus the price scraper moved off the v1 models.',
  },
  '/wrapped': {
    name: 'Financial Wrapped',
    was: 'A year-in-review story of where your money went.',
    needs: 'The Phase 6 monthly aggregation job. Scheduled, not dropped.',
  },
  '/request-money': {
    name: 'Request money',
    was: 'Asked a linked parent for allowance over UPI or WhatsApp.',
    needs: 'The `allowance_requests` and `friends` tables ported to PostgreSQL.',
  },
  '/profile/ai-personality': {
    name: 'AI personality',
    was: 'Chose the tone the assistant replies in.',
    needs: 'The Phase 4 assistant itself. Picking a voice for an assistant that does not answer yet would be backwards.',
  },
};

const FALLBACK = {
  name: 'This screen',
  was: 'A v1 screen backed by MongoDB.',
  needs: 'A port to the v2 PostgreSQL API.',
};

export default function V1RetiredPage() {
  const { pathname } = useLocation();
  const info = RETIRED[pathname] || FALLBACK;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          {info.superseded ? 'Replaced' : 'Being rebuilt'}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{info.name}</h1>

        <div className="mt-8 rounded-2xl border border-outline-variant/40 bg-surface-container p-6">
          <dl className="space-y-5 text-sm">
            <div>
              <dt className="font-semibold text-on-surface">What it did</dt>
              <dd className="mt-1 text-on-surface-variant">{info.was}</dd>
            </div>
            <div>
              <dt className="font-semibold text-on-surface">
                {info.superseded ? 'Where it went' : 'What it is waiting on'}
              </dt>
              <dd className="mt-1 text-on-surface-variant">{info.needs}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-6 text-sm text-on-surface-variant">
          AllowanceAI is being rebuilt on PostgreSQL. The dashboard, budgets, goals,
          transactions and SMS ingestion are already on the new backend.{' '}
          <span className="text-on-surface">No data was deleted</span> — these screens are
          unrouted, not removed.
        </p>

        <Link
          to="/"
          className="mt-8 inline-block rounded-full bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary-container"
        >
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
