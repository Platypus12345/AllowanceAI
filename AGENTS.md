# AllowanceAI — Antigravity Project Instructions

## What this project is

AllowanceAI v2 — a from-scratch rebuild of the existing AllowanceAI product
**in this same repository** (github.com/Platypus12345/AllowanceAI).
Same product concept and feature set; entirely new technical implementation.
Do NOT create a new repo or a parallel project.

## Authoritative project documents

These files are the single source of truth. Read them before writing any code
or making architectural decisions. If something in chat conflicts with these
docs, flag it rather than silently overriding.

| Doc | Path | Purpose |
|---|---|---|
| PRD | [docs/PRD.md](docs/PRD.md) | Vision, features, non-goals, success metrics |
| TechSpec | [docs/TechSpec.md](docs/TechSpec.md) | Stack choices, service layout, required tools, env vars |
| AppFlow | [docs/AppFlow.md](docs/AppFlow.md) | End-to-end user journeys (auth → ingest → RAG → wrapped) |
| Design | [docs/Design.md](docs/Design.md) | Visual direction, design tokens, component conventions |
| Schema | [docs/Schema.md](docs/Schema.md) | PostgreSQL tables, Redis key patterns, pgvector notes |
| Implementation Plan | [docs/ImplementationPlan.md](docs/ImplementationPlan.md) | Phase-by-phase build order with DoD gates |
| Rules | [Rules.md](Rules.md) | Golden rules, tool mandates, testing requirements, what NOT to touch |
| Tracker | [Tracker.md](Tracker.md) | Live task board — update before starting AND after finishing every task |

## Standing operating rules (summary — full detail in Rules.md)

1. **Tracker.md first:** move a task to In Progress *before* writing code; move
   to Review/Done after. Never let Tracker drift from reality.
2. **Phase order:** respect the phase gates in ImplementationPlan.md. Don't
   start Phase N+1 until Phase N's DoD is met.
3. **No secrets:** `.env` is git-ignored; only `.env.example` (with placeholder
   values) is committed.
4. **One logical change per commit.** Message format:
   `type(scope): what and why` (e.g. `feat(server): add duplicate detection to ingestion`)
5. **Tool mandates:** pgvector (not Chroma/FAISS), Redis, LangGraph, Guardrails AI,
   Ragas, Langfuse, RabbitMQ, Sentry, Cloudflare R2. Don't substitute without asking.
6. **Ask before:** schema migrations that drop/rename columns; anything that
   touches `ai-service/eval/`; flipping Setu AA sandbox ↔ production.

## Folder layout

```
allowance-ai/
├── client/           # React 19 + Vite + Tailwind web app (PWA)
├── server/           # Node/Express 5 — auth, CRUD, ingestion
├── ai-service/       # FastAPI — RAG, LangGraph, eval/guardrails
├── mobile/           # Expo/React Native — SMS auto-ingestion
├── docs/             # Spec docs (PRD, TechSpec, AppFlow, Design, Schema, ImplementationPlan)
├── docker-compose.yml
└── .github/workflows/
```

Do not create a new top-level service folder without updating TechSpec.md first.
