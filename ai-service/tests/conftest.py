"""Shared fixtures: a real Postgres, a real user, real embedded rows.

Nothing here mocks the database or the embedding model. The claims these tests make —
that hybrid retrieval beats both single arms, that retrieval never crosses users, that a
user-filtered HNSW query still returns k rows — are claims about Postgres and pgvector
behaviour. Mocking either one would turn them into claims about the mock.

The LLM *is* mocked, everywhere, per Rules.md: every graph node must have a test that runs
without hitting a real LLM API.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Must be set before rag.settings is imported anywhere.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai",
)

from rag import db  # noqa: E402
from rag.indexer import SOURCE_TRANSACTION  # noqa: E402


def _database_available() -> bool:
    try:
        with db.transaction() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return True
    except Exception:
        return False


requires_db = pytest.mark.skipif(
    not _database_available(),
    reason="needs the docker-compose Postgres on 5433 (or DATABASE_URL set)",
)


@pytest.fixture(scope="session", autouse=True)
def _close_pool():
    yield
    db.close_pool()


@pytest.fixture
def user_id():
    """A real users row, deleted afterwards.

    documents.user_id is a real FK with ON DELETE CASCADE, so deleting the user takes its
    documents with it — no test can leave rows behind to pollute another's retrieval.
    """
    uid = str(uuid.uuid4())
    with db.transaction() as cur:
        cur.execute(
            "INSERT INTO users (id, email, created_at) VALUES (%s, %s, NOW())",
            (uid, f"rag-{uid[:8]}@example.invalid"),
        )
    yield uid
    with db.transaction() as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (uid,))


@pytest.fixture
def index_texts(user_id):
    """Index arbitrary sentences for `user_id`, bypassing the transactions table.

    Lets a retrieval test state its corpus literally, in the file, instead of inferring it
    from rows constructed three fixtures away.
    """
    from rag.embeddings import embed_texts, to_pgvector

    def _index(texts: list[str], owner: str | None = None) -> list[int]:
        owner = owner or user_id
        vectors = embed_texts(texts)
        ids = []
        with db.transaction() as cur:
            for text, vector in zip(texts, vectors):
                cur.execute(
                    """
                    INSERT INTO documents (user_id, source_type, source_id, chunk_text, embedding)
                    VALUES (%s, %s, NULL, %s, %s::vector)
                    RETURNING id
                    """,
                    (owner, SOURCE_TRANSACTION, text, to_pgvector(vector)),
                )
                ids.append(cur.fetchone()["id"])
        return ids

    return _index


@pytest.fixture
def other_user():
    uid = str(uuid.uuid4())
    with db.transaction() as cur:
        cur.execute(
            "INSERT INTO users (id, email, created_at) VALUES (%s, %s, NOW())",
            (uid, f"rag-other-{uid[:8]}@example.invalid"),
        )
    yield uid
    with db.transaction() as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (uid,))
