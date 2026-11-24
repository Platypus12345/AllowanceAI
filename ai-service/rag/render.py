"""Turn a database row into the one sentence that gets embedded (proposal P4).

No chunking. One transaction row becomes one deterministic sentence from a fixed template.
Generic sliding-window chunkers on structured financial rows produce chunks with 80-94%
token overlap, which stuffs near-duplicate text into the prompt and makes the model
hallucinate numbers — the worst failure mode this product has. Structure-aware chunking is
reserved for genuinely free text (user notes).

The template is append-only by contract. Changing the wording of an existing field changes
every embedding, so the stored vectors and a freshly computed query vector would no longer
live in the same space until everything is re-embedded. If this template changes, every
documents row of that source_type must be rebuilt — which is what `reindex_user` is for.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

# Mirrors the spend convention from smsParser / setuAdapter / createManual:
#   amount > 0 -> debit (money out, "spend")
#   amount < 0 -> credit (money in)
# Rendering the direction as a word rather than leaving it implicit in the sign is what
# makes "did I get paid" and "what did I spend" lexically distinguishable.
DEBIT = "debit"
CREDIT = "credit"


def _fmt_amount(amount: Any) -> str:
    value = Decimal(str(amount if amount is not None else 0))
    return f"{abs(value):.2f}"


def _fmt_date(occurred_at: Any) -> str:
    if isinstance(occurred_at, datetime):
        dt = occurred_at
    elif occurred_at:
        dt = datetime.fromisoformat(str(occurred_at).replace("Z", "+00:00"))
    else:
        return "unknown-date"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def render_transaction(row: dict) -> str:
    """One transaction row -> one sentence.

    Example:
        2026-01-15 · debit ₹349.00 · SYNTHETIC MART · Food · source=sms

    Every component is a filterable column too (user_id, occurred_at, amount, source), so
    the rules node can still get exact numbers by SQL. This text exists for *finding* the
    row, not for being the authority on its numbers.
    """
    amount = row.get("amount")
    direction = CREDIT if (amount is not None and Decimal(str(amount)) < 0) else DEBIT

    parts = [
        _fmt_date(row.get("occurred_at")),
        f"{direction} ₹{_fmt_amount(amount)}",
        # Merchant is the single most common lexical needle in a finance question
        # ("what did I spend at X"), so it is never abbreviated or lowercased.
        (row.get("merchant") or "unknown merchant"),
    ]
    if row.get("category_name"):
        parts.append(str(row["category_name"]))
    parts.append(f"source={row.get('source') or 'unknown'}")

    # A duplicate-flagged row is still indexed — the assistant should be able to answer
    # "why does this look like it was counted twice" — but it is labelled so the model
    # can see it was excluded from totals rather than silently contradicting them.
    if row.get("is_duplicate_flag"):
        parts.append("flagged-duplicate (not counted in totals)")

    return " · ".join(str(p) for p in parts)


def render_note(text: str) -> str:
    """User notes are free text and pass through unchanged.

    This is the only source_type where chunking would ever be appropriate; it is not
    implemented yet because nothing in the product writes notes.
    """
    return (text or "").strip()
