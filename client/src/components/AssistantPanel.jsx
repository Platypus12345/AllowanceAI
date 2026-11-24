// The v2 assistant. Asks POST /api/assistant/ask, which proxies to the RAG service.
//
// Three decisions worth knowing about:
//
// 1. The panel hides itself when GET /api/assistant/status says the server has no
//    INTERNAL_API_TOKEN. Offering a question box that cannot work is worse than offering
//    nothing — the user blames their question, not the configuration.
//
// 2. Answers show their citations by default, not behind a toggle. This is an assistant
//    talking about someone's money; a claim they cannot check against their own
//    transactions is not worth much. Each citation is tagged with the arm that retrieved
//    it (keyword / semantic / both), which also happens to make the hybrid retrieval
//    visible rather than a claim in a commit message.
//
// 3. When the server reports an answer as ungrounded — a number appearing in it that was
//    in neither the facts nor the retrieved rows — the panel says so, above the answer,
//    and still shows the answer. Silently hiding it would mean the one case where the
//    model invented a figure is the case the user never hears about.

import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

const SUGGESTIONS = [
  'How much have I spent this month?',
  'What am I spending the most on?',
  'Am I on track with my budget?',
];

const ARM_LABEL = {
  both: 'keyword + semantic',
  semantic: 'semantic',
  keyword: 'keyword',
};

function CitationList({ citations }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-4 border-t border-outline-variant/30 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        Based on these transactions
      </p>
      <ul className="mt-2 space-y-1.5">
        {citations.map((c, i) => (
          <li key={`${c.source_id || 'row'}-${i}`} className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xs text-on-surface-variant">{c.text}</span>
            {c.found_by ? (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-on-surface-variant">
                {ARM_LABEL[c.found_by] || c.found_by}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RetrievalDetail({ retrieval }) {
  const [open, setOpen] = useState(false);
  if (!retrieval?.results?.length) return null;

  const byArm = retrieval.by_arm || {};
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
      >
        {open ? 'Hide retrieval detail' : 'How were these found?'}
      </button>
      {open ? (
        <div className="mt-2 rounded-xl bg-surface-container-high p-3 text-xs text-on-surface-variant">
          <p>
            Two searches ran over your transactions and their rankings were fused with
            Reciprocal Rank Fusion (k={retrieval.rrf_k}): a semantic vector search and a
            keyword full-text search. {byArm.both || 0} row(s) were found by both,{' '}
            {byArm.semantic_only || 0} by semantic search alone and {byArm.keyword_only || 0} by
            keyword alone.
          </p>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="pb-1 pr-2">Score</th>
                <th className="pb-1 pr-2">Semantic</th>
                <th className="pb-1 pr-2">Keyword</th>
                <th className="pb-1">Transaction</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {retrieval.results.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/20">
                  <td className="py-1 pr-2">{r.rrf_score?.toFixed(5)}</td>
                  <td className="py-1 pr-2">{r.dense_rank ?? '—'}</td>
                  <td className="py-1 pr-2">{r.lexical_rank ?? '—'}</td>
                  <td className="py-1">{r.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function AssistantPanel() {
  const [configured, setConfigured] = useState(null); // null = still checking
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [backfill, setBackfill] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/assistant/status')
      .then((res) => {
        if (alive) setConfigured(Boolean(res.data?.configured));
      })
      // A failed status check means the assistant is not usable, which is the same
      // outcome as not configured — so hide, rather than show a broken panel.
      .catch(() => {
        if (alive) setConfigured(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(
    async (text) => {
      const q = (text ?? question).trim();
      if (!q || asking) return;
      setAsking(true);
      setError(null);
      setResult(null);
      try {
        const res = await api.post('/assistant/ask', { question: q });
        setResult(res.data);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            'Could not reach the assistant. The AI service may still be waking up.'
        );
      } finally {
        setAsking(false);
      }
    },
    [question, asking]
  );

  const runBackfill = useCallback(async () => {
    setBackfill({ running: true });
    try {
      const res = await api.post('/assistant/reindex');
      setBackfill({ running: false, ...res.data });
    } catch (err) {
      setBackfill({
        running: false,
        error: err.response?.data?.error || 'Could not index your history.',
      });
    }
  }, []);

  // Still checking, or genuinely unavailable: render nothing at all.
  if (configured !== true) return null;

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5">
      <h2 className="text-lg font-bold">Ask about your money</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Answers come from your own transactions. Totals are read straight from the database,
        never estimated.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-4 flex flex-wrap gap-2"
      >
        <label className="sr-only" htmlFor="assistant-question">
          Your question
        </label>
        <input
          id="assistant-question"
          type="text"
          maxLength={1000}
          placeholder="How much did I spend on food this month?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary-container"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="rounded-full bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary-container disabled:opacity-50"
        >
          {asking ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              submit(s);
            }}
            disabled={asking}
            className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-error/40 bg-error-container/20 p-3">
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl bg-surface-container-high p-4">
          {/* Shown above the answer, not instead of it. The one case where the model
              invented a figure must not be the case the user never hears about. */}
          {result.grounded === false ? (
            <div className="mb-3 rounded-lg border border-error/40 bg-error-container/20 p-2.5">
              <p className="text-xs">
                <span className="font-semibold">Check this one.</span> The answer mentions{' '}
                {result.ungrounded_numbers?.join(', ')}, which did not come from your
                transactions or your totals. Trust the dashboard figures over this.
              </p>
            </div>
          ) : null}

          <p className="whitespace-pre-wrap text-sm">{result.answer}</p>

          {result.notes?.some((n) => n.includes('no indexed history')) ? (
            <div className="mt-3 rounded-lg bg-surface-container p-2.5">
              <p className="text-xs text-on-surface-variant">
                None of your transactions are indexed for search yet, so this answer used
                your totals only.
              </p>
              <button
                type="button"
                onClick={runBackfill}
                disabled={backfill?.running}
                className="mt-2 rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                {backfill?.running ? 'Indexing…' : 'Index my history'}
              </button>
              {backfill && !backfill.running ? (
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  {backfill.error
                    ? backfill.error
                    : `Indexed ${backfill.indexed} of ${backfill.transactions} transactions. Ask again.`}
                </p>
              ) : null}
            </div>
          ) : null}

          <CitationList citations={result.citations} />
          <RetrievalDetail retrieval={result.retrieval} />
        </div>
      ) : null}
    </div>
  );
}
