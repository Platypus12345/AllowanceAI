-- Hybrid retrieval (docs/TechSpec.md §3, Schema.md §3 — approved proposal P1).
--
-- Adds the lexical arm of retrieval. `documents` already has vector(384) + an HNSW index
-- for the dense arm; this adds a full-text arm in the same table so both can be fused with
-- RRF in one query, with one backup and one consistency model.
--
-- The column is GENERATED ALWAYS ... STORED rather than maintained by application code or a
-- trigger: it cannot then drift out of sync with chunk_text, because there is no write path
-- that could forget to update it.
--
-- 'english' is hardcoded, not a parameter. A tsvector generated column requires an
-- IMMUTABLE expression, and the single-argument to_tsvector(text) is only STABLE — it reads
-- default_text_search_config at runtime — so Postgres rejects it here. The two-argument form
-- with a literal regconfig is immutable and is accepted. Changing the language later is a
-- new migration, not a settings change.

ALTER TABLE "documents"
  ADD COLUMN "chunk_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "chunk_text")) STORED;

CREATE INDEX IF NOT EXISTS "documents_chunk_tsv_gin_idx"
  ON "documents" USING gin ("chunk_tsv");

-- Retrieval is always scoped to one user, and both arms filter on it before ranking. Without
-- this the lexical arm has to seq-scan the whole table to apply the user filter, which
-- defeats the point of the GIN index above.
CREATE INDEX IF NOT EXISTS "documents_user_id_idx"
  ON "documents" ("user_id");

-- Re-embedding and re-indexing are per (user, source) operations: "replace everything I hold
-- for this transaction". Without this index that lookup is a seq scan on every single
-- ingested transaction, which is the hottest write path in the product.
CREATE INDEX IF NOT EXISTS "documents_user_source_idx"
  ON "documents" ("user_id", "source_type", "source_id");
