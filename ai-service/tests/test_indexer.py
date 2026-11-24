"""Phase 4 — indexing transactions into `documents`, against real Postgres.

The property that matters here is idempotency. A transaction can legitimately be indexed
more than once — an ingest retry, a backfill overlapping live traffic, a re-run after the
render template changes — and duplicate documents rows would let one transaction occupy
several of the k retrieval slots, crowding out everything else. That failure is silent:
retrieval still "works", it just quietly answers from a narrower slice of history.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from rag import db
from rag.indexer import SOURCE_TRANSACTION, count_documents, index_transaction, reindex_user
from rag.retrieval import retrieve
from tests.conftest import requires_db


def _insert_transaction(user_id, *, amount="349.00", merchant="SYNTHETIC MART", source="sms",
                        day=15, is_duplicate=False, category_id=None):
    """A real transactions row, via the same columns the Node API writes."""
    tx_id = str(uuid.uuid4())
    with db.transaction() as cur:
        # linked_accounts is NOT NULL on transactions, so make one the way ingest does.
        cur.execute(
            """
            INSERT INTO linked_accounts (id, user_id, source, linked_at)
            VALUES (%s, %s, %s, NOW())
            RETURNING id
            """,
            (str(uuid.uuid4()), user_id, source),
        )
        account_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO transactions
                (id, user_id, linked_account_id, amount, merchant, category_id, source,
                 is_recurring, is_duplicate_flag, occurred_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, false, %s, %s, NOW())
            """,
            (
                tx_id, user_id, account_id, Decimal(str(amount)), merchant, category_id,
                source, is_duplicate, f"2026-03-{day:02d} 09:30:00+00",
            ),
        )
    return tx_id


@requires_db
def test_indexing_one_transaction_makes_it_retrievable(user_id):
    tx_id = _insert_transaction(user_id, merchant="ZORVEX PANTRY", amount="1249.00")

    result = index_transaction(tx_id)
    assert result["indexed"] == 1
    assert "ZORVEX PANTRY" in result["chunk_text"]
    assert count_documents(user_id) == 1

    # And it is findable through the real retriever, not just present in the table.
    found = retrieve(user_id, "what did I spend at ZORVEX PANTRY", k=5)
    assert any("ZORVEX PANTRY" in r.chunk_text for r in found.rows)

    # source_id points back at the transaction, which is what makes a citation possible.
    assert found.rows[0].source_id == tx_id
    assert found.rows[0].source_type == SOURCE_TRANSACTION


@requires_db
def test_reindexing_replaces_rather_than_duplicating(user_id):
    """The headline property. Indexing the same transaction five times leaves one row."""
    tx_id = _insert_transaction(user_id, merchant="ZORVEX PANTRY")

    for _ in range(5):
        index_transaction(tx_id)

    assert count_documents(user_id) == 1, (
        "re-indexing added rows instead of replacing — one transaction would then occupy "
        "several of the k retrieval slots and crowd out the rest of the user's history"
    )

    # And retrieval returns it once, not five times.
    rows = retrieve(user_id, "ZORVEX PANTRY", k=10).rows
    assert len([r for r in rows if "ZORVEX PANTRY" in r.chunk_text]) == 1


@requires_db
def test_reindexing_picks_up_an_edited_transaction(user_id):
    """Idempotent must not mean frozen: a corrected merchant has to reach the index."""
    tx_id = _insert_transaction(user_id, merchant="TYPOO MART")
    index_transaction(tx_id)

    with db.transaction() as cur:
        cur.execute("UPDATE transactions SET merchant = %s WHERE id = %s", ("ZORVEX PANTRY", tx_id))

    index_transaction(tx_id)

    assert count_documents(user_id) == 1
    rows = retrieve(user_id, "ZORVEX PANTRY", k=5).rows
    assert any("ZORVEX PANTRY" in r.chunk_text for r in rows)
    assert all("TYPOO MART" not in r.chunk_text for r in rows), "stale text survived a reindex"


@requires_db
def test_indexing_a_missing_transaction_reports_it_instead_of_raising(user_id):
    """Reachable in normal operation: a transaction deleted between enqueue and index."""
    result = index_transaction(str(uuid.uuid4()))
    assert result["indexed"] == 0
    assert "not found" in result["reason"]
    assert count_documents(user_id) == 0


@requires_db
def test_reindex_user_rebuilds_the_whole_history_and_stays_idempotent(user_id):
    """Needed whenever the render template or the embedding model changes — both
    invalidate every stored vector, since query and row text must come from the same
    model and the same shape to be comparable at all."""
    for day in range(1, 8):
        _insert_transaction(user_id, merchant=f"SHOP NUMBER {day}", amount=f"{day * 11}.00", day=day)

    first = reindex_user(user_id)
    assert first["transactions"] == 7
    assert first["indexed"] == 7
    assert count_documents(user_id) == 7

    # Running it again must not double the corpus.
    second = reindex_user(user_id)
    assert second["indexed"] == 7
    assert count_documents(user_id) == 7


@requires_db
def test_reindex_batches_without_losing_rows(user_id):
    """Batching exists so a long history does not hold every vector in memory at once
    (the Render free tier is the binding constraint). A batch boundary must not drop or
    duplicate anything."""
    for day in range(1, 11):
        _insert_transaction(user_id, merchant=f"SHOP {day}", day=day)

    # batch_size deliberately smaller than the row count, and not a divisor of it.
    result = reindex_user(user_id, batch_size=3)
    assert result["indexed"] == 10
    assert count_documents(user_id) == 10


@requires_db
def test_reindex_on_a_user_with_no_transactions_is_a_no_op(user_id):
    result = reindex_user(user_id)
    assert result == {"indexed": 0, "transactions": 0}
    assert count_documents(user_id) == 0


@requires_db
def test_duplicate_flagged_transactions_are_indexed_but_labelled(user_id):
    """They are excluded from dashboard totals but still part of history, so the assistant
    can explain them. The label is what stops the model contradicting the dashboard."""
    _insert_transaction(user_id, merchant="CHAI POINT", day=4)
    _insert_transaction(user_id, merchant="CHAI POINT", day=4, is_duplicate=True)

    reindex_user(user_id)
    assert count_documents(user_id) == 2

    rows = retrieve(user_id, "CHAI POINT", k=5).rows
    labelled = [r for r in rows if "flagged-duplicate" in r.chunk_text]
    assert len(labelled) == 1, "exactly one of the two should carry the duplicate label"


@requires_db
def test_indexing_never_writes_another_users_documents(user_id, other_user):
    """The delete-then-insert replace is scoped by user_id. If that scoping were wrong,
    indexing one user's transaction could delete another's documents — which would be a
    silent data-loss bug, since retrieval would simply return less."""
    other_tx = _insert_transaction(other_user, merchant="OTHER PERSON SHOP")
    index_transaction(other_tx)
    assert count_documents(other_user) == 1

    mine = _insert_transaction(user_id, merchant="ZORVEX PANTRY")
    for _ in range(3):
        index_transaction(mine)

    assert count_documents(user_id) == 1
    assert count_documents(other_user) == 1, "indexing one user disturbed another's documents"


@requires_db
def test_the_generated_tsvector_is_populated_by_the_indexer_path(user_id):
    """chunk_tsv is GENERATED, so the indexer never writes it. Prove it is populated
    anyway — if it were not, the lexical arm would be silently empty for every row."""
    tx_id = _insert_transaction(user_id, merchant="ZORVEX PANTRY")
    index_transaction(tx_id)

    with db.transaction() as cur:
        cur.execute(
            "SELECT chunk_tsv::text AS tsv FROM documents WHERE user_id = %s",
            (user_id,),
        )
        tsv = cur.fetchone()["tsv"]

    assert tsv, "chunk_tsv is empty, so this row is invisible to the lexical arm"
    assert "zorvex" in tsv
