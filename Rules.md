# AllowanceAI — Rules.md

## 0. Context — read this first
This is a from-scratch **rebuild** of the existing AllowanceAI product, in the **same repository** (github.com/Platypus12345/AllowanceAI) — same product concept and feature set (see PRD.md), new implementation (stack, schema, architecture) per these docs. Do **not** create a new repo or a parallel project. Work within the existing structure (`client/`, `server/`, `ai-service/`, `mobile/`), replacing v1 implementation details (e.g. MongoDB → PostgreSQL, per TechSpec.md/Schema.md) as you go. Treat existing v1 code as reference/removal-candidate, not as untouchable legacy.

Rules for whichever coding agent (Cursor, Antigravity, etc.) is working on this repo. Read this before writing any code.

## Golden rules
1. Never hardcode secrets, API keys, or connection strings. Always read from `.env` via each service's config loader. `.env` itself is git-ignored; only `.env.example` (with placeholder values) is committed.
2. Update `Tracker.md` before starting a task (move to In Progress) and after finishing it (move to Review or Done). This file is the single source of truth for "what's happening right now" — keep it honest.
3. Follow `ImplementationPlan.md`'s phase order. Don't start Phase N+1 work before Phase N's Definition of Done is met, even if it seems faster to jump ahead.
4. One logical change per commit. Commit messages describe *why*, not just *what* (e.g. `feat: add duplicate detection to ingestion — prevents double-counting SMS + AA sourced dupes`, not `update code`).
5. Never modify `Schema.md`'s table definitions and the actual migration in the same commit as an unrelated feature — schema changes get their own commit and a one-line rationale.

## Required tools (use these, don't substitute without asking)
- **Vector DB / RAG storage:** PostgreSQL + pgvector (not Chroma/FAISS/Pinecone — see TechSpec.md §2 for why)
- **Cache/session:** Redis
- **Agent orchestration:** LangGraph
- **Guardrails:** Guardrails AI (runtime validation of every AI reply)
- **Eval:** Ragas (CI-run offline eval)
- **Tracing:** Langfuse
- **Queue:** RabbitMQ (self-hosted via Docker)
- **Error tracking:** Sentry (free tier)
- **File storage:** Cloudflare R2 (not S3 — no egress fees on the free tier)

## Folder structure
```
allowance-ai/
├── client/          # React web app
├── server/          # Node/Express API — auth, CRUD, ingestion integrations
├── ai-service/       # FastAPI — RAG, LangGraph, eval/guardrails
├── mobile/           # Expo React Native — SMS ingestion
├── docker-compose.yml
└── .github/workflows/
```
Don't create a new top-level service folder without a corresponding update to TechSpec.md explaining why.

## Testing requirements
- Every ingestion source (SMS, Setu AA, Gmail) needs at least one test with a realistic sample payload — not just a happy-path mock.
- Every LangGraph node (retrieve, rules, generate, guardrails) needs a unit test that can run without hitting a real LLM API (mock the LLM call).
- Ragas eval set lives in `ai-service/eval/` and grows every time a retrieval or generation bug is found — turn bugs into eval cases, don't just fix and forget.

## Definition of done (applies to every task, on top of each phase's specific DoD)
- [ ] Code has a test covering the main path
- [ ] No secrets committed (double-check `.env.example` vs `.env`)
- [ ] `Tracker.md` updated
- [ ] Relevant doc (TechSpec/Schema/AppFlow) updated if the task changed behavior described there

## What NOT to touch without asking first
- Schema migrations that drop or rename existing columns
- Anything under `ai-service/eval/` that would silently lower the eval bar (deleting a hard eval case instead of fixing the bug it exposed)
- Setu AA credentials/config — sandbox vs production mode must never be flipped without an explicit instruction
