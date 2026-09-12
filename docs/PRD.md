# AllowanceAI — Product Requirements Document (PRD)

**Status:** Rebuild v2 — same product soul, new technical body
**Owner:** Aditya

## 1. Vision

AllowanceAI is an AI-powered personal finance assistant for students — it tracks allowance, expenses, and budgets automatically (no manual entry where avoidable), and gives proactive, conversational financial coaching instead of just showing numbers.

## 2. Problem

Students get irregular income (allowance, part-time work, gifts) and spend across a dozen small UPI/card transactions a day. Generic finance apps assume a salaried adult with predictable income and require heavy manual entry, so students abandon them within a week.

## 3. Target users

- **Primary:** College students (18–24) managing allowance + part-time income, low tolerance for manual data entry, mobile-first.
- **Secondary:** Recruiters/interviewers evaluating this as a portfolio project — the product must demonstrate real engineering depth, not just a CRUD app with a chatbot bolted on.

## 4. Core value proposition

1. **Zero-effort ingestion** — transactions appear automatically (SMS parsing on mobile, Account Aggregator or email parsing on web) instead of manual logging.
2. **Actually useful AI** — a RAG-powered assistant that knows *your* spending history and habits, not a generic chatbot wrapper.
3. **Behavioral nudges, not just dashboards** — safety score, spend prediction, streaks, and a monthly "Financial Wrapped" that make the numbers feel personal.

## 5. Feature set

### Kept from v1 (the "soul")
- Auth: email/password + Google OAuth
- Dashboard: financial safety score, daily spend limit, spend prediction
- Expense tracking: categories, duplicate detection, recurring expenses
- AI chat assistant with distinct personality modes
- Budget goals + monthly report + spending heatmap calendar
- Gamification: XP, badges, streaks
- Monthly "Financial Wrapped" (Spotify-Wrapped-style story cards)
- PWA — installable, offline shell
- Mobile app (Expo/React Native) with SMS-based auto transaction detection

### New in v2 (the rebuilt "body")
- **RAG-based assistant** — the AI chat retrieves from the user's actual transaction/notes history (pgvector) instead of relying on a stuffed context window or generic prompting.
- **Cross-platform auto-ingestion** — mobile keeps SMS parsing; web gets a real ingestion path via Setu Account Aggregator sandbox (and/or Gmail transaction-email parsing as a fallback), so web-only users aren't stuck manually entering data.
- **Agent orchestration** via LangGraph for the assistant's multi-step reasoning (retrieve → check budget rules → generate → validate).
- **Eval & guardrails layer** — Guardrails AI validates every AI reply before it reaches the user; Ragas scores retrieval/answer quality in CI; Langfuse traces every run for debugging and demo-ability.
- **Production-grade cross-cutting concerns** — rate limiting, structured error logging (Sentry), field-level encryption for sensitive data, Redis caching, Dockerized local dev, CI/CD via GitHub Actions.

## 6. Non-goals (explicitly out of scope for now)

- Real production banking licensing/certification (Setu AA is used in **sandbox** mode only — this is a portfolio project, not a licensed financial product).
- Multi-currency support.
- Kubernetes / container orchestration beyond a single Docker Compose stack (mentioned in TechSpec as a "why we didn't" note, not built).
- Native iOS SMS reading (not possible on iOS by OS design — documented, not treated as a bug).

## 7. Success metrics (portfolio-project framing)

- End-to-end demo: sign up → link account (or grant SMS) → transactions appear with zero manual entry → ask the assistant a question about spending → get a grounded, cited answer.
- Recruiter-facing: repo shows real CI passing, real tests, real traces in Langfuse, real eval scores from Ragas — not just claims in a README.
- Personal: RAG, LangGraph, and eval/guardrails skill gaps (see skills tracking) are closed through actually building this, not tutorials alone.

## 8. Assumptions made in this rebuild (flag if wrong)

- MongoDB → **PostgreSQL** as the primary datastore (adds pgvector for RAG, and relational structure fits transactions/budgets better than documents). This is the biggest architectural change from v1 — see TechSpec.md §2 for rationale.
- `server/` (Node/Express) and `ai-service/` (Python/FastAPI) stay split, matching the existing repo structure — core CRUD/auth stays in Node, RAG/AI/eval logic stays in Python.
- Setu AA sandbox is treated as the primary "proper" ingestion path for web; Gmail parsing is a documented fallback, not built first.
