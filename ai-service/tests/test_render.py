"""Phase 4 — transaction rendering (proposal P4). Pure, no database, no model.

The template's output is what gets embedded, so a change here silently invalidates every
stored vector: a query embedded from new-shaped text and a row embedded from old-shaped
text are no longer comparable. These tests exist mostly to make that change loud.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from rag.render import render_note, render_transaction


def _row(**overrides):
    base = {
        "amount": Decimal("349.00"),
        "merchant": "SYNTHETIC MART",
        "source": "sms",
        "occurred_at": datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc),
        "is_duplicate_flag": False,
        "category_name": None,
    }
    base.update(overrides)
    return base


def test_the_template_is_exactly_what_the_spec_documents():
    """TechSpec 3.2 shows this example. If the rendering drifts from the doc, the doc is
    no longer describing the system."""
    assert render_transaction(_row()) == "2026-01-15 · debit ₹349.00 · SYNTHETIC MART · source=sms"


def test_direction_follows_the_sign_convention_not_a_separate_field():
    """Positive is a debit, negative a credit — the convention smsParser, setuAdapter and
    createManual all share. Rendering it as a word is what makes "did I get paid" and
    "what did I spend" lexically distinguishable."""
    assert "debit ₹349.00" in render_transaction(_row(amount=Decimal("349")))
    assert "credit ₹5000.00" in render_transaction(_row(amount=Decimal("-5000")))

    # The amount is always rendered as its magnitude; the direction word carries the sign.
    assert "₹-5000" not in render_transaction(_row(amount=Decimal("-5000")))


def test_category_is_included_only_when_present():
    with_cat = render_transaction(_row(category_name="Food"))
    assert with_cat == "2026-01-15 · debit ₹349.00 · SYNTHETIC MART · Food · source=sms"

    # No empty separator when there is no category.
    assert "·  ·" not in render_transaction(_row(category_name=None))
    assert "·  ·" not in render_transaction(_row(category_name=""))


def test_a_duplicate_flagged_row_says_so():
    """Flagged rows are still indexed, so the assistant can answer "why does this look
    double-counted". They are labelled so the model can see the row was excluded from
    totals rather than silently contradicting the dashboard."""
    text = render_transaction(_row(is_duplicate_flag=True))
    assert "flagged-duplicate (not counted in totals)" in text


def test_merchant_case_is_preserved():
    """The merchant is the most common lexical needle in a finance question, so it is
    never lowercased or abbreviated — the lexical arm stems it anyway, and preserving the
    original is what makes the retrieved text readable in a citation."""
    assert "ZORVEX PANTRY" in render_transaction(_row(merchant="ZORVEX PANTRY"))


def test_missing_fields_degrade_to_labels_rather_than_None_or_a_crash():
    """Every one of these is reachable: SMS parsing can fail to find a merchant, and an
    unparsed date is better rendered than crashed on mid-backfill."""
    assert "unknown merchant" in render_transaction(_row(merchant=None))
    assert "unknown merchant" in render_transaction(_row(merchant=""))
    assert "source=unknown" in render_transaction(_row(source=None))
    assert "unknown-date" in render_transaction(_row(occurred_at=None))
    assert "debit ₹0.00" in render_transaction(_row(amount=None))
    assert "None" not in render_transaction(_row(merchant=None, source=None, occurred_at=None))


def test_dates_are_normalised_to_utc_so_the_text_matches_the_dashboard():
    """The dashboard aggregates in UTC. A row rendered in local time would be filed under
    a different day than the one the dashboard counts it in."""
    # 15 Jan 2026 23:30 UTC+05:30 is 18:00 UTC on the 15th.
    assert render_transaction(_row(occurred_at="2026-01-15T23:30:00+05:30")).startswith("2026-01-15")
    # 00:30 UTC+05:30 on the 16th is 19:00 UTC on the 15th — the UTC day, not the local one.
    assert render_transaction(_row(occurred_at="2026-01-16T00:30:00+05:30")).startswith("2026-01-15")

    # A naive timestamp is read as UTC rather than guessed at.
    assert render_transaction(_row(occurred_at=datetime(2026, 1, 15, 9))).startswith("2026-01-15")

    # The Z suffix that JSON uses.
    assert render_transaction(_row(occurred_at="2026-01-15T09:30:00Z")).startswith("2026-01-15")


def test_amounts_keep_two_decimal_places():
    """Amounts are a lexical token in the index ('rs349.00' is one tsvector lexeme), so an
    inconsistent format would make them unsearchable."""
    assert "₹349.00" in render_transaction(_row(amount=Decimal("349")))
    assert "₹349.50" in render_transaction(_row(amount=Decimal("349.5")))
    assert "₹1249.00" in render_transaction(_row(amount=1249))
    assert "₹0.99" in render_transaction(_row(amount="0.99"))


def test_rendering_is_deterministic():
    """Same row in, same string out — no timestamps, no ordering, nothing from the clock.
    Re-indexing an unchanged transaction must not produce a different embedding."""
    row = _row(category_name="Food", is_duplicate_flag=True)
    assert len({render_transaction(row) for _ in range(20)}) == 1


def test_notes_pass_through_stripped():
    assert render_note("  I am saving for a trip  ") == "I am saving for a trip"
    assert render_note(None) == ""
    assert render_note("") == ""
