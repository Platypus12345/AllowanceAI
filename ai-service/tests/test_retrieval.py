"""Phase 4 — hybrid retrieval against real Postgres and real embeddings.

ImplementationPlan's Phase 4 DoD says the hybrid claim must be *demonstrated* rather than
taken on faith, because P1 was adopted on the strength of one blog's 30-chunk benchmark.
These tests are that demonstration, on this product's own data shape — and one of them
records an honest negative result, because the measured benefit here is narrower than the
cited benchmark implied.

The four obligations from the plan, and where each is met:
  1. hybrid beats a single arm on an exact-token question
     -> test_hybrid_beats_the_dense_arm_on_an_exact_identifier
  2. identical ordering across runs (the id ASC tiebreaker)
     -> test_ordering_is_deterministic_across_runs
  3. a user-filtered query still returns k rows (hnsw.iterative_scan)
     -> test_user_filtered_query_still_fills_k
  4. retrieval never crosses user_id
     -> test_retrieval_never_crosses_users
"""

from __future__ import annotations

import pytest

from rag.retrieval import ARM_LIMIT, retrieve
from tests.conftest import requires_db

# A corpus shaped like this product's data. The distractors are deliberately *semantically*
# very close to each question ("utility bill payment reference number", "a bakery payment"),
# which is the condition under which dense search misranks an exact token.
CORPUS = [
    "2026-03-02 · debit ₹1249.00 · ZORVEX PANTRY · Food · source=sms",
    "2026-03-03 · debit ₹340.00 · corner grocery shop · Food · source=sms",
    "2026-03-04 · debit ₹820.00 · neighbourhood supermarket · Food · source=manual",
    "2026-03-05 · debit ₹150.00 · grocery store purchase · Food · source=sms",
    "2026-03-06 · debit ₹2100.00 · big weekly food shopping · Food · source=setu_aa",
    "2026-03-07 · debit ₹95.00 · tea stall near campus · Food · source=sms",
    "2026-03-08 · debit ₹460.00 · metro card top up · Transport · source=sms",
    "2026-03-09 · debit ₹1800.00 · monthly phone bill · Other · source=setu_aa",
    "2026-03-10 · credit ₹5000.00 · pocket money from home · source=manual",
    "2026-03-11 · debit ₹700.00 · cinema tickets · Entertainment · source=manual",
    "2026-03-12 · debit ₹275.00 · UPI qwertybakery@okaxis · Food · source=sms",
    "2026-03-13 · debit ₹410.00 · UPI payment to a bakery for bread · Food · source=sms",
    "2026-03-14 · debit ₹388.00 · bakery and confectionery purchase · Food · source=manual",
    "2026-03-15 · debit ₹512.00 · payment to local baker shop · Food · source=sms",
    # The reference-number row, with three semantically-adjacent bill rows around it. This
    # is the case where the dense arm measurably loses at rank 1.
    "2026-03-16 · debit ₹299.00 · ref 884421 · electricity bill · Other · source=setu_aa",
    "2026-03-17 · debit ₹1100.00 · utility bill payment reference number · Other · source=setu_aa",
    "2026-03-18 · debit ₹640.00 · paid the monthly power bill online · Other · source=manual",
]

MERCHANT_TARGET = CORPUS[0]
CINEMA_TARGET = CORPUS[9]
UPI_TARGET = CORPUS[10]
REF_TARGET = CORPUS[14]

# Measured on this corpus: dense #2, lexical #1, hybrid #1.
REF_QUESTION = "transaction with reference 884421"


def _rank_of(result, text: str) -> int | None:
    """1-based position of `text` in a result list, or None if absent."""
    for i, row in enumerate(result.rows, start=1):
        if row.chunk_text == text:
            return i
    return None


@requires_db
def test_hybrid_beats_the_dense_arm_on_an_exact_identifier(user_id, index_texts):
    """The justification for adopting P1, measured on our own data rather than asserted.

    A reference number is the case the P1 source described: dense search loses at rank 1 on
    exact identifiers, because semantically-adjacent rows ("utility bill payment reference
    number", "paid the monthly power bill online") crowd it out in cosine space.

    The guard assertions at the end are the important part. They fail if the corpus stops
    exercising the hybrid case at all, so this test cannot quietly decay into passing for
    the wrong reason — which is exactly how a benefit claim rots into folklore.
    """
    index_texts(CORPUS)

    hybrid = retrieve(user_id, REF_QUESTION, k=5, mode="hybrid")
    dense = retrieve(user_id, REF_QUESTION, k=5, mode="dense")
    lexical = retrieve(user_id, REF_QUESTION, k=5, mode="lexical")

    hybrid_rank = _rank_of(hybrid, REF_TARGET)
    dense_rank = _rank_of(dense, REF_TARGET)
    lexical_rank = _rank_of(lexical, REF_TARGET)

    assert hybrid_rank == 1, (
        f"hybrid put the target at {hybrid_rank}, not 1.\n"
        + "\n".join(f"  {r.rrf_score:.5f} {r.found_by:9} {r.chunk_text}" for r in hybrid.rows)
    )

    # Hybrid must be at least as good as either arm alone.
    for name, rank in (("dense", dense_rank), ("lexical", lexical_rank)):
        assert rank is None or hybrid_rank <= rank, f"hybrid is worse than {name} alone"

    # GUARD: a single arm must actually get this wrong, or the assertions above prove
    # nothing about fusion.
    assert dense_rank is not None and dense_rank > 1, (
        f"expected the dense arm to misrank this identifier, got #{dense_rank}. The corpus "
        "no longer exercises the hybrid case — fix the corpus, do not delete the assertion."
    )

    assert hybrid.rows[0].found_by == "both"


@requires_db
def test_dense_search_already_handles_distinctive_merchant_names(user_id, index_texts):
    """An honest negative result, recorded so nobody oversells the hybrid win.

    P1 was adopted citing a benchmark where dense-only scored 73% Recall@1 and hybrid 100%.
    On *this* data shape the gap is much narrower: for a distinctive merchant name or a UPI
    handle, the dense arm alone already ranks the right row #1 — subword tokenisation gives
    the embedding plenty to work with even on an invented brand token.

    So the measured value of hybrid here is specifically on numeric and reference-style
    identifiers, not on merchant names generally. Proposals.md already warned that the
    source's exact numbers must not be quoted as ours; this test makes that concrete, and
    it is why the P3 eval gate measures our own corpus instead of trusting a blog post.
    """
    index_texts(CORPUS)

    for question, target in (
        ("how much did I spend at ZORVEX PANTRY", MERCHANT_TARGET),
        ("what did I pay qwertybakery@okaxis", UPI_TARGET),
    ):
        dense_rank = _rank_of(retrieve(user_id, question, k=5, mode="dense"), target)
        assert dense_rank == 1, (
            f"dense no longer ranks {question!r} first (#{dense_rank}) — if this changed, "
            "the claim in this test's docstring needs re-measuring"
        )
        # Fusing must never regress a case the single arm already got right.
        assert _rank_of(retrieve(user_id, question, k=5, mode="hybrid"), target) == 1


@requires_db
def test_fusing_can_demote_a_semantic_only_match(user_id, index_texts):
    """The cost side of RRF, pinned rather than discovered in production.

    A row only the semantic arm found scores 1/(60+dense_rank). Rows that *both* arms found
    get two terms and can overtake it. That is RRF working as designed, but it means hybrid
    is not a free improvement: a purely semantic match can come back a place or two lower
    than dense-only would have placed it. Worth knowing; worth not being surprised by.
    """
    index_texts(CORPUS)
    question = "how much was the bakery payment"

    dense_rank = _rank_of(retrieve(user_id, question, k=10, mode="dense"), UPI_TARGET)
    hybrid_rank = _rank_of(retrieve(user_id, question, k=10, mode="hybrid"), UPI_TARGET)

    assert dense_rank is not None
    # Still retrieved, which is what matters for grounding — just not promoted.
    assert hybrid_rank is not None, "a semantic-only match must still be retrieved"
    assert hybrid_rank - dense_rank <= 2, (
        f"hybrid demoted a semantic-only match by {hybrid_rank - dense_rank} places, more "
        "than the small reordering this test was written to tolerate"
    )


@requires_db
def test_lexical_arm_finds_an_exact_token_in_a_natural_language_question(user_id, index_texts):
    """Pins the websearch_to_tsquery AND-vs-OR fix.

    Before the OR rewrite in retrieval.py, this returned nothing: the parsed query was
    'much' & 'spend' & 'zorvex' & 'pantri', and the transaction sentence has the merchant
    but none of the filler words, so the AND failed. The lexical arm contributed nothing to
    any natural-language question and hybrid silently degraded to dense-only.

    Reverting to the AND form fails this test and the "found_by == both" assertions above.
    """
    index_texts(CORPUS)

    # A whole question, not just keywords — this is what broke.
    lexical = retrieve(user_id, "how much did I spend at ZORVEX PANTRY", k=5, mode="lexical")
    assert lexical.rows, "the lexical arm returned nothing for a natural-language question"
    assert _rank_of(lexical, MERCHANT_TARGET) == 1

    # And the UPI handle, which is the other shape of lexical needle.
    upi = retrieve(user_id, "what did I pay qwertybakery@okaxis", k=5, mode="lexical")
    assert _rank_of(upi, UPI_TARGET) == 1


@requires_db
def test_dense_arm_finds_a_paraphrase_with_no_shared_words(user_id, index_texts):
    """The converse: the lexical arm alone collapses on wording it has never seen.

    Pins that adding full-text search did not cost us the semantic behaviour, which is the
    risk of "fixing" the exact-token problem with keyword search alone.
    """
    index_texts(CORPUS)
    question = "money I used on a movie theatre outing"

    # "cinema tickets" shares no stem with "movie theatre outing".
    assert _rank_of(retrieve(user_id, question, k=3, mode="hybrid"), CINEMA_TARGET) is not None
    assert _rank_of(retrieve(user_id, question, k=3, mode="lexical"), CINEMA_TARGET) is None


@requires_db
def test_ordering_is_deterministic_across_runs(user_id, index_texts):
    """Obligation 2: the `id ASC` tiebreaker.

    Without it, ties come back in heap order and the P3 CI eval gate would flake between
    runs on unchanged code — the worst kind of gate, since it trains people to re-run
    rather than investigate.
    """
    # Deliberately identical text, so scores tie exactly and only the tiebreaker can
    # decide the order.
    tied_text = "identical row for tie testing"
    index_texts([tied_text] * 5 + CORPUS)

    runs = [
        [(r.id, round(r.rrf_score, 9)) for r in retrieve(user_id, "identical row", k=8).rows]
        for _ in range(4)
    ]
    assert all(r == runs[0] for r in runs), runs

    # And the tied ids really are ascending, i.e. the tiebreaker is what ordered them.
    tied = [r.id for r in retrieve(user_id, "identical row", k=8).rows if r.chunk_text == tied_text]
    assert len(tied) >= 2, "need at least two tied rows for this to mean anything"
    assert tied == sorted(tied), tied


@requires_db
def test_user_filtered_query_still_fills_k(user_id, other_user, index_texts):
    """Obligation 3: `SET LOCAL hnsw.iterative_scan = 'relaxed_order'`.

    On pgvector 0.8+ a strict WHERE user_id filter against an HNSW index can return fewer
    than LIMIT k rows: the index is searched first and the filter discards afterwards. The
    failure is silent — thin results, no error. Here the target user's rows are a small
    minority of the table, which is the condition that provokes it.
    """
    # A lot of noise owned by someone else...
    index_texts(
        [f"2026-04-{d:02d} · debit ₹{d * 7}.00 · other person shop {d} · source=sms" for d in range(1, 29)],
        owner=other_user,
    )
    # ...and only a handful owned by us.
    index_texts(CORPUS[:6])

    result = retrieve(user_id, "what did I spend on food", k=6)
    assert len(result.rows) == 6, (
        f"asked for 6, got {len(result.rows)} — a user-filtered HNSW scan came back thin, "
        "which is what hnsw.iterative_scan is set to prevent"
    )


@requires_db
def test_retrieval_never_crosses_users(user_id, other_user, index_texts):
    """Obligation 4. The one failure here that is a privacy incident, not a bug."""
    secret = "2026-05-01 · debit ₹99999.00 · VERYPRIVATECLINIC · Health · source=setu_aa"
    index_texts([secret], owner=other_user)
    index_texts(CORPUS)

    # Ask for it by its exact, unique merchant name — the strongest possible pull.
    for mode in ("hybrid", "dense", "lexical"):
        result = retrieve(user_id, "VERYPRIVATECLINIC 99999", k=10, mode=mode)
        assert all(r.chunk_text != secret for r in result.rows), f"{mode} leaked another user's row"

    # The owner can still find it, so the filter is scoping rather than merely hiding.
    assert _rank_of(retrieve(other_user, "VERYPRIVATECLINIC", k=5, mode="hybrid"), secret) == 1


@requires_db
def test_empty_corpus_and_unmatchable_query_return_nothing_rather_than_raising(user_id, index_texts):
    """Both empty paths, because each is a plausible real state."""
    assert retrieve(user_id, "anything at all", k=5).rows == []

    index_texts(CORPUS)

    # websearch_to_tsquery on punctuation alone yields an empty tsquery, so the lexical arm
    # matches nothing. The dense arm must still carry the query rather than erroring.
    result = retrieve(user_id, "???", k=5, mode="hybrid")
    assert all(r.lexical_rank is None for r in result.rows)
    assert len(result.rows) > 0, "the dense arm should still answer when the query has no terms"

    assert retrieve(user_id, "???", k=5, mode="lexical").rows == []


@requires_db
def test_explain_reports_which_arm_found_each_row(user_id, index_texts):
    """The retrieval explanation is demo-facing, so its shape is pinned."""
    index_texts(CORPUS)
    result = retrieve(user_id, REF_QUESTION, k=5)

    assert result.explain["mode"] == "hybrid"
    assert result.explain["rrf_k"] == 60
    assert result.explain["arm_limit"] == ARM_LIMIT
    assert result.explain["returned"] == len(result.rows)

    by_arm = result.explain["by_arm"]
    assert by_arm["both"] + by_arm["semantic_only"] + by_arm["keyword_only"] == len(result.rows)
    assert by_arm["both"] >= 1

    first = result.explain["results"][0]
    assert set(first) == {"id", "text", "found_by", "dense_rank", "lexical_rank", "rrf_score"}
    assert first["found_by"] in {"both", "semantic", "keyword"}


@requires_db
def test_an_unknown_mode_is_rejected_rather_than_silently_running_hybrid(user_id):
    with pytest.raises(ValueError, match="unknown retrieval mode"):
        retrieve(user_id, "anything", mode="bm25")
