# AllowanceAI — Technical Specification

## 1. System overview

| Service | Language/Framework | Responsibility |
|---|---|---|
| `client/` | React 19 + Vite + Tailwind + Framer Motion + Recharts | Web app UI, PWA |
| `server/` | Node.js + Express 5 | Auth, core CRUD (transactions, budgets, goals, gamification), ingestion integrations, rate limiting |
| `ai-service/` | Python + FastAPI | RAG pipeline, LangGraph orchestration, eval/guardrails, embeddings |
| `mobile/` | Expo + React Native | Mobile app, SMS-based transaction auto-detection |
| Datastore | PostgreSQL (+ pgvector) | Single source of truth: relational data + embeddings |
| Cache/session | Redis | Sessions, rate-limit counters, embedding cache, chat session memory |

## 2. Why PostgreSQL replaces MongoDB

v1 used MongoDB. This rebuild moves to PostgreSQL because:
- Transactions/budgets/goals are inherently relational (foreign keys: user → account → transaction → category → budget).
- pgvector lets embeddings for RAG live in the *same* database as the financial data — no separate vector DB to keep in sync.
- Free-tier hosting (Supabase) gives pgvector out of the box.

`server/` keeps using an ORM-style data layer (Prisma or Drizzle — pick one at implementation time) instead of Mongoose.

## 3. RAG subsystem (`ai-service/`)

**Orchestration:** LangGraph defines the assistant as a graph, not a single prompt call:

1. **Retrieve node** — embed the user's question, query pgvector for top-k relevant transactions/notes/past chat turns.
2. **Rules node** — pull hard budget facts directly from Postgres (not retrieval — exact numbers should never be "approximately retrieved").
3. **Generate node** — LLM call with retrieved context + rules + recent chat history (from Redis) injected into the prompt.
4. **Guardrails node** — Guardrails AI validates the output (no hallucinated numbers, no advice outside scope, structured where needed) before it's returned.

**Why split retrieval (§1) from rules (§2):** amounts/balances must come from a direct DB query, never from vector similarity — RAG is for *context and history*, not for numbers that must be exact.

## 4. Eval & guardrails

| Tool | Role | Cost |
|---|---|---|
| Guardrails AI | Runtime validation of every AI reply before it reaches the user | Free, open source |
| Ragas | Offline eval of retrieval + answer quality, run in CI on a fixed test set | Free, open source |
| Langfuse | Traces every LangGraph run (self-hosted or free cloud tier) for debugging and demo-ability | Free (self-host or free tier) |

Ragas eval runs as a GitHub Actions job on a small hand-written eval set (see Rules.md) — this becomes a real CI badge in the README, not a claim.

## 5. Data ingestion subsystem

| Path | Platform | Mechanism | Status |
|---|---|---|---|
| SMS parsing | Mobile (Android only — iOS can't grant this permission) | On-device SMS read + regex/LLM parse, synced to `server/` | Kept from v1, rebuilt against new schema |
| Account Aggregator | Web | Setu AA sandbox — consent flow → fetch statement data → parse | New in v2 |
| Email parsing | Web (fallback) | Gmail API, parse bank transaction-alert emails | Documented, built only if AA integration stalls |

All three paths converge on the same `transactions` table — the ingestion source is stored as a `source` column, everything downstream is source-agnostic.

## 6. Cross-cutting concerns

- **Auth:** JWT + Google OAuth (kept from v1).
- **Caching:** Redis — dashboard aggregates, embedding cache, chat session memory (24h TTL).
- **Rate limiting:** `express-rate-limit` on `server/`, `slowapi` on `ai-service/`.
- **Error logging/observability:** Sentry free tier on both `server/` and `ai-service/`; Langfuse covers AI-specific tracing separately.
- **Encryption:** bcrypt for passwords (kept); AES field-level encryption for any linked-account identifiers/tokens at rest.
- **Websockets:** used for streaming AI chat replies token-by-token, and for live dashboard updates after a new transaction is ingested.
- **Async jobs / queue:** RabbitMQ (self-hosted via Docker, free forever) for embedding generation and ingestion parsing — keeps the request path fast, processes in the background.

## 7. Deployment & infra

| Concern | Choice | Why |
|---|---|---|
| Local dev | Docker Compose (postgres/pgvector, redis, rabbitmq) | One command spins up the full stack |
| CI/CD | GitHub Actions | Free for public/personal repos; runs tests + Ragas eval on PR |
| Web hosting | Vercel (`client/`) | Kept from v1, free tier |
| API hosting | Render or Railway (`server/`, `ai-service/`) | Free tier, kept from v1 pattern |
| File storage | Cloudflare R2 | Free forever tier, no egress fees — for exported reports/receipt images |
| Load balancer/proxy | Nginx (local Docker Compose only) | Demo-only; not needed at real hosting layer where the platform handles it |

**Deliberately not used:** Kubernetes (real overkill for this scale — a `minikube` demo folder may exist purely to show familiarity, but production runs on Render/Railway, not k8s).

## 8. Environment variables (master list, grouped)

```
# server/
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
CLIENT_URL=
AI_SERVICE_URL=
SETU_CLIENT_ID=
SETU_CLIENT_SECRET=
GMAIL_CLIENT_ID=        # fallback ingestion only
GMAIL_CLIENT_SECRET=    # fallback ingestion only
SENTRY_DSN=
R2_ACCESS_KEY=
R2_SECRET_KEY=

# ai-service/
DATABASE_URL=
REDIS_URL=
OPENAI_API_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
SENTRY_DSN=

# mobile/
API_URL=
```
