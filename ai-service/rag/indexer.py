"""Write transactions into `documents` as embedded sentences.

Indexing is idempotent per (user_id, source_type, source_id): re-indexing the same
transaction replaces its row instead of adding a second one. That matters more than it
looks. A transaction can be written more than once in normal operation — an ingest retry,
a backfill overlapping live traffic, a re-run after changing the render template — and
duplicate documents rows would quietly skew retrieval by letting one transaction occupy
several of the k slots, crowding out everything else.

`documents` has no unique constraint on that triple (adding one is a migration, and this
has to work against the schema as deployed), so the replace is delete-then-insert inside
one transaction rather than an ON CONFLICT upsert.
"""

from __future__ import annotations

import logging

from .db import transaction
from .embeddings import embed_texts, to_pgvector
from .render import render_transaction

log = logging.getLogger(__name__)

SOURCE_TRANSACTION = "transaction_summary"

# Reads the columns render_transaction needs, joining the category name in so the sentence
# can carry it. Ordered oldest-first so a partial backfill leaves a contiguous history
# rather than scattered holes.
_SELECT_TRANSACTIONS = """
SELECT t.id::text        AS id,
       t.user_id::text   AS user_id,
       t.amount,
       t.merchant,
       t.source,
       t.occurred_at,
       t.is_duplicate_flag,
       c.name            AS category_name
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = %(user_id)s
ORDER BY t.occurred_at ASC, t.id ASC
"""

_SELECT_ONE_TRANSACTION = _SELECT_TRANSACTIONS.replace(
    "WHERE t.user_id = %(user_id)s", "WHERE t.id = %(transaction_id)s"
)


def _replace_documents(cur, user_id: str, rows: list[tuple[str, str, list[float]]]) -> int:
    """Delete then insert, for one source_type, inside the caller's transaction."""
    if not rows:
        return 0
    source_ids = [source_id for source_id, _, _ in rows]
    cur.execute(
        """
        DELETE FROM documents
        WHERE user_id = %(user_id)s
          AND source_type = %(source_type)s
          AND source_id::text = ANY(%(source_ids)s)
        """,
        {"user_id": user_id, "source_type": SOURCE_TRANSACTION, "source_ids": source_ids},
    )
    # chunk_tsv is deliberately absent: it is a GENERATED column and Postgres rejects a
    # direct write to it. The lexical index therefore cannot drift from chunk_text.
    cur.executemany(
        """
        INSERT INTO documents (user_id, source_type, source_id, chunk_text, embedding)
        VALUES (%(user_id)s, %(source_type)s, %(source_id)s::uuid, %(chunk_text)s, %(embedding)s::vector)
        """,
        [
            {
                "user_id": user_id,
                "source_type": SOURCE_TRANSACTION,
                "source_id": source_id,
                "chunk_text": text,
                "embedding": to_pgvector(vector),
            }
            for (source_id, text, vector) in rows
        ],
    )
    return len(rows)


def index_transaction(transaction_id: str) -> dict:
    """Index one transaction. Called after a transaction is created."""
    with transaction() as cur:
        cur.execute(_SELECT_ONE_TRANSACTION, {"transaction_id": transaction_id})
        row = cur.fetchone()
        if row is None:
            return {"indexed": 0, "reason": "transaction not found"}

        text = render_transaction(row)
        vector = embed_texts([text])[0]
        count = _replace_documents(cur, row["user_id"], [(row["id"], text, vector)])
        return {"indexed": count, "chunk_text": text}


def reindex_user(user_id: str, batch_size: int = 128) -> dict:
    """Rebuild every transaction document for one user.

    Needed whenever the render template or the embedding model changes — both of which
    invalidate stored vectors, since a query vector and a stored vector have to come from
    the same model and the same text shape to be comparable at all.
    """
    with transaction() as cur:
        cur.execute(_SELECT_TRANSACTIONS, {"user_id": user_id})
        rows = cur.fetchall()
        if not rows:
            return {"indexed": 0, "transactions": 0}

        texts = [render_transaction(r) for r in rows]
        total = 0
        # Batched so one user with a long history does not hold the whole corpus of
        # vectors in memory at once — the Render free tier is the binding constraint.
        for start in range(0, len(rows), batch_size):
            chunk_rows = rows[start : start + batch_size]
            chunk_texts = texts[start : start + batch_size]
            vectors = embed_texts(chunk_texts)
            total += _replace_documents(
                cur,
                user_id,
                [
                    (r["id"], t, v)
                    for r, t, v in zip(chunk_rows, chunk_texts, vectors)
                ],
            )
        return {"indexed": total, "transactions": len(rows)}


def count_documents(user_id: str) -> int:
    with transaction() as cur:
        cur.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE user_id = %(user_id)s",
            {"user_id": user_id},
        )
        return int(cur.fetchone()["n"])
