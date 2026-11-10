# AllowanceAI — Tracker.md

> **Instruction to the coding agent (Cursor/Antigravity):** update this file every time you start or finish a task. Move the card to the correct column. Never delete a card from Done — it's the project history. When you start a task, move it to "In Progress" *before* writing code, not after. If you discover a new task mid-work, add it to Backlog rather than doing unplanned work silently.

## Backlog
- [ ] Gmail email-parsing fallback ingestion (Phase 2, optional)
- [ ] Add a partial unique index on `categories(name) WHERE is_default AND user_id IS NULL` so the default seed is race-proof at the database level, not only in application logic.
- [ ] `LoginPage.jsx` posts to `/api/auth/forgot-password`, which no longer exists on the Prisma auth router -> 404. Password reset is dead until the Phase 3 frontend rebuild.
- [ ] v1 client/mobile screens (expenses, jars, splits, wishlist, friends, ...) still call Mongoose routes, so they fail when `MONGO_URI` is absent. Either port them to Prisma or hide them until Phase 3.
- [ ] Prisma 6 -> 7 upgrade: v7 moves the direct/migration URL out of `schema.prisma` into `prisma.config.ts`. Deliberately NOT done the night before the mid-term demo.
- [ ] Live Setu AA sandbox consent click-through in the web client (Phase 2 leftover — server consent + fixture ingest passed; browser OAuth not built)
- [ ] RabbitMQ async ingest (Phase 2 leftover — ingest is synchronous; DoD only required a durable `transactions` row)
- [ ] Minikube demo folder (Phase 8, optional, resume-signal only)
- [ ] Multi-currency support (explicitly out of scope per PRD — do not build unless asked)

## To Do
- [ ] Phase 3: websocket push so a new transaction updates the dashboard with no refresh (Phase 3 DoD)
- [ ] Phase 3: retire or hide the v1 Mongoose-backed screens once the v2 dashboard lands (supersedes the two v1-breakage Backlog cards)

## In Progress
- [ ] **Phase 3: v2 dashboard on the Prisma API.** Discovered 2026-11-10: the client calls
  **zero** v2 endpoints — no `/budgets`, `/goals`, `/transactions`, `/categories`. Every one of
  its ~50 calls is a v1 Mongoose route, and `DashboardPage` fetches `/budget/stats`, which does
  `User.findById` through Mongoose. With `MONGO_URI` deleted (Task.md step 3) the landing page
  after login returns 500. So the documented demo path "login → budgets → goals → transactions"
  is real in the API and tested, but has **no UI at all**. This card builds it.
  - [x] **`POST /api/transactions` — manual entry (`source='manual'`).** Transactions could only
        arrive via `/api/ingest/sms` or `/api/ingest/setu`, so there was no way to add one from a
        browser and the Phase 3 DoD had nothing to trigger. Reuses `ensureLinkedAccount` +
        `findDuplicate` rather than a bare create, so a hand-keyed spend that repeats an already
        ingested SMS is flagged instead of double-counted. Proven against live Postgres
        (`phase3.manualtx.persistence.test.js`, 5 tests): debit stored positive / credit negative
        matching the parsers, SMS-then-manual duplicate flagged with the non-flagged spend SUM
        unchanged at 469, another user's `categoryId` rejected 400 writing no row, and five
        invalid payloads rejected writing no row. **Negative control:** flipping the sign
        convention fails 3 of the 5 tests. Suite now **33 pass / 0 fail**, up from 28.
  - [x] **`GET /api/dashboard/summary` — Redis-cached aggregation.** One read paints the whole
        landing page: month spend, per-budget progress, goal progress, 10 most recent
        transactions. Aggregation honours the Phase 2 conventions — credits (negative) and
        `is_duplicate_flag` rows are excluded, so the dashboard cannot undo duplicate detection.
        Invalidated on every transaction / budget / goal write, with a 60s TTL as backstop.
        **The cache is fail-open on purpose:** `render.yaml` provisions no Redis, so
        `config/redis.js` degrades to a direct PostgreSQL read when `REDIS_URL` is unset or
        Redis is down. A required cache here would repeat the live-login bug exactly.
        Proven (`phase3.dashboard.persistence.test.js`, 5 tests) **both with Redis and without**:
        same numbers, no 500. Cache-hit is asserted only when `REDIS_URL` is set, else a dead
        cache would pass silently. **Negative controls:** disabling invalidation fails the
        staleness test; keys confirmed present in Redis via `redis-cli KEYS`.
  - [x] Fixed a real defect found while doing this: an open Redis client kept `node --test`
        alive forever, hanging the suite. Every persistence test now closes it in `after`,
        exactly as it already closed Prisma. Suite **38 pass / 0 fail** with Redis AND without.
  - [x] **v2 dashboard UI (`DashboardV2Page` + `AddTransactionForm`).** The first screen in
        this client that talks to PostgreSQL. Reads `GET /api/dashboard/summary` and
        `/categories`; writes through `POST /api/transactions`. Shows month/today spend,
        per-budget progress bars, goal progress, and the 10 latest transactions tagged by
        source (SMS / Bank / Manual). Surfaces the duplicate flag in the UI, so a flagged
        row does not look like a missing number. Routed at `/` and `/dashboard`, so login
        now lands on a page that works; the v1 Mongoose dashboard moved to `/v1`.
        Verified: `vite build` passes, eslint clean, and a booted server driven end-to-end
        (register -> category -> budget -> goal -> transaction -> summary) returns exactly
        the shape the page reads. Cache confirmed live: miss -> hit -> busted by a write.

## Review
_(empty)_

## Done
- [x] Reorganize planning docs into docs/ and root working files (Tracker.md, Rules.md)
- [x] Create AGENTS.md with persistent project instructions
- [x] Commit + push to github.com/Platypus12345/AllowanceAI (commit 79161e7)
- [x] Restructure repo into client/server/ai-service/mobile (Phase 0) — layout confirmed correct from v1
- [x] Write docker-compose.yml (postgres/pgvector:pg16, redis:7, rabbitmq:3 with healthchecks) (Phase 0) — compose file present; full `docker-compose up` of all three services not re-verified this session
- [x] GitHub Actions lint+test CI stub — server/ai-service/client parallel jobs (Phase 0)
- [x] .env.example per service — server, ai-service, mobile all v2-aligned (Phase 0)
- [x] **Phase 0 (CI portion)** — previously green on `1cb9f89` (run 37354584805) with **no** Postgres service. This commit adds a `pgvector/pgvector:pg16` service on CI **5432** so `npm test` (including persistence) can hit a real DB. Local compose stays on host **5433**.
- [x] Automated **shallow** unit tests for auth & CRUD validation / JWT reject paths (Phase 1) — `server/tests/phase1.test.js` only; does not write to Postgres
- [x] Implement PostgreSQL schema via migrations with Prisma & pgvector (Phase 1) — `prisma migrate deploy` ran against compose `pgvector/pgvector:pg16` (host **5433**)
- [x] JWT + Google OAuth auth backed by PostgreSQL users table (Phase 1) — register/login persist a `users` row (Google OAuth still from v1; not exercised by this DoD test)
- [x] Basic CRUD for categories/budgets/goals (Phase 1) — budget create + GET list verified against Postgres (categories/goals routes exist; DoD path was budgets)
- [x] Persistence DoD test: register → login → create budget → row present in Postgres via Prisma (no mocks) — `npm run test:persistence` **pass 1 / fail 0** against healthy `allowance_postgres` on `5433:5432`
- [x] Phase 2: SMS parser + authenticated ingest into Postgres `transactions` (source=`sms`) — synthetic fixtures; parser unit tests + live Postgres write/read-back
- [x] Phase 2: Setu AA sandbox adapter — `consent_handle` persist + recorded sandbox-shaped FI JSON → `transactions` (source=`setu_aa`); CI/local tests do not need `SETU_*` secrets
- [x] Phase 2: Duplicate detection — second SMS and SMS-then-AA same spend set `is_duplicate_flag`; `SUM` of non-flagged spend does not increase. Fixtures are synthetic only.
- [x] Phase 0 leftover: Redis + RabbitMQ proven healthy, not just declared — `docker compose ps` shows all three `(healthy)`; `redis-cli ping` -> `PONG`; `rabbitmq-diagnostics ping` -> `Ping succeeded` and `check_running` -> `fully booted and running`. Postgres reports `pgvector 0.8.7` in schema `public`.
- [x] **Production login unblocked** — `/api/health` now reports PostgreSQL via a real `SELECT 1`, not `mongoose.readyState`. The client `wakeApiServer` gates Google login on `dbReady`, so a dead/absent Mongo was blocking a login path that never touches Mongo. Live before: `{"dbReady":false}`. Local after, with `MONGO_URI` unset: `{"status":"ok","dbReady":true,"db":"postgres","legacyMongoReady":false}`.
- [x] `render.yaml` / `.env.example` / `schema.prisma` document `DATABASE_URL` + `DIRECT_URL` for the Supabase pooler. Verified on Prisma 6.19.3: `migrate deploy` without `DIRECT_URL` fails `P1012`, `generate` does not — so CI got `DIRECT_URL` and the Render build is unaffected. No secrets in the repo.
- [x] Phase 1 leftover: **Google OAuth persistence proven** — drives the real `config/passport.js` verify callback against live Postgres. Covers first sign-in (writes `google_id`, no password hash), linking onto an existing email/password row without duplicating it or wiping the hash, a returning user matched by `google_id`, and a no-email profile rejected leaving no row. Negative control: removing `googleId` from `create()` makes it fail on the raw SELECT.
- [x] Phase 1 leftover: **categories + goals read-back tests** — the original DoD only covered budgets. Create/rename/delete and goal progress each read back via API **and** literal SQL. Also pins per-user isolation (cross-user GET returns nothing; cross-user PUT/DELETE 404).
- [x] **Security fix: `is_default` privilege escalation** — `POST /api/categories` trusted a client-supplied `isDefault`, and `GET` returns every `is_default = true` row regardless of owner, so any user could publish a category into every other user’s list. Route now always writes `isDefault: false`. Caught by the new test, which failed `true !== false` before the fix.
- [x] Phase 1 leftover: **default categories seeded** — `npm run seed:categories` (idempotent, supports `--dry-run`) creates Food/Transport/Shopping/Entertainment/Health/Other as system rows (`user_id IS NULL`). Proven: rows land, a second run adds nothing and leaves no duplicate name, and a brand-new registered user sees all six via the API without creating anything.
- [x] Phase 0 tidy: removed the obsolete `version:` key from `docker-compose.yml` — `docker compose config` now validates with no warnings, so real warnings stop being buried.

### Phase 1 leftovers closed (2026-11-09)

Full server suite against live compose Postgres (host **5433**, `(healthy)`), no mocks:

```
ℹ tests 28
ℹ suites 10
ℹ pass 28
ℹ fail 0
```

Up from 14 tests. The four new suites are `phase1.oauth.persistence`,
`phase1.crud.persistence`, `phase1.seed.persistence` and the existing Phase 1/2 ones.
Three Phase 1 leftovers and one Phase 0 tidy moved to Done, and one real security bug
was found and fixed in the process (`is_default` escalation) — the kind of thing the
original budgets-only DoD could not have surfaced.

---

### Phase 2 DoD evidence (2026-11-09)

Run against the live compose Postgres (`allowance_postgres`, host **5433**, `(healthy)`),
`pgvector/pgvector:pg16`, no mocks and no stubbed Prisma:

```
> server@1.0.0 test
> node --test

▶ Phase 1 — persistence against live Postgres
  ✔ register, login, create budget, and read the row back from Postgres
▶ Phase 2 — ingestion persistence against live Postgres
  ✔ SMS and Setu AA ingest persist, read back, and flag duplicates
▶ Phase 2 — SMS parser (no Expo, synthetic fixtures)
  ✔ parses a debit bank SMS and a UPI SMS
  ✔ parses credit vs debit
ℹ tests 14
ℹ pass 14
ℹ fail 0
```

Mapped to the DoD in ImplementationPlan.md:

| DoD | Status | Proof |
|---|---|---|
| 1. Two SMS fixtures -> amount/merchant/occurred_at/direction, Expo-free parser | met | `phase2.smsParser.test.js` asserts all four on the debit and UPI fixtures, plus a credit fixture; parser is plain CommonJS |
| 2. Authenticated POST -> `transactions` (`source='sms'`, `raw_text`) + `linked_accounts` (`source='sms'`) | met | asserted on the API response, via Prisma, and via raw SQL joining `linked_accounts` |
| 3. Read back twice (API + separate Prisma/SELECT) | met | `GET /api/transactions` **and** a second `PrismaClient` doing a literal `$queryRaw SELECT` |
| 4. Setu sandbox-shaped FI JSON -> `source='setu_aa'` + `consent_handle`, read back twice | met | ReBIT deposit fixture with `decryptedFI`; `consent_handle` now verified via Prisma **and** raw SQL, not only the API echo |
| 5. Duplicate does not increase non-flagged `SUM`; cross-source SMS->AA flags | met | raw SQL `SUM` = 469 with two rows at `is_duplicate_flag = true`; AA debit carries `duplicateOf` = the SMS row id |
| 6. Both sources in the same `transactions` table | met | raw `GROUP BY source` -> `setu_aa: 2`, `sms: 1` for one user |
| 7. Fixtures synthetic | met | invented merchants, amounts, UPI handles, masked account numbers; reviewed by hand |

Strengthened during this review: the Phase 2 test originally read back only through
a second `PrismaClient` model API. It now also does literal `$queryRaw` SELECTs for
the SMS row, the AA row, the `consent_handle`, the per-source counts and the spend SUM —
matching the convention `phase1.persistence.test.js` already used.

Still open and deliberately **not** claimed as done: live browser Setu consent
click-through, and RabbitMQ async ingest (ingest is synchronous). Both are in Backlog,
and ImplementationPlan.md explicitly allows them to stay partial after Phase 2.

---

### Correction (2026-10-06)
Phase 1 cards were marked Done because CI went green after adding Prisma + validation tests. That conflated lint/validation with persistence. They were moved back to In Progress until a real Postgres write/read test passed. Re-verified the same day: Docker Desktop + WSL2, compose Postgres remapped off native PG17's 5432 onto **5433**, container **healthy**, `npm run test:persistence` passed.

---

## How to use this file
- **Backlog:** known but not scheduled yet.
- **To Do:** scheduled, ready to start, in priority order top to bottom.
- **In Progress:** actively being worked (should almost always be 1 item, not many in parallel).
- **Review:** code written, needs a check against the phase's Definition of Done (see ImplementationPlan.md) before moving to Done.
- **Done:** DoD met.

As each Implementation Plan phase is broken down into tasks, add them here under To Do in the order they should be tackled.
