# AllowanceAI — Tracker.md

> **Instruction to the coding agent (Cursor/Antigravity):** update this file every time you start or finish a task. Move the card to the correct column. Never delete a card from Done — it's the project history. When you start a task, move it to "In Progress" *before* writing code, not after. If you discover a new task mid-work, add it to Backlog rather than doing unplanned work silently.

## Backlog
- [ ] Gmail email-parsing fallback ingestion (Phase 2, optional)
- [ ] Add a partial unique index on `categories(name) WHERE is_default AND user_id IS NULL` so the default seed is race-proof at the database level, not only in application logic.
- [ ] **Real password reset.** The screen no longer lies (it states the feature is
      unavailable and points at Google sign-in), but reset itself still does not exist.
      Needs reset-token columns on `users` — a migration, its own commit per Rules.md,
      applied to production by hand — plus SMTP credentials. `ResetPasswordPage` posts to
      `/auth/reset-password`, also absent; it is unreachable rather than broken, since the
      email that linked to it is no longer sent. Both are fixed by that one migration.
- [ ] **Port the retired v1 screens to Prisma** (jars, wishlist, wrapped, request-money, AI
      personality). The web routes no longer 500 — they serve `V1RetiredPage` — so this is
      now a feature gap rather than a breakage. The page components are kept in the tree as
      the reference for the port.
- [ ] **Mobile v1 screens still call Mongoose routes.** Only the SMS ingestion path was
      rebuilt against v2 (`/api/ingest/sms`). The rest of the Expo app is untouched and
      will fail the same way the web screens did.
- [ ] Prisma 6 -> 7 upgrade: v7 moves the direct/migration URL out of `schema.prisma` into `prisma.config.ts`. Deliberately NOT done the night before the mid-term demo.
- [ ] Live Setu AA sandbox consent click-through in the web client (Phase 2 leftover — server consent + fixture ingest passed; browser OAuth not built)
- [ ] RabbitMQ async ingest (Phase 2 leftover — ingest is synchronous; DoD only required a durable `transactions` row)
- [ ] Minikube demo folder (Phase 8, optional, resume-signal only)
- [ ] Multi-currency support (explicitly out of scope per PRD — do not build unless asked)

## To Do
- [ ] **Phase 5: eval & guardrails.** The DoD was rewritten by approved P3: a deterministic
      numpy Recall@K / MRR / NDCG gate in CI that needs no API key, plus Ragas nightly for
      faithfulness, plus a real Langfuse trace. `ai-service/eval/` exists but is empty.
      Phase 4's `answer_is_grounded` is the hand-rolled placeholder the Guardrails AI node
      replaces at the same boundary.
- [ ] **Streaming the assistant reply.** Phase 4's DoD said "chat endpoint + websocket
      streaming"; the endpoint is delivered and streaming is not. The answer arrives in one
      piece, which is honest but slower-feeling than it needs to be. The websocket
      infrastructure from Phase 3 (`/ws`) is already there to carry it.
- [ ] **Index-on-write is best-effort only.** `indexTransactionInBackground` is
      fire-and-forget by design, so a transaction written while ai-service is asleep is on
      the dashboard but not yet retrievable. `POST /api/assistant/reindex` repairs it and
      the UI offers that button, but a durable queue (the RabbitMQ in Rules.md) is the
      proper fix.

## In Progress
_(empty)_

## Review
_(empty)_

## Done

### Phase 4 — RAG assistant DELIVERED 2026-11-25. ai-service 76 pytest, server 65 tests, 0 fail.

- [x] **Hybrid retrieval (P1).** `rag/retrieval.py` — dense cosine over `documents.embedding`
      plus Postgres FTS over the generated `chunk_tsv`, fused with RRF (k=60). RRF consumes
      *ranks*, not scores, which is why it was chosen: there is no principled way to
      normalise `ts_rank_cd` against a cosine distance, and RRF makes the question vanish.
      - **Real bug found by a failing test, not by reading docs.** `websearch_to_tsquery`
        joins terms with **AND**. Right for a search box, wrong for retrieval: "how much
        did I spend at ZORVEX PANTRY" parses to `'much' & 'spend' & 'zorvex' & 'pantri'`,
        and a transaction sentence has the merchant but none of the filler — so the match
        fails. **Nothing errors.** The lexical arm contributed nothing to every
        natural-language question and "hybrid" silently degraded to dense-only. Verified
        directly on the container: AND returns `false` on the row it should rank first, OR
        returns `true`. The test asserting the target was found by *both* arms caught it.
        **Negative control:** restoring the AND form fails 3 tests.
      - **Honest negative result, recorded not buried.** P1 was adopted citing 73% to 100%
        Recall@1. **On our data the gap is much narrower.** For a distinctive merchant name
        or a UPI handle, dense alone already ranks the target #1 — subword tokenisation
        handles invented brand tokens well. The measured win is specifically on
        numeric/reference identifiers: "transaction with reference 884421" gives dense
        **#2**, lexical #1, hybrid **#1**. There is also a measured **cost**: a
        semantic-only match carries one RRF term against two and can be demoted a place or
        two. All three are pinned by tests, and the headline test has a **guard assertion
        that fails if the corpus stops exercising the hybrid case**, so the claim cannot rot
        into passing for the wrong reason.
      - Three silent-failure details handled and tested: `hnsw.iterative_scan =
        'relaxed_order'` (a user-filtered HNSW scan otherwise returns fewer than `LIMIT k`
        rows), the `id ASC` tiebreaker (byte-identical ordering across 4 runs), and the
        `user_id` filter inside both CTEs rather than only on the outer query.
- [x] **Embeddings (P2).** `bge-small-en-v1.5`, 384 dims, local, loaded once behind a
      double-checked lock. **Deviation recorded in TechSpec 3.1:** fastembed/onnxruntime
      instead of sentence-transformers — same model, same dimension, only the runtime
      differs. torch is ~1 GB installed and does not fit the free tier that P2's own
      rationale is written around; measured 203 MB of site-packages plus a 65 MB model.
      Caveat stated: fastembed resolves to Qdrant's int8-quantized ONNX export, so vectors
      are not bit-identical to fp32.
- [x] **One row, one sentence (P4).** `rag/render.py`, no chunking. Deterministic, UTC-
      normalised so the text is filed under the same day the dashboard counts it in, and
      duplicate-flagged rows are labelled rather than hidden so the model cannot silently
      contradict the dashboard.
- [x] **LangGraph graph.** retrieve, rules, generate — linear not agentic (P5). The
      retrieval/rules split is the point: retrieved sentences are evidence a transaction
      exists, never the authority on a total, and the prompt explicitly forbids summing
      HISTORY (retrieval returns at most 8 rows, so adding them up would understate any
      month). `rag/facts.py` repeats the Phase 2 conventions in SQL.
      - **A design conflict a test forced.** `generate_node` originally caught every
        exception and degraded gracefully; a test expecting 503 for a missing API key got
        200, because the graph had swallowed it. Those are different failures — a provider
        timeout is a hiccup, a missing key is an operator error, and swallowing it makes a
        misconfigured deployment look like a permanently flaky model nobody ever fixes.
        `LLMNotConfigured` now propagates; everything else still degrades. Both pinned.
      - `answer_is_grounded` checks every number >= 10 in the answer appears in the facts or
        retrieved text, normalised so "1,249.00" and "1249" match. Deterministic, no judge,
        no second model call. Ungrounded answers are **flagged, not rewritten**.
- [x] **Trust boundary.** `/assistant/*` takes a `user_id` and returns that user's
      financial history, so it must never be browser-reachable: browser, then `server/`
      (verifyJWT establishes *who*), then ai-service (`X-Internal-Token`, `compare_digest`).
      ai-service **fails closed** — with `INTERNAL_API_TOKEN` unset every endpoint answers
      503, even when a token is presented. No development default, because a default is a
      hardcoded credential in a public repo. `routes/assistant.js` always uses `req.userId`
      and never reads a body `user_id`; the test fires `user_id`, `userId` and `user` at it
      in one request and asserts the attacker's own id is what goes out.
- [x] **Verified end to end against live local services with the real LLM** (OpenRouter,
      `openai/gpt-4o-mini`): register, allowance, 4 spends, dashboard, backfill, retrieve in
      all 3 modes, 3 real questions. "How much did I spend at ZORVEX PANTRY?" returned "You
      spent Rs1,249.00 at ZORVEX PANTRY. This transaction is part of your total food
      spending this month, which is Rs1,684.00 across three transactions."
      `grounded=True`, 4 citations. The 1,684 is correct and came from SQL, not from the
      model adding up retrieved rows. Cross-user injection confirmed blocked.
- [x] **UX fix found by that run.** The card showed safety score **82** beside status
      **"Slow down"** in a red ring. Both figures were right — 82% of the month survives
      while today's Rs2,144 is 152% of the Rs1,408 safe daily rate — but side by side they
      read as a contradiction. The ring is now coloured by the score it displays, today's
      pace has its own labelled badge ("today: ..."), and the card says in words that most
      of the month is intact when the two disagree.

### Phase 3 — DELIVERED 2026-11-25. Suite 53 pass / 0 fail.

- [x] **Phase 3 remainder: safety score + safe-to-spend.** `services/spendingHealth.js`
      (pure, takes `now` as an argument, no Prisma) plus a `health` block on
      `GET /api/dashboard/summary` and `SpendingHealthCard` on the dashboard. A port of
      v1's `utils/financialHealth.js`, not a copy: v1's arithmetic is wrapped in a
      Mongo-shaped loader, computes month bounds in local time while the rest of the v2
      dashboard is UTC, and carries the defect below.
      - **Real bug found by porting it.** v1 did
        `usageRatio = recommendedDailyLimit > 0 ? spentToday / recommendedDailyLimit : 0`.
        The daily limit is `remaining / daysLeft`, so it goes non-positive exactly when the
        user has spent their whole allowance — at which point the ternary forces the ratio
        to 0, `getSpendingStatus(0)` returns `SAFE` and `savingsScore` is 100. **v1 told a
        user who had spent every rupee that they were "✅ Safe Spending" with a perfect
        score**, and contradicted itself in the same payload since `monthHealthScore` was
        correctly 0. Running out is now its own state and is never `safe`.
        **Negative control:** restoring the v1 ternary fails exactly one test — the one
        that targets it — and nothing else.
      - **Second v1 problem fixed: no basis.** v1 read `user.allowance` and, when unset,
        computed `0 - spent`: a negative remaining, a negative daily limit and a score of 0.
        A new account logging one ₹349 coffee rendered as a financial emergency. Now the
        basis is the allowance, else the sum of **monthly** budgets, else `basis: null`
        with every derived figure null and the card asking for an allowance. Weekly
        budgets are deliberately excluded from the fallback — a weekly 4000 is not 4000 of
        monthly headroom and counting it would overstate safe-to-spend roughly fourfold.
      - Proven by `phase3.spendingHealth.test.js`, **10 tests**: 6 pure (day maths incl.
        leap February and the last-day divide-by-zero clamp, the exhausted case, all seven
        status-band edges, budget fallback, no-basis refusal) and 4 against live Postgres
        through the real API (fresh user, allowance set then a spend moves it, credits and
        duplicate-flagged rows not inflating the score, monthly-vs-weekly basis).
      - Honours the Phase 2 conventions, asserted rather than assumed: a credit is not
        spend and is not extra allowance, and an `is_duplicate_flag` row is not counted.
- [x] **Phase 3: v1 Mongoose-backed screens retired** (supersedes the two v1-breakage
      Backlog cards). Six routes — `/v1`, `/jars`, `/wishlist`, `/wrapped`,
      `/request-money`, `/profile/ai-personality` — pointed at pages that fetch v1 Mongo
      endpoints and so 500 in production. They now serve `V1RetiredPage`, which names the
      screen, what it did and what it is waiting on. `/help` and `/profile/sms-sync` stay
      routed: both contain no API calls at all. The page components are kept as the port
      reference, unrouted rather than deleted. Side effect: Vite tree-shakes them out and
      the bundle drops **1,134 KB → 318 KB**.
- [x] **Reset-password screen stopped lying.** It posted to
      `POST /api/auth/forgot-password`, absent from the Prisma auth router, so it 404ed and
      rendered "Failed to send reset email. Please try again later." — retrying never
      works, and it sent a locked-out user to their inbox to wait for mail nobody sent. Now
      states the feature is unavailable and points at Google sign-in, which does link by
      email and does work. Not implemented for real because `users` has no reset-token
      columns: that needs a migration applied to production by hand plus SMTP credentials.

- [x] **Phase 3: v2 dashboard on the Prisma API.** Discovered 2026-11-10: the client calls
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
  - [x] **Websocket push (Phase 3 DoD).** `ws` on `/ws`, JWT in the query string because the
        browser WebSocket API cannot set an Authorization header. A transaction created from
        anywhere — mobile SMS parser, Setu AA pull, another tab — pushes to every open socket
        of *that* user only. Fail-open: `attach` is wrapped so a websocket failure cannot stop
        the HTTP API, and the client hook degrades silently to action-driven refresh.
        Chose `ws` over socket.io: this is one-way "something changed, refetch", so the
        protocol, rooms and client bundle buy nothing; reconnect lives in the client hook,
        with backoff and a stop on 4401 so a bad token cannot cause a tight reconnect loop.
        Proven (`phase3.realtime.test.js`, 5 tests) with real sockets against a real server:
        push arrives unprompted, a second user receives **nothing** (asserted by timeout, the
        only honest way to show an absent message), both of one user's devices are notified,
        no/junk/wrong-secret tokens are all closed, and a closed socket is forgotten so dead
        connections cannot accumulate. **Negative control:** disabling the push fails 3 of 5.
        Suite **43 pass / 0 fail**, with Redis and without.

### Earlier (Phases 0-2)

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
