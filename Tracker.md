# AllowanceAI — Tracker.md

> **Instruction to the coding agent (Cursor/Antigravity):** update this file every time you start or finish a task. Move the card to the correct column. Never delete a card from Done — it's the project history. When you start a task, move it to "In Progress" *before* writing code, not after. If you discover a new task mid-work, add it to Backlog rather than doing unplanned work silently.

## Backlog
- [ ] Gmail email-parsing fallback ingestion (Phase 2, optional)
- [ ] Minikube demo folder (Phase 8, optional, resume-signal only)
- [ ] Multi-currency support (explicitly out of scope per PRD — do not build unless asked)

## To Do
_(empty)_

## In Progress
_(empty)_

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
