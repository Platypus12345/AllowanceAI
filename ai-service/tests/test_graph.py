"""Phase 4 — the LangGraph graph.

Rules.md: "Every LangGraph node (retrieve, rules, generate, guardrails) needs a unit test
that can run without hitting a real LLM API (mock the LLM call)." Every test here runs with
no API key set. The database is real, because the retrieve and rules nodes are mostly claims
about SQL; the LLM is always a stand-in.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from rag import db
from rag.graph import (
    AssistantState,
    answer_is_grounded,
    ask,
    build_prompt,
    generate_node,
    retrieve_node,
    rules_node,
)
from rag.indexer import reindex_user
from rag.llm import EchoLLM, LLMNotConfigured, OpenAICompatibleLLM
from rag.settings import Settings
from tests.conftest import requires_db

NOW = datetime(2026, 3, 20, 12, tzinfo=timezone.utc)


def _seed(user_id, rows):
    """Insert real transactions, then index them through the real indexer."""
    with db.transaction() as cur:
        cur.execute(
            "INSERT INTO linked_accounts (id, user_id, source, linked_at) VALUES (%s,%s,'sms',NOW()) RETURNING id",
            (str(uuid.uuid4()), user_id),
        )
        account_id = cur.fetchone()["id"]
        for amount, merchant, day in rows:
            cur.execute(
                """
                INSERT INTO transactions
                    (id, user_id, linked_account_id, amount, merchant, source,
                     is_recurring, is_duplicate_flag, occurred_at, created_at)
                VALUES (%s,%s,%s,%s,%s,'sms',false,false,%s,NOW())
                """,
                (str(uuid.uuid4()), user_id, account_id, Decimal(str(amount)), merchant,
                 f"2026-03-{day:02d} 09:30:00+00"),
            )
    reindex_user(user_id)


def _set_allowance(user_id, amount):
    with db.transaction() as cur:
        cur.execute("UPDATE users SET monthly_allowance = %s WHERE id = %s", (Decimal(str(amount)), user_id))


# ── retrieve node ────────────────────────────────────────────────────────────────────────


@requires_db
def test_retrieve_node_fills_state_and_flags_an_empty_index(user_id):
    empty = retrieve_node(AssistantState(user_id=user_id, question="what did I spend", now=NOW))
    assert empty["retrieved"] == []
    # An empty index is the normal state of a new account, and is reported distinctly from
    # a failure so the generate node can say so rather than invent.
    assert any("no indexed history" in n for n in empty["notes"])

    _seed(user_id, [(1249, "ZORVEX PANTRY", 2), (340, "corner grocery shop", 3)])

    filled = retrieve_node(AssistantState(user_id=user_id, question="ZORVEX PANTRY", now=NOW))
    assert filled["retrieved"]
    assert any("ZORVEX PANTRY" in r.chunk_text for r in filled["retrieved"])
    assert filled["retrieval_explain"]["mode"] == "hybrid"
    assert not any("no indexed history" in n for n in filled["notes"])


# ── rules node ───────────────────────────────────────────────────────────────────────────


@requires_db
def test_rules_node_returns_exact_figures_from_sql(user_id):
    _seed(user_id, [(1249, "ZORVEX PANTRY", 2), (340, "corner grocery shop", 3), (95, "tea stall", 4)])
    _set_allowance(user_id, 10000)

    facts = rules_node(AssistantState(user_id=user_id, question="anything", now=NOW))["facts"]

    assert facts["known"] is True
    assert facts["spend"]["month"] == 1684.0  # 1249 + 340 + 95
    assert facts["spend"]["transactions"] == 3
    assert facts["allowance"] == 10000.0
    assert facts["remaining"] == 8316.0


@requires_db
def test_rules_node_honours_the_phase_2_conventions(user_id):
    """A credit is not spend, and a duplicate-flagged row is not counted. If the assistant
    got these wrong it would contradict the dashboard, which is worse than not answering."""
    _seed(user_id, [(400, "CHAI POINT", 4)])

    with db.transaction() as cur:
        cur.execute(
            "SELECT id FROM linked_accounts WHERE user_id = %s LIMIT 1", (user_id,)
        )
        account_id = cur.fetchone()["id"]
        # A credit (money in).
        cur.execute(
            """INSERT INTO transactions (id,user_id,linked_account_id,amount,merchant,source,
               is_recurring,is_duplicate_flag,occurred_at,created_at)
               VALUES (%s,%s,%s,%s,'pocket money','manual',false,false,%s,NOW())""",
            (str(uuid.uuid4()), user_id, account_id, Decimal("-5000"), "2026-03-05 09:00:00+00"),
        )
        # A duplicate-flagged repeat of the 400.
        cur.execute(
            """INSERT INTO transactions (id,user_id,linked_account_id,amount,merchant,source,
               is_recurring,is_duplicate_flag,occurred_at,created_at)
               VALUES (%s,%s,%s,%s,'CHAI POINT','sms',false,true,%s,NOW())""",
            (str(uuid.uuid4()), user_id, account_id, Decimal("400"), "2026-03-04 10:00:00+00"),
        )

    facts = rules_node(AssistantState(user_id=user_id, question="x", now=NOW))["facts"]
    assert facts["spend"]["month"] == 400.0, "a credit or a flagged duplicate leaked into spend"
    assert facts["spend"]["transactions"] == 1


@requires_db
def test_rules_node_reports_an_unset_allowance_as_none_not_zero(user_id):
    """None lets the prompt say "not set". Zero would let the model conclude the user has
    no money, which is a different and wrong statement."""
    _seed(user_id, [(100, "tea stall", 4)])
    facts = rules_node(AssistantState(user_id=user_id, question="x", now=NOW))["facts"]
    assert facts["allowance"] is None
    assert facts["remaining"] is None


@requires_db
def test_rules_node_excludes_other_months(user_id):
    _seed(user_id, [(500, "this month shop", 2)])
    with db.transaction() as cur:
        cur.execute("SELECT id FROM linked_accounts WHERE user_id = %s LIMIT 1", (user_id,))
        account_id = cur.fetchone()["id"]
        cur.execute(
            """INSERT INTO transactions (id,user_id,linked_account_id,amount,merchant,source,
               is_recurring,is_duplicate_flag,occurred_at,created_at)
               VALUES (%s,%s,%s,%s,'last month shop','sms',false,false,%s,NOW())""",
            (str(uuid.uuid4()), user_id, account_id, Decimal("9999"), "2026-02-15 09:00:00+00"),
        )
    facts = rules_node(AssistantState(user_id=user_id, question="x", now=NOW))["facts"]
    assert facts["spend"]["month"] == 500.0


# ── prompt ───────────────────────────────────────────────────────────────────────────────


def test_the_prompt_separates_exact_facts_from_retrieved_history():
    """The whole point of splitting retrieval from rules: the model must be told which
    numbers are authoritative and which are a sample."""
    state = AssistantState(
        user_id="u",
        question="how much have I spent?",
        now=NOW,
        facts={
            "known": True,
            "as_of": NOW.isoformat(),
            "month": {"start": "x", "end": "y"},
            "spend": {"month": 1684.0, "today": 95.0, "transactions": 3},
            "allowance": 10000.0,
            "remaining": 8316.0,
            "by_category": [],
            "budgets": [],
            "goals": [],
        },
    )
    system, user = build_prompt(state)

    assert "FACTS" in user and "HISTORY" in user
    assert "1684.00" in user
    assert "(nothing matched)" in user

    # The instruction not to sum HISTORY is load-bearing: retrieval returns at most 8 rows,
    # so adding them up would understate any real month.
    assert "Do not sum HISTORY" in system
    assert "never invent a merchant" in system.lower() or "never invent a merchant" in system


def test_the_prompt_says_not_set_rather_than_zero_for_a_missing_allowance():
    state = AssistantState(
        user_id="u", question="q", now=NOW,
        facts={"known": True, "as_of": NOW.isoformat(), "month": {"start": "x", "end": "y"},
               "spend": {"month": 0.0, "today": 0.0, "transactions": 0},
               "allowance": None, "remaining": None,
               "by_category": [], "budgets": [], "goals": []},
    )
    _, user = build_prompt(state)
    assert "monthly allowance: not set" in user


# ── grounding check ──────────────────────────────────────────────────────────────────────


def _state_with_facts(month=1684.0):
    return AssistantState(
        user_id="u", question="how much have I spent?", now=NOW,
        facts={"known": True, "as_of": NOW.isoformat(), "month": {"start": "x", "end": "y"},
               "spend": {"month": month, "today": 95.0, "transactions": 3},
               "allowance": 10000.0, "remaining": 8316.0,
               "by_category": [], "budgets": [], "goals": []},
    )


def test_grounding_accepts_a_number_that_came_from_the_facts():
    state = _state_with_facts()
    ok, missing = answer_is_grounded("You have spent ₹1,684.00 this month.", state)
    assert ok, missing
    # Comma and decimal formatting must not matter.
    assert answer_is_grounded("You spent 1684 this month.", state)[0]
    assert answer_is_grounded("You spent ₹1684.0 this month.", state)[0]


def test_grounding_rejects_an_invented_number():
    """The failure this check exists for: a confidently stated figure with no source."""
    state = _state_with_facts()
    ok, missing = answer_is_grounded("You have spent ₹9,999.00 this month.", state)
    assert not ok
    assert "9999.00" in missing


def test_grounding_ignores_small_numbers_that_are_ordinary_prose():
    """"in the last 3 days" is not a financial claim, and treating it as one would make the
    check fire constantly and get switched off."""
    state = _state_with_facts()
    assert answer_is_grounded("Over the last 3 days you have had 2 transactions.", state)[0]


def test_grounding_counts_retrieved_history_as_a_source():
    """A number from a retrieved transaction is grounded even if it is not in FACTS."""
    class Row:
        chunk_text = "2026-03-02 · debit ₹1249.00 · ZORVEX PANTRY · source=sms"
        source_type = "transaction_summary"
        source_id = None
        dense_rank = 1
        lexical_rank = 1

        @property
        def found_by(self):
            return "both"

    state = _state_with_facts()
    state.retrieved = [Row()]
    assert answer_is_grounded("Your biggest spend was ₹1,249.00 at ZORVEX PANTRY.", state)[0]


# ── generate node ────────────────────────────────────────────────────────────────────────


def test_generate_node_flags_an_ungrounded_answer_without_hiding_it():
    """Surfaced rather than silently rewritten: a wrong answer the user can see flagged is
    recoverable, one quietly patched over is not."""
    llm = EchoLLM(reply="You have spent ₹9,999.00 this month.")
    out = generate_node(_state_with_facts(), llm)

    assert out["grounded"] is False
    assert "9999.00" in out["ungrounded_numbers"]
    # The answer is still returned, not swallowed.
    assert "9,999.00" in out["answer"]
    assert any("not present in its sources" in n for n in out["notes"])


def test_generate_node_survives_a_provider_failure_without_guessing():
    """A dead provider must not become a fabricated answer about someone's money."""
    class Broken:
        def complete(self, system, user):
            raise TimeoutError("upstream gone")

    out = generate_node(_state_with_facts(), Broken())
    assert "could not reach the language model" in out["answer"]
    assert out["grounded"] is True  # it asserted nothing, so nothing is ungrounded
    assert any("generation failed: TimeoutError" in n for n in out["notes"])


def test_generate_node_passes_both_prompts_to_the_model():
    llm = EchoLLM(reply="ok")
    generate_node(_state_with_facts(), llm)
    assert len(llm.calls) == 1
    system, user = llm.calls[0]
    assert "AllowanceAI" in system
    assert "QUESTION:" in user


# ── the whole graph ──────────────────────────────────────────────────────────────────────


@requires_db
def test_the_graph_runs_end_to_end_with_no_api_key(user_id):
    """The Phase 4 DoD question, with the LLM stood in for.

    Retrieval and the facts are real; only generation is substituted. That is the division
    that matters: everything this project actually built is exercised.
    """
    _seed(user_id, [(1249, "ZORVEX PANTRY", 2), (340, "corner grocery shop", 3), (95, "tea stall", 4)])
    _set_allowance(user_id, 10000)

    llm = EchoLLM(reply="You spent ₹1,249.00 at ZORVEX PANTRY on 2 March.")
    result = ask(user_id, "how much did I spend at ZORVEX PANTRY", llm, now=NOW)

    assert result["answer"].startswith("You spent")
    assert result["grounded"] is True
    assert result["ungrounded_numbers"] == []

    # Citations let the UI show its sources — an answer about money that cannot be checked
    # against the underlying transactions is not worth much.
    assert result["citations"], "no citations returned"
    assert any("ZORVEX PANTRY" in c["text"] for c in result["citations"])
    assert all(c["found_by"] in {"both", "semantic", "keyword"} for c in result["citations"])

    # The exact figures reached the model.
    assert result["facts"]["spend"]["month"] == 1684.0
    assert result["retrieval"]["mode"] == "hybrid"

    # And the model was actually given the retrieved row.
    _, user_prompt = llm.calls[0]
    assert "ZORVEX PANTRY" in user_prompt


@requires_db
def test_the_graph_runs_the_nodes_in_order(user_id):
    """retrieve -> rules -> generate. If generate ran first it would have neither block,
    and the failure would look like a vague model rather than a wiring bug."""
    _seed(user_id, [(500, "ZORVEX PANTRY", 2)])
    _set_allowance(user_id, 4000)

    llm = EchoLLM(reply="fine")
    ask(user_id, "ZORVEX PANTRY", llm, now=NOW)

    _, user_prompt = llm.calls[0]
    # Both earlier nodes had already populated state by the time generate ran.
    assert "ZORVEX PANTRY" in user_prompt       # retrieve ran
    assert "monthly allowance: ₹4000.00" in user_prompt  # rules ran


@requires_db
def test_the_graph_says_it_does_not_know_on_an_empty_account(user_id):
    """A brand-new account is the single most likely first interaction."""
    llm = EchoLLM(reply="I do not have any spending history for you yet.")
    result = ask(user_id, "how much did I spend on food", llm, now=NOW)

    assert result["citations"] == []
    assert any("no indexed history" in n for n in result["notes"])
    assert result["facts"]["spend"]["month"] == 0.0
    _, user_prompt = llm.calls[0]
    assert "(nothing matched)" in user_prompt


# ── llm adapter ──────────────────────────────────────────────────────────────────────────


def test_a_missing_api_key_raises_a_typed_error_not_a_stack_trace():
    """So the API layer can answer 503 with something useful. Retrieval never raises
    this — it needs no key at all."""
    llm = OpenAICompatibleLLM(
        Settings(database_url="x", llm_api_key=None, llm_base_url=None,
                 llm_model="m", environment="test")
    )
    with pytest.raises(LLMNotConfigured, match="cannot generate"):
        llm.complete("s", "u")


def test_a_missing_key_propagates_while_a_transient_failure_degrades():
    """Two different failures, deliberately handled differently.

    A provider timeout is a runtime hiccup: degrade gracefully, say so, assert nothing
    about the user's money. A missing API key is an operator error: if the graph swallowed
    it, a misconfigured deployment would look like a permanently flaky model and nobody
    would ever go and set the key. So it propagates, and the API layer answers 503.

    This distinction was forced by a test that expected 503 and got 200.
    """
    class NoKey:
        def complete(self, system, user):
            raise LLMNotConfigured("no key")

    class Flaky:
        def complete(self, system, user):
            raise ConnectionError("upstream reset")

    # Misconfiguration escapes the node.
    with pytest.raises(LLMNotConfigured):
        generate_node(_state_with_facts(), NoKey())

    # A transient failure does not.
    out = generate_node(_state_with_facts(), Flaky())
    assert "could not reach the language model" in out["answer"]
    assert any("ConnectionError" in n for n in out["notes"])
