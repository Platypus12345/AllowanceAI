# AllowanceAI

A personal-finance assistant for students. Transactions arrive on their own — parsed from
bank SMS on Android, or pulled through India's Account Aggregator framework — and an
assistant answers questions about them, grounded in the user's actual data.

**Currently a v2 rebuild in progress.** v1 shipped on MongoDB; v2 is a from-scratch
rebuild on PostgreSQL + pgvector in this same repository. Some v1 screens are not ported
yet and this README says which — see [Status](#status).

| | |
|---|---|
| **Web app** | https://allowance-ai-eight.vercel.app |
| **API** | https://allowanceai-api.onrender.com |
| **AI service** | https://allowanceai-ai.onrender.com |

> Free-tier hosting: the first request after a quiet spell wakes the instance and can take
> 30–60 seconds. That is the host, not the app.

---

## What it does

**The loop that works end to end today:** sign up → set a monthly allowance → spends arrive
(hand-entered, SMS-parsed, or bank-pulled) → the dashboard shows what is safe to spend today
→ ask the assistant about it in plain English.

- **Automatic ingestion.** Bank/UPI SMS parsed on-device (Android), and Setu Account
  Aggregator in sandbox. Both land in one `transactions` table; everything downstream is
  source-agnostic. The same spend arriving twice — SMS then bank, or SMS then hand-keyed —
  is **flagged**, not silently double-counted.
- **Safe-to-spend.** `money left ÷ days left`, with a safety score, and a "why am I seeing
  this?" disclosure that shows the actual division. A number you cannot interrogate is a
  number you will not trust.
- **A grounded assistant.** Hybrid retrieval over your own transactions, with every answer
  showing the transactions it used. Totals come from SQL, never from the model.

## Architecture

```
client/        React 19 + Vite + Tailwind v4  (Vercel)      — PWA
server/        Node 20 + Express 5 + Prisma   (Render)      — auth, CRUD, ingestion
ai-service/    Python 3.11 + FastAPI          (Render)      — retrieval + LangGraph
mobile/        Expo / React Native                          — SMS ingestion (Android)
               PostgreSQL 16 + pgvector       (Supabase)    — one database for both services
               Redis (optional), RabbitMQ                   — cache, queue
```

**Why PostgreSQL replaced MongoDB:** the data is relational (users → accounts →
transactions → categories → budgets), the aggregations are the product, and pgvector means
the vector index lives in the same database as the rows it describes — one backup, one
consistency model, no second stateful service to operate.

### The assistant

```
question → ┌─ retrieve ─┐ → rules → generate → answer + citations
           │ dense (HNSW cosine over embeddings)
           │ lexical (Postgres full-text over a generated tsvector)
           └ fused with Reciprocal Rank Fusion, k=60
```

Three decisions worth calling out:

1. **Retrieval and "the numbers" are separate paths.** A retrieved sentence is evidence
   that a transaction exists; it is never the authority on a total. Every amount, budget
   and count comes from a direct SQL aggregate, and the prompt explicitly forbids the model
   from summing retrieved rows — retrieval returns at most 8, so adding them up would
   understate any real month.
2. **Hybrid, because pure vector search is weakest where a finance assistant must be
   strongest.** Exact tokens — a merchant name, a UPI handle, a reference number. RRF is
   used because it consumes *ranks* rather than scores, which removes the unanswerable
   question of how to normalise `ts_rank_cd` against a cosine distance.
3. **One transaction row becomes one templated sentence. No chunking.** Sliding-window
   chunkers on structured financial rows produce 80–94% token overlap, which stuffs
   near-duplicate text into the prompt and makes models hallucinate numbers — the worst
   failure mode this product has.

Embeddings are `bge-small-en-v1.5` at 384 dimensions, run locally on onnxruntime. No
embedding API, so no per-day quota on a path that runs for *every ingested transaction*, no
key to leak, and the retrieval tests run free in CI.

## Status

Honest, because a demo that clicks into a 500 is worse than one with fewer screens.

| Area | State |
|---|---|
| Auth (JWT + Google OAuth) | ✅ on PostgreSQL |
| Categories / budgets / goals | ✅ on PostgreSQL |
| SMS ingestion + duplicate detection | ✅ on PostgreSQL |
| Setu AA (sandbox) ingestion | ✅ server-side; browser consent click-through not built |
| Dashboard, safe-to-spend, live updates | ✅ on PostgreSQL, websocket push |
| RAG assistant | ✅ built and tested; needs one shared secret set in production |
| Eval + guardrails (Ragas, Langfuse) | ⬜ Phase 5, not started |
| Gamification, Financial Wrapped | ⬜ Phase 6, not started |
| Jars, wishlist, splits, request-money | ⬜ v1 screens, **not ported** — routed to a holding page that says so |
| Password reset | ⬜ needs reset-token columns + SMTP; the screen says so rather than pretending |
| Rate limiting, Sentry, field encryption | ⬜ Phase 7, not started |

Retired v1 routes serve a page naming what the screen did and what it is waiting on,
instead of calling a MongoDB endpoint that no longer exists. The page components are kept
in the tree as the reference for porting them.

## Engineering notes

Four bugs found by writing tests rather than by reading code. They are the most useful
thing in this repository.

- **`is_default` privilege escalation.** `POST /api/categories` trusted a client-supplied
  `isDefault`, and `GET` returns every default category regardless of owner — so any user
  could publish a category into every other user's list. Found by writing the missing
  ownership test.
- **v1 congratulated you for being broke.** `financialHealth.js` computed
  `usageRatio = limit > 0 ? spentToday / limit : 0`. The limit goes non-positive exactly
  when you have spent your whole allowance, so the ternary forced the ratio to 0 and the
  status came back **`SAFE` with a score of 100** — in the one situation where the warning
  matters most. Fixed in the v2 port; a test fails if the ternary returns.
- **"Hybrid" retrieval was silently dense-only.** `websearch_to_tsquery` joins terms with
  **AND**, so *"how much did I spend at ZORVEX PANTRY"* parses to
  `'much' & 'spend' & 'zorvex' & 'pantri'` — and a transaction sentence has the merchant
  but none of the filler. The match fails, nothing errors, and the lexical arm contributes
  nothing to any natural-language question. Caught by a test asserting the target row was
  found by *both* arms.
- **The CI gate for `ai-service` could not fail.** Its test step ended with
  `|| echo "No tests yet — stub passes."`, discarding pytest's exit code. Harmless while
  the suite was empty; not harmless with 76 tests behind it.

**A measured negative result, kept rather than buried.** Hybrid retrieval was adopted citing
a published benchmark of 73% → 100% Recall@1. On this project's data the gap is much
narrower: for a distinctive merchant name or a UPI handle, dense search alone already ranks
the right row first, because subword tokenisation handles invented brand tokens well. The
measured win is specifically on numeric and reference-style identifiers:

| Question | Dense | Lexical | Hybrid |
|---|---|---|---|
| `transaction with reference 884421` | #2 | #1 | **#1** |
| `how much did I spend at ZORVEX PANTRY` | #1 | #1 | #1 |
| `what did I pay qwertybakery@okaxis` | #1 | #1 | #1 |

Fusing also has a measured *cost*: a row only the semantic arm found carries one RRF term
against two, so it can be demoted a place or two. All three behaviours are pinned by tests,
and the headline test carries a guard assertion that **fails if the corpus stops exercising
the hybrid case** — so the claim cannot decay into passing for the wrong reason.

## Tests

No mocked databases. The claims are about PostgreSQL, pgvector and HNSW behaviour, so
mocking would turn them into claims about the mock. The LLM is always a stand-in, so the
whole suite runs with no API key.

```bash
docker compose up -d                     # postgres (host 5433), redis, rabbitmq

cd server && npx prisma migrate deploy && npm test     # 65 tests
cd ai-service && pytest -q                             # 76 tests
```

Several tests carry a **negative control** — a note of which assertions fail if the fix
they cover is reverted. A test that cannot fail is documentation, not a test.

## Local setup

**Prerequisites:** Node 20+, Python 3.11+, Docker.

```bash
git clone https://github.com/Platypus12345/AllowanceAI.git
cd AllowanceAI/allowance-ai

docker compose up -d

cd server     && npm install && npx prisma migrate deploy && cd ..
cd client     && npm install && cd ..
cd ai-service && python -m venv venv && venv/Scripts/activate && pip install -r requirements.txt && cd ..
```

Copy each `.env.example` to `.env` and fill it in. Nothing secret is committed, and
`.env.example` carries placeholders only.

```bash
cd server     && npm run dev                                 # :5000
cd ai-service && uvicorn main:app --reload --port 8000       # :8000
cd client     && npm run dev                                 # :5173
cd mobile     && npx expo start                              # optional, Android
```

**Two things to know.** Local compose maps Postgres to host **5433**, because a native
Postgres often already owns 5432. And `INTERNAL_API_TOKEN` must be set to the *same* value
in `server/.env` and `ai-service/.env` or the assistant will not answer — it has no
development default on purpose, since a default would be a hardcoded credential in a public
repository.

## Deployment

`render.yaml` is a Render blueprint creating both services; the client deploys to Vercel
with root directory `client` and `VITE_API_URL` pointing at the API (no `/api` suffix —
Vite bakes env vars in at build time, so changing it needs a rebuild).

Migrations are **not** run on deploy. `prisma migrate deploy` is a manual, reviewed step so
a bad deploy can never silently alter the production database. See
[DEPLOYMENT.md](DEPLOYMENT.md).

The assistant needs `INTERNAL_API_TOKEN` set identically on both services, and
`DATABASE_URL` on `allowanceai-ai`. Unset is a safe state, not a broken one: `ai-service`
answers 503 on every `/assistant/*` endpoint, the API reports `configured: false`, and the
client hides the assistant panel. The dashboard and ingestion are unaffected — the
assistant is additive and cannot take the core loop down with it.

## Project documents

| Doc | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Vision, features, non-goals |
| [docs/TechSpec.md](docs/TechSpec.md) | Stack choices and why, env vars, the retrieval design |
| [docs/Schema.md](docs/Schema.md) | Tables, Redis keys, pgvector notes |
| [docs/ImplementationPlan.md](docs/ImplementationPlan.md) | Phase order with Definition-of-Done gates |
| [docs/Proposals.md](docs/Proposals.md) | Reviewed stack proposals, with what was accepted and rejected |
| [Tracker.md](Tracker.md) | Live task board and the evidence behind each delivered phase |
| [Rules.md](Rules.md) | Golden rules, tool mandates, testing requirements |

## License

MIT.
