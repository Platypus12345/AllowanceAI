"""Postgres access for the RAG subsystem.

A small connection pool rather than a connection per request: Supabase's pooler and the
Render free tier both have low connection ceilings, and the Node API is already holding
some of them through Prisma.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

from .settings import load_settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        dsn = load_settings().database_url
        # min_size=0 so importing this module never opens a socket — tests and `--help`
        # must not require a database. open=False + open() keeps psycopg 3.2 from warning
        # about implicit pool opening.
        _pool = ConnectionPool(dsn, min_size=0, max_size=4, kwargs={"row_factory": dict_row}, open=False)
        _pool.open()
    return _pool


@contextmanager
def transaction() -> Iterator:
    """A cursor inside a transaction.

    Retrieval needs a real transaction, not autocommit: `SET LOCAL hnsw.iterative_scan`
    only takes effect within one, and SET LOCAL is the right scope precisely because it
    reverts when the transaction ends rather than leaking onto the next borrower of this
    pooled connection.
    """
    with get_pool().connection() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                yield cur


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
