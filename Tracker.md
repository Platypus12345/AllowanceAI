# AllowanceAI — Tracker.md

> **Instruction to the coding agent (Cursor/Antigravity):** update this file every time you start or finish a task. Move the card to the correct column. Never delete a card from Done — it's the project history. When you start a task, move it to "In Progress" *before* writing code, not after. If you discover a new task mid-work, add it to Backlog rather than doing unplanned work silently.

## Backlog
- [ ] Gmail email-parsing fallback ingestion (Phase 2, optional)
- [ ] Minikube demo folder (Phase 8, optional, resume-signal only)
- [ ] Multi-currency support (explicitly out of scope per PRD — do not build unless asked)

## To Do
- [ ] Restructure repo into client/server/ai-service/mobile (Phase 0)
- [ ] Write docker-compose.yml (postgres/pgvector, redis, rabbitmq) (Phase 0)
- [ ] GitHub Actions lint+test stub (Phase 0)
- [ ] .env.example per service (Phase 0)

## In Progress
_(empty — nothing started yet)_

## Review
_(empty)_

## Done
_(empty — this is a fresh rebuild)_

---

## How to use this file
- **Backlog:** known but not scheduled yet.
- **To Do:** scheduled, ready to start, in priority order top to bottom.
- **In Progress:** actively being worked (should almost always be 1 item, not many in parallel).
- **Review:** code written, needs a check against the phase's Definition of Done (see ImplementationPlan.md) before moving to Done.
- **Done:** DoD met.

As each Implementation Plan phase is broken down into tasks, add them here under To Do in the order they should be tackled.
