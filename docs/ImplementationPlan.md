# AllowanceAI — Implementation Plan

Each phase has a goal, key tasks, dependencies, and a definition of done. Don't start a phase until the previous one's DoD is actually met — this is what keeps an agentic coding tool from stacking broken layers.

## Phase 0 — Infra scaffold
**Goal:** a working, empty skeleton everything else builds on.
- Restructure repo: `client/`, `server/`, `ai-service/`, `mobile/` (kept from v1 layout)
- `docker-compose.yml`: postgres/pgvector, redis, rabbitmq
- GitHub Actions: lint + test workflow stub (even if tests are empty initially)
- `.env.example` per service
**DoD:** `docker-compose up` starts all services; CI runs green on an empty test suite.

What CI verifies (`/.github/workflows/ci.yml`): server `npm test` (no `lint` script, so lint is skipped) against a job-level `pgvector/pgvector:pg16` service on **5432** (no native Postgres on the runner). Local compose maps host **5433→5432** so a machine Postgres on 5432 is left alone. ai-service: ruff + pytest (pytest may stub-pass). client: lint + `vite` build. Green CI still is not a substitute for reading the persistence test output.

## Phase 1 — Auth + core schema
**Goal:** users can sign up/log in; core tables exist.
- Implement schema (Schema.md) via migrations
- JWT + Google OAuth (kept from v1)
- Basic CRUD for categories/budgets/goals
**DoD (persistence — required, not optional):** a test against the **real** Postgres from `docker-compose.yml` (or the same `pgvector/pgvector:pg16` image in CI) that:
  1. Applies Prisma migrations to that database
  2. `POST /api/auth/register` creates a `users` row
  3. `POST /api/auth/login` returns a JWT for that user
  4. `POST /api/budgets` writes a `budgets` row
  5. The budget is read back **twice**: via `GET /api/budgets` and via a separate Prisma/`SELECT` against Postgres (no mocked Prisma, no in-memory store)

Lint or request-validation tests alone do not meet this DoD.

## Phase 2 — Data ingestion
**Goal:** transactions appear without manual entry (SMS on Android, Setu AA sandbox on web). Gmail fallback stays in Backlog unless AA stalls.

### Work in this phase
- Rebuild the mobile SMS parser against Schema.md (`transactions` + `linked_accounts`), POST to `server/` (v1 Mongo/expense paths are reference only)
- Setu AA **sandbox** consent → fetch → parse → insert (`source = 'setu_aa'`, `consent_handle` on `linked_accounts`). Do not flip sandbox → production without an explicit ask (Rules.md)
- Duplicate detection on ingest: near-identical amount + merchant + `occurred_at` within a short window is **flagged** (`is_duplicate_flag`), not silently double-counted
- Realistic sample payloads per source (Rules.md testing requirements)
- **Synthetic fixtures only:** merchant names, amounts, SMS/AA text, account numbers, phones, and UPIs in committed tests must be invented. No real user account numbers, phone numbers, or real transaction data — this repo is public.

### DoD (persistence — required, not optional)
A test against the **real** Postgres from `docker-compose.yml` / the CI `pgvector/pgvector:pg16` service that:

1. **SMS path (no Android device required in CI):** at least **two** realistic Indian bank/UPI SMS fixtures (e.g. debit SMS + UPI/GPay/PhonePe-style SMS) are parsed to `amount`, `merchant`, `occurred_at`, and debit vs credit. Parser code must be unit-testable without the Expo runtime.
2. Authenticated `POST` of that parsed SMS (or raw SMS, if the server parses) creates a `transactions` row with `source = 'sms'`, `raw_text` populated, and a `linked_accounts` row with `source = 'sms'`.
3. That SMS transaction is read back **twice**: `GET` the transactions API **and** a separate Prisma/`SELECT` (no mocked Prisma).
4. **Setu AA path:** a **recorded sandbox statement fixture** (JSON matching Setu AA sandbox shape, not a hand-waved generic object) is ingested the same way the live adapter will. Creates `transactions.source = 'setu_aa'` and `linked_accounts.consent_handle` set. Read back twice (API + Prisma/`SELECT`).
5. **Duplicate:** ingesting the same logical spend a second time (same user, amount, merchant, `occurred_at` within the window) does **not** increase a `SUM(amount)` of non-flagged rows. The duplicate is visible via `is_duplicate_flag = true` (or an equivalent persist that GET can show). Cross-source: SMS then AA for the same spend also flags, not silent double-count.
6. Both sources land in the **same** `transactions` table (source column differs; downstream stays source-agnostic).
7. All committed fixtures (SMS text, AA JSON, merchant/amount/`occurred_at`) are **synthetic**. They may look like Indian bank/UPI traffic, but must not contain real account numbers, phone numbers, or copied production/sandbox-personal transaction data.

### What does **not** meet this DoD
- Parser-only tests that never write Postgres
- Mocked Prisma / in-memory store
- Manual-entry `POST /api/expenses` leftover from v1 Mongo
- “Setu” tests that invent a payload unrelated to sandbox API shape
- Flipping Setu to production
- Gmail ingestion (optional; Tracker Backlog)
- Claiming iOS SMS reading works
- Green CI that only runs validation tests
- Fixtures that include real account numbers, phone numbers, or copied live transaction data

### Allowed to stay partial after Phase 2 (call it out, don’t mark as Done)
- Pixel-perfect Android SMS-permission UX / background listener polish, as long as the parser + POST path is real
- Live browser click-through of Setu consent on a deployed web app (server consent-handle persist + fixture ingest must still pass). A live sandbox hit is **bonus**, gated on `SETU_*` env; CI must pass **without** those secrets
- RabbitMQ async ingest (TechSpec lists it; Phase 2 DoD is a durable `transactions` row. Queue can wait unless ingest latency forces it)
- Dashboard live-update / websockets (Phase 3)

## Phase 3 — Dashboard + budgets + goals (client)
**Goal:** the core loop is visible and usable.
- Dashboard: safety score, safe-to-spend, recent transactions
- Budget/goal progress UI
- Redis-cached dashboard aggregation + websocket push on new transaction
**DoD:** adding a transaction updates the dashboard live, no refresh needed.

## Phase 4 — RAG assistant (`ai-service/`)
**Goal:** the assistant answers questions grounded in the user's real data.
- Embedding pipeline: transaction summaries + user notes → `documents` table
- LangGraph graph: retrieve → rules → generate
- Chat endpoint + websocket streaming
**DoD:** asking "how much did I spend on X this week" returns a correct, grounded answer.

## Phase 5 — Eval & guardrails layer
**Goal:** the AI's output quality is measured, not assumed.
- Guardrails AI validation node added to the LangGraph graph
- Ragas eval set (10-20 hand-written Q/A pairs) + CI job scoring retrieval/answer quality
- Langfuse tracing wired into every graph run
**DoD:** CI shows a Ragas score on every PR touching `ai-service/`; a real trace is viewable in Langfuse for a sample conversation.

## Phase 6 — Gamification + notifications + Financial Wrapped
**Goal:** the "soul" features that make this feel like a real product, not a demo.
- Badges/streaks/XP logic
- Notification triggers + queue (RabbitMQ) + delivery
- Financial Wrapped scheduled job (monthly aggregation → story cards)
**DoD:** a seeded test account can earn a badge and generate a Wrapped for a past month.

## Phase 7 — Hardening
**Goal:** the things recruiters actually check for.
- Rate limiting on both `server/` and `ai-service/`
- Sentry error logging wired into both
- Field-level encryption for linked-account tokens/identifiers
- DB indexing pass (see Schema.md §4)
**DoD:** hitting a rate limit returns a proper 429; a forced error shows up in Sentry; `EXPLAIN ANALYZE` on the main dashboard query uses the intended indexes.

## Phase 8 — Deployment + polish
**Goal:** a live, demoable product with a clean README.
- Deploy `client/` to Vercel, `server/`+`ai-service/` to Render/Railway
- Cloudflare R2 for exported reports/receipts
- README rewrite: architecture diagram, live demo links, real CI badge, real eval-score badge
**DoD:** a stranger can open the live URL, sign up, and use the full loop end to end.
