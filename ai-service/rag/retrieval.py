"""Hybrid retrieval: dense pgvector + Postgres full-text, fused with RRF (proposal P1).

    score = Σ 1/(k + rank),  k = 60

RRF consumes *ranks*, not scores, which is the reason to prefer it here: there is no
principled way to normalise a ts_rank_cd value against a cosine distance, and RRF makes
that question disappear. A chunk that ranks top-3 on both arms wins; a chunk that is #1
lexically and invisible semantically still surfaces, which is exactly the behaviour a
finance assistant needs when the query is a merchant name or a UPI handle.

Three details in the SQL below are not stylistic. Each one is a silent failure:

1. `SET LOCAL hnsw.iterative_scan = 'relaxed_order'`. Every query here filters by user_id.
   On pgvector 0.8+ a strict filter against an HNSW index can return FEWER than LIMIT k
   rows — the index is searched first and the filter then discards, so a user whose rows
   are not in the first candidates simply gets nothing back. No error, just thin results.

2. `ORDER BY rrf_score DESC, id ASC`. Without the tiebreaker, equal scores come back in
   whatever order the heap produces, so the deterministic CI eval gate (P3) would flake
   between runs on unchanged code.

3. `user_id = %s` on both arms, inside the CTEs rather than only on the outer query. The
   filter has to constrain what is ranked, not just what is returned — otherwise the arms
   spend their LIMIT budget on other users' rows and the user's own are crowded out.

4. The lexical query is OR-joined, not AND-joined. See `_LEXICAL_TSQUERY` below — this one
   was found by a failing test, not by reading the docs, and it had silently disabled the
   entire lexical arm for every natural-language question.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .db import transaction
from .embeddings import embed_query, to_pgvector
from .settings import RRF_K

# websearch_to_tsquery joins its terms with AND. That is right for a search box, where the
# user typed exactly the words they want, and wrong for retrieval, where the "query" is a
# whole question. "how much did I spend at ZORVEX PANTRY" parses to
#     'much' & 'spend' & 'zorvex' & 'pantri'
# and a transaction sentence contains the merchant but none of the filler, so the match
# fails. Verified against the live container: the AND form returns false on the very row it
# should rank first, while the OR form returns true. The failure is silent — no error, the
# lexical arm just contributes nothing and hybrid quietly degrades to dense-only. A test
# asserting the target was found by BOTH arms is what surfaced it; it would never show up
# as a crash.
#
# So the parsed query is rewritten to OR and `ts_rank_cd` is left to do the discriminating:
# a row matching three terms outranks one matching one. Precision comes from ranking, not
# from demanding every term.
#
# The rewrite goes through websearch_to_tsquery first and only then swaps the operator, so
# the user's text is still parsed and escaped by Postgres and never becomes tsquery syntax.
# Confirmed on the live container: a punctuation-only query yields an empty tsquery that
# matches nothing rather than erroring, and a quoted phrase keeps its <-> phrase operator
# (`"zorvex pantry" grocery` -> `'zorvex' <-> 'pantri' | 'groceri'`), so phrase search
# still works.
_LEXICAL_TSQUERY = (
    "replace(websearch_to_tsquery('english', %(query)s)::text, '&', '|')::tsquery"
)

# How many candidates each arm contributes before fusion. Wider than the final k on
# purpose: a row that is rank 8 on one arm and rank 2 on the other should be able to win,
# which it cannot do if each arm only offers its top few.
ARM_LIMIT = 30


@dataclass
class Retrieved:
    id: int
    chunk_text: str
    source_type: str
    source_id: str | None
    rrf_score: float
    dense_rank: int | None
    lexical_rank: int | None

    @property
    def found_by(self) -> str:
        """Which arm(s) surfaced this row. Shown in the retrieval explanation."""
        if self.dense_rank is not None and self.lexical_rank is not None:
            return "both"
        if self.dense_rank is not None:
            return "semantic"
        return "keyword"


@dataclass
class RetrievalResult:
    rows: list[Retrieved] = field(default_factory=list)
    # Populated for the demo-facing "why did it return that?" view. Having to ask that
    # question is guaranteed; having to read SQL to answer it is not.
    explain: dict = field(default_factory=dict)


_HYBRID_SQL = """
WITH qry AS (
    SELECT {lexical_tsquery} AS tsq
),
dense AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY embedding <=> %(qvec)s::vector, id ASC) AS rank
    FROM documents
    WHERE user_id = %(user_id)s
      AND embedding IS NOT NULL
    ORDER BY embedding <=> %(qvec)s::vector, id ASC
    LIMIT %(arm_limit)s
),
lexical AS (
    SELECT d.id,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(d.chunk_tsv, qry.tsq) DESC, d.id ASC) AS rank
    FROM documents d
    CROSS JOIN qry
    WHERE d.user_id = %(user_id)s
      AND d.chunk_tsv @@ qry.tsq
    ORDER BY ts_rank_cd(d.chunk_tsv, qry.tsq) DESC, d.id ASC
    LIMIT %(arm_limit)s
)
SELECT d.id,
       d.chunk_text,
       d.source_type,
       d.source_id::text AS source_id,
       dense.rank   AS dense_rank,
       lexical.rank AS lexical_rank,
       COALESCE(1.0 / (%(rrf_k)s + dense.rank), 0)
     + COALESCE(1.0 / (%(rrf_k)s + lexical.rank), 0) AS rrf_score
FROM documents d
LEFT JOIN dense   ON dense.id   = d.id
LEFT JOIN lexical ON lexical.id = d.id
WHERE dense.id IS NOT NULL OR lexical.id IS NOT NULL
ORDER BY rrf_score DESC, d.id ASC
LIMIT %(k)s
"""

# The tsquery lives in its own CTE because a cast expression is not valid in a FROM list —
# `FROM documents, <expr> AS q` is a syntax error. It also means the question is parsed once
# per query rather than re-evaluated per candidate row.
#
# The single-arm variants exist so the eval can prove hybrid actually beats both of them on
# this corpus, rather than the claim resting on a blog post's benchmark. Same filters, same
# tiebreaker, so the comparison is apples to apples.
_DENSE_ONLY_SQL = """
SELECT id, chunk_text, source_type, source_id::text AS source_id,
       ROW_NUMBER() OVER (ORDER BY embedding <=> %(qvec)s::vector, id ASC) AS dense_rank,
       NULL::bigint AS lexical_rank,
       1.0 / (%(rrf_k)s + ROW_NUMBER() OVER (ORDER BY embedding <=> %(qvec)s::vector, id ASC)) AS rrf_score
FROM documents
WHERE user_id = %(user_id)s AND embedding IS NOT NULL
ORDER BY embedding <=> %(qvec)s::vector, id ASC
LIMIT %(k)s
"""

_LEXICAL_ONLY_SQL = """
WITH qry AS (
    SELECT {lexical_tsquery} AS tsq
)
SELECT d.id, d.chunk_text, d.source_type, d.source_id::text AS source_id,
       NULL::bigint AS dense_rank,
       ROW_NUMBER() OVER (ORDER BY ts_rank_cd(d.chunk_tsv, qry.tsq) DESC, d.id ASC) AS lexical_rank,
       ts_rank_cd(d.chunk_tsv, qry.tsq)::float AS rrf_score
FROM documents d
CROSS JOIN qry
WHERE d.user_id = %(user_id)s AND d.chunk_tsv @@ qry.tsq
ORDER BY ts_rank_cd(d.chunk_tsv, qry.tsq) DESC, d.id ASC
LIMIT %(k)s
"""

# .format only substitutes {lexical_tsquery}; the %(name)s placeholders are left alone and
# are still bound by psycopg, so no user value is ever formatted into a statement.
_MODES = {
    "hybrid": _HYBRID_SQL.format(lexical_tsquery=_LEXICAL_TSQUERY),
    "dense": _DENSE_ONLY_SQL,
    "lexical": _LEXICAL_ONLY_SQL.format(lexical_tsquery=_LEXICAL_TSQUERY),
}


def retrieve(user_id: str, query: str, k: int = 8, mode: str = "hybrid") -> RetrievalResult:
    """Retrieve the k most relevant documents for one user.

    `mode` is "hybrid" in production. "dense" and "lexical" exist for the eval and for the
    retrieval explanation, so the benefit of fusing can be demonstrated on real rows.
    """
    if mode not in _MODES:
        raise ValueError(f"unknown retrieval mode {mode!r}; expected one of {sorted(_MODES)}")

    params = {
        "user_id": user_id,
        "query": query,
        "k": k,
        "arm_limit": ARM_LIMIT,
        "rrf_k": RRF_K,
    }
    # The lexical-only arm never needs an embedding, so skip the model call entirely —
    # it keeps the eval's lexical baseline honest about its own cost.
    if mode != "lexical":
        params["qvec"] = to_pgvector(embed_query(query))

    with transaction() as cur:
        # See note 1 in the module docstring. SET LOCAL is scoped to this transaction, so
        # it cannot leak onto the next borrower of this pooled connection.
        cur.execute("SET LOCAL hnsw.iterative_scan = 'relaxed_order'")
        cur.execute(_MODES[mode], params)
        raw = cur.fetchall()

    rows = [
        Retrieved(
            id=r["id"],
            chunk_text=r["chunk_text"],
            source_type=r["source_type"],
            source_id=r["source_id"],
            rrf_score=float(r["rrf_score"]),
            dense_rank=int(r["dense_rank"]) if r["dense_rank"] is not None else None,
            lexical_rank=int(r["lexical_rank"]) if r["lexical_rank"] is not None else None,
        )
        for r in raw
    ]

    return RetrievalResult(
        rows=rows,
        explain={
            "mode": mode,
            "query": query,
            "rrf_k": RRF_K,
            "arm_limit": ARM_LIMIT,
            "returned": len(rows),
            "by_arm": {
                "both": sum(1 for r in rows if r.found_by == "both"),
                "semantic_only": sum(1 for r in rows if r.found_by == "semantic"),
                "keyword_only": sum(1 for r in rows if r.found_by == "keyword"),
            },
            "results": [
                {
                    "id": r.id,
                    "text": r.chunk_text,
                    "found_by": r.found_by,
                    "dense_rank": r.dense_rank,
                    "lexical_rank": r.lexical_rank,
                    "rrf_score": round(r.rrf_score, 6),
                }
                for r in rows
            ],
        },
    )
