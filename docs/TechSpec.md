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

1. **Retrieve node** — **hybrid retrieval** (adopted P1, 2026-11-25). Two retrievers run per
   question and their ranked lists are fused with Reciprocal Rank Fusion
   (`score = Σ 1/(k + rank)`, `k = 60`):
   - **Dense:** embed the question, cosine-search `documents.embedding` via the HNSW index.
   - **Lexical:** Postgres full-text search over `documents.chunk_tsv` via its GIN index.

   Dense search alone loses at rank 1 on exact tokens — a merchant name, a UPI handle, a
   reference number — which for a finance assistant is the *common* query, not the edge case.
   Lexical alone collapses on paraphrases. Both halves live inside the Postgres already
   running, so this adds no service and no dependency.

   Three non-optional details. Every one is a **silent** failure — no exception, just
   quietly worse answers:
   - Every AllowanceAI query filters by `user_id`. Against an HNSW index on pgvector 0.8+ a
     strict filter can return **fewer than `LIMIT k` rows**, so the retrieve node must
     `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` inside its transaction.
   - Order by `rrf_score DESC, id ASC`. Without the deterministic tiebreaker, ties return in
     arbitrary heap order and the CI eval gate (§4) flakes between runs on unchanged code.
   - **The lexical query must be OR-joined, not AND-joined.** `websearch_to_tsquery` joins
     terms with `AND`, which is right for a search box and wrong for retrieval: *"how much
     did I spend at ZORVEX PANTRY"* parses to `'much' & 'spend' & 'zorvex' & 'pantri'`, and
     a transaction sentence carries the merchant but none of the filler, so the match fails.
     Verified on the live container: the AND form returns `false` on the very row it should
     rank first; the OR form returns `true`. **Found by a failing test, not by reading the
     documentation** — it had disabled the entire lexical arm for every natural-language
     question, with hybrid silently degrading to dense-only. The implementation runs
     `websearch_to_tsquery` first and only then swaps the operator, so the user's text is
     still parsed and escaped by Postgres; a punctuation-only query yields an empty tsquery
     that matches nothing, and a quoted phrase keeps its `<->` operator.

   **Measured benefit on our data, not the source's.** Proposals.md cited a benchmark where
   dense-only scored 73% Recall@1 and hybrid 100%. On AllowanceAI's data shape the gap is
   **narrower**: for a distinctive merchant name or a UPI handle the dense arm alone already
   ranks the right row #1, because subword tokenisation handles invented brand tokens well.
   The measured win is specifically on **numeric and reference-style identifiers** — e.g.
   *"transaction with reference 884421"*, where dense puts the target at #2, lexical at #1
   and hybrid at #1. There is also a measured **cost**: a row only the semantic arm found
   scores one RRF term against two, so it can be demoted a place or two. All three
   behaviours are pinned by tests in `ai-service/tests/test_retrieval.py`, including a guard
   assertion that fails if the corpus stops exercising the hybrid case at all.
2. **Rules node** — pull hard budget facts directly from Postgres (not retrieval — exact numbers should never be "approximately retrieved").
3. **Generate node** — LLM call with retrieved context + rules + recent chat history (from Redis) injected into the prompt.
4. **Guardrails node** — Guardrails AI validates the output (no hallucinated numbers, no advice outside scope, structured where needed) before it's returned.

**Why split retrieval (§1) from rules (§2):** amounts/balances must come from a direct DB query, never from vector similarity — RAG is for *context and history*, not for numbers that must be exact.

### 3.1 Embedding model — pinned (adopted P2, 2026-11-25)

**`bge-small-en-v1.5`, 384 dimensions, run locally via sentence-transformers.**

`vector(384)` in `Schema.md` / `schema.prisma` is a real constraint, not a neutral default:
it excludes `nomic-embed-text` (768), `EmbeddingGemma-300M` (768), `BGE-M3` (1024) and
`gemini-embedding-001` (3072). The live choice at 384 dims was `bge-small-en-v1.5` (MIT) vs
`all-MiniLM-L6-v2` (Apache 2.0); we take the former — same dimension and size class, better
published retrieval quality.

**Why a local model rather than a free embedding API.** Embeddings are generated on *every
ingested transaction*, not only on user questions. A free tier metered per day is the wrong
shape for that — one backfill of a month of transactions can exhaust a daily quota. Local
means no quota, no key to leak, no network failure mode, and it runs in CI for free, which
the §4 gate depends on.

**Cost of changing it later:** a migration *plus* a full re-embed of every row. Treat the
dimension as frozen.

**Runtime: fastembed (onnxruntime), not sentence-transformers — deviation recorded
2026-11-25.** The *model* and the dimension are exactly as pinned above; only the runtime
differs. sentence-transformers pulls torch, on the order of a gigabyte installed, which
does not fit the free tier this section's own rationale is written around and makes a CI
install slow enough that people start skipping it. Measured here: the whole fastembed stack
is **203 MB** of site-packages (54 MB of it onnxruntime) plus a **65 MB** model, and the
model loads in ~10s.

Two honest caveats, because this is a real difference and not only packaging:

- fastembed resolves `BAAI/bge-small-en-v1.5` to Qdrant's **int8-quantized** ONNX export
  (`qdrant/bge-small-en-v1.5-onnx-q`), not the fp32 original. Quantization perturbs vectors
  slightly, so cosine distances are not bit-identical to a sentence-transformers run. It
  changes neither the dimension nor the tokenizer, and §4's deterministic gate measures
  retrieval quality directly — so if quantization ever cost real recall, that gate is what
  would catch it.
- The model is loaded once per process behind a double-checked lock. Two concurrent requests
  arriving before the first load completes would otherwise each construct one and double the
  RSS, which is precisely what the free tier cannot absorb.

> Embedding generation belongs in `ai-service/`; watch RSS when the model loads.

### 3.2 Transaction → document text (adopted P4, 2026-11-25)

**Transactions are not chunked.** One row renders to one deterministic sentence from a fixed
template and that sentence is embedded:

```
2026-01-15 · debit ₹349.00 · SYNTHETIC MART · source=sms
```

`user_id`, `occurred_at`, `amount` and `source` stay as filterable columns rather than being
buried in prose, so the rules node (§2) can still get exact numbers by SQL.

**Why not a generic chunker.** Sliding-window chunkers on structured financial rows produce
chunks with 80–94% token overlap, which stuffs near-duplicate text into the prompt and
**makes the LLM hallucinate numbers** — the single worst failure mode this product has. They
also truncate table rows and cut mid-sentence.

Structure-aware chunking is reserved for genuinely free text (user notes): split on headings
and paragraphs, never mid-table or mid-sentence.

## 4. Eval & guardrails

| Tool | Role | Cost |
|---|---|---|
| Guardrails AI | Runtime validation of every AI reply before it reaches the user | Free, open source |
| Deterministic retrieval gate | **CI, every PR** — Recall@K / MRR / NDCG in plain numpy against a golden question → expected-chunk-id set. No LLM, no key, no network | Free |
| Ragas | **Nightly / manual** — faithfulness and answer relevancy, where an LLM judge genuinely is the right tool | Free, open source |
| Langfuse | Traces every LangGraph run (self-hosted or free cloud tier) for debugging and demo-ability | Free (self-host or free tier) |

**Evaluation is split in two (adopted P3, 2026-11-25).** Ragas metrics are mostly
LLM-as-judge: every run costs tokens, needs a key in CI, is rate-limited on a free tier, and
is **non-deterministic** — the same code can score differently twice. A PR gate has to be
reproducible, so:

- **CI gate on every PR:** a golden set of question → expected-chunk-id pairs scored with
  Recall@K, MRR and NDCG in numpy. Deterministic, runs in seconds, needs no credits, and
  fails the build on a real regression. Retrieval misses are the large majority of bad
  answers, so this is the gate that earns its place.
- **Nightly or manual:** Ragas for faithfulness and answer relevancy. Kept, not deleted —
  retrieval metrics say nothing about generation quality.

This makes the README's CI badge mean something verifiable instead of drifting with judge
variance, and keeps the whole eval runnable on zero credits. Per Rules.md the eval bar may
not be lowered: the deeper metric survives, so this raises the gate's reliability rather
than weakening it. The eval set still grows every time a retrieval or generation bug is
found.

**Considered and rejected:** DeepEval (pytest-shaped, but pulls in a metric catalogue we do
not need and its interesting metrics are also LLM-judged), promptfoo (strong for prompt A/B
and red-teaming, not RAG retrieval metrics), Phoenix (reasonable Langfuse substitute, no real
gain here). Langfuse stays — tracing is a different job from scoring.

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
