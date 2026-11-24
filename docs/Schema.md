# AllowanceAI — Schema.md

## 1. PostgreSQL tables

```sql
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,              -- null if Google-OAuth-only
  google_id TEXT UNIQUE,
  monthly_allowance NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
)

linked_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  source TEXT NOT NULL,             -- 'sms' | 'setu_aa' | 'gmail' | 'manual'
  consent_handle TEXT,              -- Setu AA consent reference, nullable
  status TEXT DEFAULT 'active',
  linked_at TIMESTAMP DEFAULT NOW()
)

categories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE
)

transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  linked_account_id UUID REFERENCES linked_accounts(id),
  amount NUMERIC NOT NULL,
  merchant TEXT,
  category_id UUID REFERENCES categories(id),
  source TEXT NOT NULL,             -- mirrors linked_accounts.source for quick filtering
  is_recurring BOOLEAN DEFAULT FALSE,
  is_duplicate_flag BOOLEAN DEFAULT FALSE,
  raw_text TEXT,                    -- original SMS/email text, for re-parsing/audit
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

budgets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  category_id UUID REFERENCES categories(id),
  amount NUMERIC NOT NULL,
  period TEXT DEFAULT 'monthly',
  created_at TIMESTAMP DEFAULT NOW()
)

goals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  target_date DATE
)

badges (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT
)

user_badges (
  user_id UUID REFERENCES users(id),
  badge_id UUID REFERENCES badges(id),
  earned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
)

notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
)

-- RAG memory: embedded chunks the assistant retrieves from.
-- Populated from transaction summaries, user notes, and past chat turns worth remembering.
documents (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  source_type TEXT NOT NULL,        -- 'transaction_summary' | 'chat_turn' | 'user_note'
  source_id UUID,                   -- points back to the originating row where applicable
  chunk_text TEXT NOT NULL,
  chunk_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  embedding VECTOR(384),            -- FROZEN at 384: bge-small-en-v1.5 (TechSpec 3.1)
  created_at TIMESTAMP DEFAULT NOW()
)
-- dense arm:   CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
-- lexical arm: CREATE INDEX ON documents USING gin (chunk_tsv);

audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
)
```

## 2. Redis key patterns

| Key pattern | Purpose | TTL |
|---|---|---|
| `session:{session_id}:history` | Recent chat turns (list) | 24h |
| `cache:embedding:{text_hash}` | Cached query embeddings | 1h |
| `cache:dashboard:{user_id}` | Precomputed dashboard aggregates | 5min, invalidated on new transaction |
| `ratelimit:{user_id}:{route}` | Rate-limit counters | 1min window |

## 3. Notes on `documents` / pgvector

- **The embedding dimension is frozen at 384**, pinned to `bge-small-en-v1.5` (TechSpec §3.1).
  Changing the model's dimension means a migration *plus* a full re-embed of every existing
  row, not just new ones. Decide once; this is that decision.
- `documents` is scoped per-user (`user_id`) — retrieval queries must always filter by
  `user_id` first, then rank within that filter. Never let similarity search cross user
  boundaries.
- **Retrieval is hybrid** (TechSpec §3, P1): dense cosine over `embedding` plus Postgres FTS
  over the generated `chunk_tsv` column, fused with RRF. `chunk_tsv` is `GENERATED ALWAYS ...
  STORED`, so it can never drift out of sync with `chunk_text` — there is no application code
  that could forget to update it.
- **Because every query is user-filtered**, the retrieve node must
  `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` inside its transaction. On pgvector 0.8+
  a strict `WHERE user_id = ...` against HNSW can otherwise return fewer than `LIMIT k` rows.
- Tie-break retrieval ordering on `id ASC` after the fused score, or the deterministic CI
  eval gate (TechSpec §4) flakes on unchanged code.
- **Transaction rows are never chunked** — one row becomes one templated sentence (TechSpec
  §3.2). Chunking is only for free-text user notes.

## 4. Indexing notes

- `transactions(user_id, occurred_at)` — composite index, this is the most common query pattern (user's transactions in a date range).
- `documents` — HNSW index on `embedding` for approximate nearest-neighbour search, **and** a
  GIN index on the generated `chunk_tsv` column for the lexical arm of hybrid retrieval. Both
  are required: dropping either silently halves retrieval quality rather than erroring.
- Foreign keys throughout should cascade on user deletion (`ON DELETE CASCADE`) for clean account deletion.
