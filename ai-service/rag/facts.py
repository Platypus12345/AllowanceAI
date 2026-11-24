"""The rules node's data source: exact numbers, straight from SQL.

TechSpec §3 splits retrieval from rules on purpose. Amounts and balances must come from a
direct query, never from vector similarity — RAG is for *context and history*, not for
numbers that have to be right. A retrieved sentence saying "debit ₹1249.00" is evidence
that a transaction exists; it is not the authority on what the month's total is.

Every aggregate here repeats the conventions the dashboard established, because the
assistant contradicting the dashboard is worse than the assistant saying "I don't know":
  * amount > 0 is a debit (spend); amount < 0 is a credit, never counted as spend
  * is_duplicate_flag rows are excluded, or the assistant undoes duplicate detection
  * the month window is UTC, matching dashboardService.monthWindow
"""

from __future__ import annotations

from datetime import datetime, timezone

from .db import transaction

_FACTS_SQL = """
WITH bounds AS (
    SELECT date_trunc('month', %(now)s::timestamptz AT TIME ZONE 'UTC') AS month_start,
           (date_trunc('month', %(now)s::timestamptz AT TIME ZONE 'UTC')
                + INTERVAL '1 month')                                   AS month_end,
           date_trunc('day', %(now)s::timestamptz AT TIME ZONE 'UTC')   AS day_start
),
spend AS (
    SELECT COALESCE(SUM(t.amount), 0) AS month_spend,
           COUNT(*)                   AS month_count
    FROM transactions t, bounds b
    WHERE t.user_id = %(user_id)s
      AND t.is_duplicate_flag = false
      AND t.amount > 0
      AND t.occurred_at >= b.month_start
      AND t.occurred_at <  b.month_end
),
today AS (
    SELECT COALESCE(SUM(t.amount), 0) AS today_spend
    FROM transactions t, bounds b
    WHERE t.user_id = %(user_id)s
      AND t.is_duplicate_flag = false
      AND t.amount > 0
      AND t.occurred_at >= b.day_start
      AND t.occurred_at <  b.month_end
)
SELECT u.monthly_allowance,
       spend.month_spend,
       spend.month_count,
       today.today_spend,
       b.month_start,
       b.month_end
FROM users u, spend, today, bounds b
WHERE u.id = %(user_id)s
"""

# Per-category spend this month, so "what am I spending most on" is answered by SQL rather
# than by the model counting retrieved sentences — which it does badly and confidently.
_BY_CATEGORY_SQL = """
SELECT COALESCE(c.name, 'Uncategorised') AS category,
       SUM(t.amount)                     AS spent,
       COUNT(*)                          AS transactions
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = %(user_id)s
  AND t.is_duplicate_flag = false
  AND t.amount > 0
  AND t.occurred_at >= date_trunc('month', %(now)s::timestamptz AT TIME ZONE 'UTC')
  AND t.occurred_at <  date_trunc('month', %(now)s::timestamptz AT TIME ZONE 'UTC') + INTERVAL '1 month'
GROUP BY COALESCE(c.name, 'Uncategorised')
ORDER BY SUM(t.amount) DESC
LIMIT 10
"""

_BUDGETS_SQL = """
SELECT COALESCE(c.name, 'Overall') AS category,
       b.amount                    AS budget,
       b.period,
       COALESCE((
           SELECT SUM(t.amount)
           FROM transactions t
           WHERE t.user_id = b.user_id
             AND t.is_duplicate_flag = false
             AND t.amount > 0
             AND (b.category_id IS NULL OR t.category_id = b.category_id)
             AND t.occurred_at >= date_trunc('month', %(now)s::timestamptz AT TIME ZONE 'UTC')
             AND t.occurred_at <  date_trunc('month', %(now)s::timestamptz AT TIME ZONE 'UTC') + INTERVAL '1 month'
       ), 0) AS spent
FROM budgets b
LEFT JOIN categories c ON c.id = b.category_id
WHERE b.user_id = %(user_id)s
ORDER BY b.created_at DESC
LIMIT 10
"""

_GOALS_SQL = """
SELECT title, target_amount, current_amount, target_date
FROM goals
WHERE user_id = %(user_id)s
ORDER BY target_date ASC NULLS LAST
LIMIT 10
"""


def _f(value) -> float:
    return float(value) if value is not None else 0.0


def load_facts(user_id: str, now: datetime | None = None) -> dict:
    """Exact figures for one user. Never approximated, never retrieved."""
    now = now or datetime.now(timezone.utc)
    params = {"user_id": user_id, "now": now}

    with transaction() as cur:
        cur.execute(_FACTS_SQL, params)
        head = cur.fetchone()
        cur.execute(_BY_CATEGORY_SQL, params)
        by_category = cur.fetchall()
        cur.execute(_BUDGETS_SQL, params)
        budgets = cur.fetchall()
        cur.execute(_GOALS_SQL, params)
        goals = cur.fetchall()

    if head is None:
        return {"known": False}

    month_spend = _f(head["month_spend"])
    allowance = _f(head["monthly_allowance"]) if head["monthly_allowance"] is not None else None

    return {
        "known": True,
        "as_of": now.isoformat(),
        "month": {
            "start": head["month_start"].isoformat(),
            "end": head["month_end"].isoformat(),
        },
        "spend": {
            "month": round(month_spend, 2),
            "today": round(_f(head["today_spend"]), 2),
            "transactions": int(head["month_count"]),
        },
        # None rather than 0 when unset, so the prompt can say "not set" instead of the
        # model inferring that this user has no money.
        "allowance": round(allowance, 2) if allowance else None,
        "remaining": round(allowance - month_spend, 2) if allowance else None,
        "by_category": [
            {
                "category": r["category"],
                "spent": round(_f(r["spent"]), 2),
                "transactions": int(r["transactions"]),
            }
            for r in by_category
        ],
        "budgets": [
            {
                "category": r["category"],
                "budget": round(_f(r["budget"]), 2),
                "period": r["period"],
                "spent": round(_f(r["spent"]), 2),
                "remaining": round(_f(r["budget"]) - _f(r["spent"]), 2),
            }
            for r in budgets
        ],
        "goals": [
            {
                "title": r["title"],
                "target": round(_f(r["target_amount"]), 2),
                "saved": round(_f(r["current_amount"]), 2),
                "target_date": r["target_date"].isoformat() if r["target_date"] else None,
            }
            for r in goals
        ],
    }
