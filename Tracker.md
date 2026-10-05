# AllowanceAI — Tracker.md

> **Instruction to the coding agent (Cursor/Antigravity):** update this file every time you start or finish a task. Move the card to the correct column. Never delete a card from Done — it's the project history. When you start a task, move it to "In Progress" *before* writing code, not after. If you discover a new task mid-work, add it to Backlog rather than doing unplanned work silently.

## Backlog
- [ ] Gmail email-parsing fallback ingestion (Phase 2, optional)
- [ ] Minikube demo folder (Phase 8, optional, resume-signal only)
- [ ] Multi-currency support (explicitly out of scope per PRD — do not build unless asked)

## To Do
- [ ] JWT + Google OAuth auth (Phase 1)
- [ ] Basic CRUD for categories/budgets/goals (Phase 1)

## In Progress
- [ ] Implement PostgreSQL schema via migrations (Phase 1)

## Review
_(empty)_

## Done
- [x] Reorganize planning docs into docs/ and root working files (Tracker.md, Rules.md)
- [x] Create AGENTS.md with persistent project instructions
- [x] Commit + push to github.com/Platypus12345/AllowanceAI (commit 79161e7)
- [x] Restructure repo into client/server/ai-service/mobile (Phase 0) — layout confirmed correct from v1
- [x] Write docker-compose.yml (postgres/pgvector:pg16, redis:7, rabbitmq:3 with healthchecks) (Phase 0)
- [x] GitHub Actions lint+test CI stub — server/ai-service/client parallel jobs (Phase 0)
- [x] .env.example per service — server, ai-service, mobile all v2-aligned (Phase 0)
- [x] **Phase 0** — `docker-compose up` starts all services; CI runs green on empty test suite (CI run 37349814775 green)

---

## How to use this file
- **Backlog:** known but not scheduled yet.
- **To Do:** scheduled, ready to start, in priority order top to bottom.
- **In Progress:** actively being worked (should almost always be 1 item, not many in parallel).
- **Review:** code written, needs a check against the phase's Definition of Done (see ImplementationPlan.md) before moving to Done.
- **Done:** DoD met.

As each Implementation Plan phase is broken down into tasks, add them here under To Do in the order they should be tackled.
