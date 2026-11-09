# AllowanceAI — Proposals

Status: **none of this is implemented or approved.** Every item below is a proposal
awaiting Aditya's decision. Nothing here changed any spec or code. Approved items go
through docs first (separate commit), then implementation, per Rules.md.

Written 2026-11-09. Each claim is either verified against a source linked at the bottom,
reproduced locally (marked **reproduced**), or flagged as my judgement.

The hard constraint is honoured throughout: every recommendation stays free (open source
or a free tier), and nothing here is proposed for keyword value alone. Where a trendy
option is not worth it at this scale, I say so — see P9, P10 and P11.

---

## Ranked summary

| # | Proposal | Recommendation | Effort | Touches |
|---|---|---|---|---|
| P1 | Hybrid retrieval: pgvector + Postgres FTS fused with RRF | **adopt now** (Phase 4 design) | M | Schema, TechSpec |
| P2 | Pin the embedding model to a 384-dim local model | **adopt now** (decision, no code) | S | TechSpec |
| P3 | Deterministic retrieval eval in CI; demote Ragas to nightly | **adopt now** (Phase 5 DoD) | M | ImplementationPlan, TechSpec |
| P4 | Transaction "chunking": one row → one deterministic sentence | **adopt now** (Phase 4 design) | S | TechSpec, Schema |
| P5 | Keep LangGraph, but keep the graph linear — no agentic RAG | **adopt now** (confirms TechSpec) | — | TechSpec note |
| P6 | Model strategy built for longevity, not one vendor free tier | **adopt later** (Phase 4); principle now | S | TechSpec, .env.example |
| P7 | Guardrails: Pydantic + a numeric cross-check before Guardrails AI | **adopt later** (Phase 5) | M | TechSpec |
| P8 | MCP server exposing AllowanceAI as read-only tools | **adopt later** (post-Phase 5) | L | TechSpec, new phase |
| P9 | Drop RabbitMQ from the critical path | **adopt later / partial** | S | TechSpec, Rules |
| P10 | Cross-encoder reranking | **skip for now** | M | — |
| P11 | LLM query rewriting | **skip for now** | S | — |

**If you only approve three:** P1, P3, P4. They are the ones that decide whether the
assistant gives correct answers and whether you can prove it cheaply. P2 is a 2-minute
decision that you are already locked into by the schema, so read it even if you skip the rest.

---

## P1 — Hybrid retrieval: pgvector + Postgres full-text search, fused with RRF

**What.** Keep the HNSW vector index, add a generated `tsvector` column with a GIN index,
run both retrievers per query and fuse the two ranked lists with Reciprocal Rank Fusion
(`score = Σ 1/(k + rank)`, `k = 60`). No new service, no new dependency — both halves are
already inside the Postgres you are running.

**Why it is better.** Pure vector search is weak exactly where a finance assistant must be
strong: exact tokens. A benchmark on **PostgreSQL 17 + pgvector 0.8.7** (the same pgvector
version your compose container reports — **reproduced**: `vector | 0.8.7`) over 30 chunks
and 15 golden queries measured:

| Method | Recall@1 | Recall@5 | MRR@10 | Latency |
|---|---|---|---|---|
| Dense only (`<=>`) | 73.3% | 100% | 0.819 | 1.23 ms |
| Full-text only (`ts_rank_cd`) | 66.7% | 66.7% | 0.667 | 0.74 ms |
| **Hybrid RRF** | **100%** | **100%** | **1.000** | 1.99 ms |

Dense search lost at rank 1 on exact identifiers because chunks from one document cluster
tightly in cosine space; full-text alone collapsed to 0% Recall@5 on paraphrases. For
AllowanceAI the identifier case is the common one: "what did I spend at SYNTHETIC MART",
a UPI handle, a reference number. Those are lexical, not semantic.

**Two gotchas from the same source that matter specifically to us:**

1. **Per-user metadata filtering can starve results.** With a `WHERE user_id = ...` filter
   against an HNSW index on pgvector 0.8+, set
   `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` inside the transaction, or a strict
   filter can return fewer than `LIMIT k` rows. Every AllowanceAI query is user-filtered,
   so this is not an edge case for us — it is the default path.
2. **Add a deterministic tiebreaker:** `ORDER BY rrf_score DESC, id ASC`. Without it, ties
   come back in arbitrary heap order and the CI eval in P3 will flake between runs.

**Cost.** $0. No extra service; one generated column plus a GIN index.

**Effort.** M — one migration, one SQL query, plus the two settings above.

**Risk.** Low. Additive: the vector path keeps working if the FTS arm is removed. The GIN
index costs write throughput and some disk, irrelevant at student-project volume. Note the
benchmark is a single blog's 30-chunk dataset, not a peer-reviewed result — the direction is
well supported, the exact numbers should not be quoted as ours.

**Changes.** Schema.md: `documents` gains a `tsvector` generated column + GIN index (new
migration). TechSpec.md §3: the retrieve node becomes two retrievers plus a fusion step.

**Recommendation: adopt now**, as the Phase 4 design, before any retrieval code is written.
Retrofitting hybrid search after the fact means rewriting the retrieve node and re-running
every eval.

---

## P2 — The embedding model is already pinned to 384 dimensions. Choose deliberately.

**What.** `Schema.md` / `schema.prisma` declare `embedding vector(384)`. That is not a
neutral default — it silently excludes most current embedding models:

| Model | Dims | Fits `vector(384)`? | License |
|---|---|---|---|
| `all-MiniLM-L6-v2` | 384 | yes | Apache 2.0 |
| `bge-small-en-v1.5` | 384 | yes | MIT |
| `nomic-embed-text` | 768 | no | Apache 2.0 |
| `EmbeddingGemma-300M` | 768 | no | Gemma |
| `BGE-M3` | 1024 | no | MIT |
| `gemini-embedding-001` | 3072 (truncatable) | not natively | API |

So the real choice today is **`bge-small-en-v1.5` vs `all-MiniLM-L6-v2`**, and I would take
`bge-small-en-v1.5`: same 384 dims, same CPU-friendly size class, MIT, and consistently
better retrieval quality in published comparisons.

**Why local-open rather than a free API.** Embeddings are the one call you make on *every
ingested transaction*, not just on user questions. A free API tier metered in requests/day
is the wrong shape for that: a month of transactions can exhaust a daily quota in one
backfill. A local sentence-transformers model has no quota, no key, no network failure mode,
and runs in CI for free — which P3 depends on.

**Cost.** $0, and no API key to leak. ~130 MB model download, CPU inference.

**Effort.** S. It is a decision, not a change — the column already matches.

**Risk.** Low. Caveat: Render's free tier is memory-constrained, so run embedding generation
in `ai-service/` and watch RSS. If 384 dims later proves limiting, changing dimension means
a migration plus a full re-embed — which is exactly why this should be a conscious decision
now rather than a default discovered in Phase 4.

**Changes.** TechSpec.md: name the embedding model and dimension explicitly, and say why
384. No schema change (that is the point).

**Recommendation: adopt now.** Also worth stating plainly in the docs that `vector(384)`
was a real constraint — a reviewer who knows embeddings will ask.

---

## P3 — Deterministic retrieval eval in CI; demote Ragas to nightly/manual

**What.** Phase 5's DoD currently requires a Ragas score on every PR touching
`ai-service/`. Ragas metrics are mostly **LLM-as-judge**, which means every CI run costs
tokens, needs a key in CI, is rate-limited on a free tier, and is non-deterministic — the
same code can score differently twice.

Proposal: split evaluation in two.

- **CI gate (every PR):** a golden set of question → expected-chunk-id pairs, scored with
  **Recall@K, MRR, NDCG** in plain numpy. No LLM, no key, no network. Deterministic, runs
  in seconds, fails the build on a real regression. This catches retrieval misses, which
  the source above reports were ~90% of bad answers.
- **Deeper eval (nightly or manual):** Ragas for faithfulness and answer relevancy, where
  a judge genuinely is the right tool. Keep the eval set growing per Rules.md.

**Why it is better.** It makes the CI badge in your README mean something verifiable rather
than something that silently drifts with judge variance — and it keeps the eval runnable
with zero credits, which is the actual constraint. Ragas is explicitly noted in comparisons
as having no built-in CI runner, unlike DeepEval; a hand-rolled numpy gate is simpler than
adopting a second framework.

**On alternatives you asked about:** DeepEval is the pytest-shaped option and would be the
pick if you wanted a framework for the gate, but it pulls in a metric catalogue you do not
need and most of its interesting metrics are also LLM-judged. promptfoo is strong for prompt
A/B and red-teaming, not for RAG retrieval metrics. Langfuse stays — tracing is a different
job from scoring, and self-hosted/free-tier Langfuse is still the right call for the demo.
Phoenix is a reasonable Langfuse substitute; not worth switching, no real gain here.

**Cost.** $0 for the CI gate (that is the point). Ragas nightly uses a free-tier key.

**Effort.** M — write 15-20 golden pairs and ~100 lines of scoring.

**Risk.** Low. Retrieval metrics need labelled expected chunks, which is manual work; and
they do not measure generation quality at all, which is why Ragas stays rather than being
deleted. Rules.md forbids lowering the eval bar — this raises the gate's reliability while
keeping the deeper metric, so it should not count as a weakening, but it does change a
committed DoD and therefore needs your explicit approval.

**Changes.** ImplementationPlan.md Phase 5 DoD; TechSpec.md §4; `ai-service/eval/` layout.

**Recommendation: adopt now** — specifically, decide it *before* Phase 5 so the DoD you
gate against is the one you can actually satisfy for free.

---

## P4 — Do not "chunk" transactions. One row → one deterministic sentence.

**What.** For transactions, skip text chunking entirely: render each row into a fixed
template (`"2024-01-15 · debit ₹349.00 · SYNTHETIC MART · source=sms"`) and embed that,
with `user_id`, `occurred_at`, `amount` and `source` as filterable columns. Reserve
structure-aware chunking for free text (user notes), splitting on headings/paragraphs and
never mid-table or mid-sentence.

**Why it is better.** Generic chunkers actively harm structured financial data. The source
above found sliding windows producing chunks with **80-94% token overlap**, which stuffed
duplicate text into the prompt and **made the LLM hallucinate numbers** — the single worst
failure mode for this product. It also caught truncated table rows and mid-sentence cutoffs
before indexing. A transaction row is already an atomic record; chunking it can only lose
information or duplicate it.

This also reinforces TechSpec §3's existing split: exact amounts come from the rules node
via SQL, never from retrieval. Retrieval is for "which transactions is the user talking
about", not "how much".

**Cost.** $0.

**Effort.** S — a formatting function and a pre-index sanity check.

**Risk.** Low. A template is less flexible than free-form text, but for a fixed schema that
is a feature: it is deterministic and reproducible, so an eval run is comparable over time.

**Changes.** TechSpec.md §3 (embedding pipeline); Schema.md note that `documents.source_id`
points at one transaction and `chunk_text` is generated, not user prose.

**Recommendation: adopt now** as the Phase 4 design.

---

## P5 — Keep LangGraph, but keep the graph linear. No agentic RAG.

**What.** Confirm the existing TechSpec graph (retrieve → rules → generate → guardrails) and
explicitly rule out an autonomous agent that decides its own tool sequence.

**Why.** Current roundups still treat LangGraph as the default for stateful graphs with
explicit checkpoints and approval gates, and its cost is that it needs graph-oriented design
work. For a four-node mostly-linear pipeline, a plain tool-calling loop would honestly be
*enough* — so the fair justification for LangGraph here is the checkpointing, the
token-streaming story, per-node unit tests (which Rules.md already requires) and Langfuse
tracing, not "orchestration" in the abstract. It is also a tool mandate in Rules.md, and
switching frameworks the week of a demo would be a bad trade.

**Why reject the *agentic* variant specifically.** Four concrete reasons, in order of how
much they matter here:

1. **Exact figures must come from SQL, not from a model's choice of steps.** TechSpec §3
   already splits this correctly: the rules node runs the actual aggregate query, and
   retrieval only identifies *which* transactions the user means. An agent free to choose
   its own path can skip the SQL step and answer "about ₹8,000" from retrieved text. For a
   budgeting app, "about" is a defect, and a confidently wrong number is indistinguishable
   from a right one to the user.
2. **Non-determinism breaks the CI gate in P3.** If the graph takes a different route per
   run, the eval score measures the route rather than retrieval quality, and the build fails
   or passes for reasons unrelated to the change under test. You cannot gate on a number
   that moves by itself.
3. **It multiplies LLM calls.** Reason → tool → reflect → tool is 3-6 calls per question
   instead of one. Against any free tier that is the difference between a demo that works
   and a demo that hits a quota wall mid-presentation.
4. **It is weaker to defend.** "Retrieval is fixed and the arithmetic is SQL, so the number
   is always correct" is a strong viva answer. "The agent decides how to answer" invites
   exactly the question you do not want asked.

**What is *not* being rejected:** tool-calling as a mechanism, or adding a bounded loop
later for genuinely open-ended requests (for example "help me plan next month", or one retry
when retrieval returns nothing). The proposal is to keep the core
"how much did I spend on X" path fixed, because that path has a correct answer that the
database already knows. Start fixed and provably correct; add a loop only where an eval
shows it helps.

Lighter SDKs (PydanticAI and similar) are a reasonable fit at this scale but are not worth a
migration given LangGraph is already a Rules.md mandate.

**Cost / Effort / Risk.** None — this ratifies the current plan.

**Changes.** One clarifying paragraph in TechSpec.md §3 recording that agentic RAG was
considered and rejected, with the reason.

**Recommendation: adopt now** (documentation only). Writing down a rejected alternative is
worth more to a reviewer than silently not doing it.

---

## P6 — Model strategy built for longevity, not for one vendor's free tier

**Revised 2026-11-09** after Aditya asked for a choice that "goes a long way" rather than a
free tier that lapses in a month. That was the right challenge; the first version of this
proposal answered the wrong question.

**The finding that reframes it.** I went to the official pages instead of the roundups.
Google's rate-limit page **does not publish free-tier RPM/RPD/TPM numbers at all** — it says
limits "depend on a variety of factors (such as your usage tier) and can be viewed in Google
AI Studio", and adds "Specified rate limits are not guaranteed and actual capacity may
vary", while the pricing page says "Rate limits are subject to change". Groq's rate-limit
table does not state which plan each row belongs to.

So the premise "pick the most generous free tier" is unsound: **no provider's free tier is a
contract.** The durable thing is an architecture where the provider is not load-bearing.

**What.** Three layers, with the expiry risk pushed off the critical path:

| Layer | Choice | Why it cannot lapse |
|---|---|---|
| **Embeddings** — runs on *every ingested transaction* | `bge-small-en-v1.5`, local (sentence-transformers / fastembed) | No key, no quota, no vendor, no expiry. Already matches `vector(384)` per P2 |
| **Categorisation** | the existing TF-IDF + Logistic Regression model | Pure local scikit-learn, zero API calls |
| **Chat** — only on a user question | OpenAI-compatible config, already in the repo: Gemini Flash-Lite class by default, local Ollama model as fallback | Swappable with one env var |

Plus: cache chat answers in Redis (already in the stack) so a repeated demo question costs
nothing and a quota error cannot break a live presentation.

**Why this is genuinely durable — the architectural point.** Because exact figures come from
the rules node's SQL (TechSpec §3) and never from the model, **the LLM only phrases text. It
never does arithmetic.** That has a direct consequence: a *small* model is sufficient, so you
can fall back to a local 3B-class model and lose prose polish, not correctness. A design that
needs a frontier model to be *correct* is the fragile one; this one degrades gracefully.
Embeddings are the only call that scales with data volume, and that layer has no vendor at
all.

**Privacy, which is not a rate-limit issue.** Gemini's free tier card states
"Content used to improve our products" (the paid card says content is **not** so used, and
per-model rows read "Yes" for free-tier models). A chat prompt here carries real transaction
context. For a student portfolio on synthetic data that is an acceptable, *documented*
trade; it is also the strongest argument for keeping embeddings and categorisation local, and
for treating the local Ollama path as first-class rather than a curiosity.

**Cost.** $0. Quota ceilings rather than a bill, and the local layers have neither.

**Effort.** S — the swappable config already exists (`OPENAI_BASE_URL` / `OPENAI_MODEL`);
this is a default plus a fallback plus a cache.

**Risk.** Low, now that nothing critical depends on one tier. The residual risks are real but
bounded: local embedding inference needs RAM on Render's free tier (measure RSS, or move it
to a worker), and Ollama is a dev/self-host story, not something that runs on Render free.

**Changes.** TechSpec.md §8 (name the embedding model and dimension, the default chat model,
and the fallback); `.env.example` for the provider variables. No schema change.

**Recommendation: adopt later** (Phase 4, when the chat endpoint is built) — **but adopt the
*principle* now**: never let a free tier sit on the critical path, and keep every per-record
computation local. Nothing needs changing today, because the config is already swappable.

**Do not** use: anything billed as trial credits that expire (Cerebras' $5/30-day trial,
Cohere trial keys capped at 1,000 calls/month and not licensed for production). Those are the
options that actually fail in a month, and they are the ones to avoid for exactly the reason
Aditya raised.

**Related — keep the categoriser local.** The TF-IDF + Logistic Regression model is the right
call and should not be replaced by an LLM: deterministic, free per call, offline, no quota.
96.4% on 420 synthetic samples is adequate here. Use an LLM only as a fallback for
low-confidence predictions. Be ready to say in the viva that the accuracy is measured on
synthetic data, so it validates the pipeline rather than real-world performance.

**Related:** the TF-IDF + Logistic Regression categoriser you mentioned for `ai-service/ml/`
is the right call and I would not replace it with an LLM. It is deterministic, costs nothing
per call, runs offline, needs no quota, and 96.4% on 420 synthetic samples is adequate for
categorisation. Keep an LLM only as the fallback for low-confidence predictions. Be ready to
say in the viva that the accuracy is on synthetic data, so it measures the pipeline, not
real-world performance.

---

## P7 — Guardrails: validate with Pydantic + a numeric cross-check before reaching for Guardrails AI

**What.** Implement the guardrails node as (a) a Pydantic-typed structured response, and
(b) a hard assertion that every number the model emitted appears in the rules-node SQL
result. Add Guardrails AI only where those two do not cover a real failure you have seen.

**Why.** The failure you actually care about — a hallucinated amount — is best caught by
comparing the output against ground truth you already fetched, not by a general-purpose
validation framework. A string/number cross-check is deterministic, free, instant, testable
without an LLM (which Rules.md requires of every node), and cannot itself hallucinate.
Guardrails AI is a reasonable tool but is a dependency and a config surface, and some of its
validators are themselves model-based.

**Cost.** $0 either way.

**Effort.** M.

**Risk.** Low-medium. This touches a Rules.md tool mandate, so it needs explicit approval,
and I am proposing *ordering*, not removal: keep Guardrails AI in the stack and in the
graph, but let the cheap deterministic check carry the load it is better at.

**Changes.** TechSpec.md §3 and §4; possibly a Rules.md note.

**Recommendation: adopt later** (Phase 5). Do not touch `ai-service/eval/` as part of it —
Rules.md puts that behind an explicit ask.

---

## P8 — Expose AllowanceAI as a read-only MCP server

**What.** A small MCP server (in `ai-service/`, or its own folder with a TechSpec update)
exposing read-only tools: `list_transactions`, `get_budget_status`, `get_safe_to_spend`,
`spend_by_category`. Any MCP client could then query a user's finances in natural language.

**Why it genuinely fits.** This is the one MCP idea here that is not decoration: you already
have the hard part (a clean per-user data layer with exact SQL aggregates), and MCP is the
current standard way to expose it. It is also an honest, demonstrable talking point.

**How auth must work — this is the whole risk.** Per the MCP authorization spec
(2026-07-28), a protected MCP server is an **OAuth 2.1 resource server**: it must implement
Protected Resource Metadata (RFC 9728) to advertise its authorization server, return that
metadata URL in `WWW-Authenticate` on a 401, and **validate access tokens** per OAuth 2.1
§5.2 — including that the token's audience is this server (clients send the `resource`
parameter for exactly that). Per-user isolation is then *your* job, not the spec's: derive
`user_id` from validated token claims only, never from a tool argument, and enforce it in
every query's `WHERE` clause. Note that is my inference — the spec pages I read cover
authorization, not data scoping.

**Cost.** $0 (self-hosted alongside `ai-service/`).

**Effort.** L — OAuth resource-server plumbing is the bulk of it, not the tools.

**Risk.** **High, and specifically a data-leak risk.** One missing `user_id` predicate
exposes another user's finances to an external client. It also widens the attack surface
(MCP tool poisoning / prompt injection are active research areas). Mitigations: read-only
tools only, `user_id` from token claims only, a test per tool asserting user A cannot read
user B, and rate limiting.

**Changes.** TechSpec.md (new service + auth section); a new phase in ImplementationPlan.md
with its own DoD — the cross-user isolation test should *be* the DoD.

**Recommendation: adopt later**, after Phase 5, and only read-only. Do **not** build it
before the core loop works — a half-built MCP server is worth less than a working dashboard,
and the consequence of rushing the isolation logic is leaking real financial data.

**On the other direction (consuming MCP servers):** using a Gmail/Calendar MCP server for
the Future Scope ingestion idea is tempting but worse than the planned Gmail API path for
now — it adds a dependency and an OAuth flow for a feature that is already in Backlog behind
Setu AA. Skip until AA ingestion is actually done.

---

## P9 — Drop RabbitMQ from the critical path

**What.** Keep RabbitMQ in `docker-compose.yml` (it costs nothing idle) but stop treating it
as required infrastructure. If embedding generation needs to move off the request path, use
Postgres `SELECT ... FOR UPDATE SKIP LOCKED` as the job queue.

**Why.** You are already running Postgres and Redis. A third broker for "generate embeddings
after ingest" is more moving parts, another healthcheck, another thing to explain, and
another thing that can be down during a demo. `SKIP LOCKED` is a standard, boring,
well-understood pattern, gives you durability and retries in the database you already trust,
and keeps the whole job visible in SQL. This is the clearest case in this document of the
plan being over-engineered for its scale.

Counterpoint, stated fairly: RabbitMQ is a recognisable line on a CV and Rules.md mandates
it. If the resume signal is worth more to you than the simplicity, keeping it is a defensible
choice — but then it should carry real traffic rather than sit in compose unused, because an
unused broker is the kind of thing an interviewer probes.

**Cost.** $0 either way.

**Effort.** S.

**Risk.** Low technically; it contradicts a Rules.md tool mandate, so it needs your call.

**Changes.** Rules.md required-tools list; TechSpec.md §6.

**Recommendation: adopt later / partial.** Phase 2 already met its DoD with synchronous
ingest, so nothing is blocked. Decide when Phase 4 actually needs async embedding.

---

## P10 — Cross-encoder reranking — **skip for now**

A local `bge-reranker-base` cross-encoder would improve ordering, and production RAG
write-ups routinely list reranking among the things that mattered. But: hybrid RRF (P1)
already took Recall@1 from 73% to 100% on the cited benchmark, a cross-encoder adds real CPU
latency per query on a free-tier host, and you have no evidence yet that ranking is your
bottleneck. Build P1 and P3 first; if the eval shows the right chunk being retrieved but
ranked low, add reranking then, with numbers justifying it. Cost $0, effort M — but
unjustified effort at this stage.

## P11 — LLM query rewriting — **skip for now**

Rewriting the user's question before retrieval helps with vague multi-turn queries, but it
spends an extra LLM call on *every* question — directly against a free-tier quota — and adds
a non-deterministic step ahead of retrieval, which makes the P3 eval harder to interpret.
The lexical arm from P1 already covers the paraphrase/keyword gap that rewriting is usually
brought in to fix. Revisit only if the eval shows paraphrase misses that hybrid search did
not catch.

---

## Also reviewed, no change proposed

- **PostgreSQL + pgvector over a dedicated vector DB** — correct, and more so now that
  hybrid search (P1) wants the lexical index in the same database. Keeping embeddings beside
  the financial data avoids a sync problem you would otherwise have to solve.
- **Redis** — justified: dashboard aggregates, rate-limit counters, chat session memory.
- **Sentry, Cloudflare R2, Vercel, Render, GitHub Actions** — all fine on free tiers.
- **Kubernetes stays out of scope** — right call; the existing note about an optional
  `minikube` demo folder is the honest way to handle it.
- **Prisma 6 → 7** — v7 moves the migration URL from `schema.prisma` into
  `prisma.config.ts`. Worth doing eventually, deliberately not now (already in Backlog).
- **`docker-compose.yml` `version:` key** — obsolete and ignored by Compose; it prints a
  warning on every command. Trivial cleanup, in Backlog.

---

## Sources

Verified by reading these, 2026-11-09. Blog and vendor sources are labelled as such; where
sources disagreed or could not confirm a claim, the proposal says so.

**Reproduced locally (strongest evidence here):** pgvector 0.8.7 in the project's own
`pgvector/pgvector:pg16` container; the `vector`-extension schema trap and its
`ALTER EXTENSION ... SET SCHEMA public` fix; Prisma 6.19.3 requiring `DIRECT_URL` for
`migrate deploy` but not for `generate`. See DEPLOYMENT.md and Tracker.md.

**Hybrid search / pgvector** (dev.to, community benchmarks — single-author datasets):
- Muhammad Talha, "What broke when I tested pgvector vs Postgres full-text search vs Hybrid RRF on 30 tricky RAG chunks (and how I fixed it for $0)" — https://dev.to/mtalha5/what-broke-when-i-tested-pgvector-vs-postgres-full-text-search-vs-hybrid-rrf-on-30-tricky-rag-4f8l
  (source of the recall table, the `hnsw.iterative_scan` and tiebreaker gotchas, the chunk-overlap findings, and the "90% of bad answers were retrieval misses" figure)
- Redouane, "How to build production RAG AI agents: document ETL, chunking, hybrid search, reranking, LangGraph orchestration. 13 lessons that cut costs 15-20x." — https://dev.to/redouane_cc/how-to-build-production-rag-ai-agents-document-etl-chunking-hybrid-search-reranking-langgraph-2ae6
- Gabriel Anhaia, "Postgres With pgvector vs Pinecone: 1 Million Embeddings, One Honest Comparison" — https://dev.to/gabrielanhaia/postgres-with-pgvector-vs-pinecone-1-million-embeddings-one-honest-comparison-3og3
- Gabriel Anhaia, "Hybrid Search in 100 Lines: BM25 + pgvector with RRF Merge" — https://dev.to/gabrielanhaia/hybrid-search-in-100-lines-bm25-pgvector-with-rrf-merge-58cn
- "Full-Text vs pgvector vs Hybrid Search, Measured" — https://dev.to/devopsdaily/full-text-vs-pgvector-vs-hybrid-search-measured-50jj

**MCP authorization** (official specification):
- "Understanding Authorization in MCP" — https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization
- "Authorization" (draft spec) — https://modelcontextprotocol.io/specification/draft/basic/authorization
- "Authorization Server Discovery" — https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery

**Prisma + Supabase** (official docs):
- "Supabase (Prisma ORM v6)" — https://www.prisma.io/docs/orm/overview/databases/supabase

**Embedding models** (vendor-adjacent roundups; MTEB scores are only comparable within one benchmark variant):
- "Best Embedding Models for RAG (2026): Ranked by MTEB Score, Cost, and Self-Hosting" — https://www.premai.io/blog/best-embedding-models-for-rag-2026-ranked-by-mteb-score-cost-and-self-hosting/
- "Best Free Embedding Models & APIs in 2026" — https://www.edenai.co/post/top-free-embedding-tools-apis-and-open-source-models

**Eval tooling** (vendor-adjacent comparisons):
- "DeepEval vs Promptfoo vs Ragas: AI Agent Testing in 2026" — https://scrolltest.com/deepeval-vs-promptfoo-vs-ragas/
- "LLM Evaluation Framework Benchmark 2026" — https://aiml.qa/llm-evaluation-framework-benchmark-2026/

**Orchestration** (vendor-adjacent listicles; treat rankings as opinion):
- "We Tested 8 LangGraph Alternatives for Scalable Agent Orchestration" (ZenML) — https://www.zenml.io/blog/langgraph-alternatives
- "LangGraph Alternatives 2026: 12 Options for Production" (Sim AI) — https://www.sim.ai/library/langgraph-alternatives

**LLM free tiers — official pages (read 2026-11-09; these supersede the roundups below):**
- Gemini API rate limits — https://ai.google.dev/gemini-api/docs/rate-limits (redirects to https://aistudio.google.com/docs/rate-limits). Publishes **no** free-tier RPM/RPD/TPM; states limits "can be viewed in Google AI Studio" and "Specified rate limits are not guaranteed and actual capacity may vary".
- Gemini API pricing — https://ai.google.dev/gemini-api/docs/pricing (redirects to https://aistudio.google.com/docs/pricing). Flash-class models listed "Free of charge"; free card says "Content used to improve our products"; "Rate limits are subject to change".
- Groq rate limits — https://console.groq.com/docs/rate-limits. Has a numeric table, but it does not state which plan tier each row belongs to, so the numbers cannot be attributed to the free plan with confidence.

**Free LLM tiers — third-party roundups** (figures vary between sources and change often; several quoted model names could not be confirmed — treat as indicative only):
- "Free LLM APIs in 2026: every free tier, its limits and its data terms" — https://www.developersdigest.tech/models/free-api
- "9 free LLM APIs compared: rate limits, card rules and the catch (2026)" — https://dev.to/aifree/9-free-llm-apis-compared-rate-limits-card-rules-and-the-catch-2026-3hhj
- "Free LLM API in 2026: 13 Options Ranked and Compared" (OpenRouter) — https://openrouter.ai/blog/tutorials/free-llm-apis-compared/
