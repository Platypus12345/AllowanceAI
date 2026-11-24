"""The LangGraph assistant: retrieve -> rules -> generate.

Linear, not agentic (proposal P5, which confirms TechSpec §3). The graph does not decide
whether to retrieve, does not loop, and does not call tools. For "answer a question about
my own spending" there is nothing for a planner to plan: the context is always this user's
transactions and the numbers always come from SQL. An agentic loop here would buy
non-determinism, latency and token cost and nothing else.

Each node is a plain function of state, so each is unit-testable on its own. The generate
node is the only one that touches an LLM, and it is injected — so every other node, and the
whole graph's wiring, is testable with no API key present (Rules.md).

Guardrails is Phase 5 and deliberately not here yet. What *is* here is the structural
precondition for it: `answer_is_grounded` checks that every number the model emitted appears
in the facts or the retrieved text. Phase 5 replaces the hand-rolled check with Guardrails
AI; the node boundary does not move.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from langgraph.graph import END, StateGraph

from .facts import load_facts
from .llm import LLMNotConfigured
from .retrieval import retrieve

log = logging.getLogger(__name__)

MAX_CONTEXT_ROWS = 8


class LLM(Protocol):
    """Everything the generate node needs from a model.

    Narrow on purpose: a test double is three lines, and swapping provider (P6) touches one
    implementation rather than the graph.
    """

    def complete(self, system: str, user: str) -> str: ...


@dataclass
class AssistantState:
    user_id: str
    question: str
    now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # filled by the nodes
    retrieved: list = field(default_factory=list)
    retrieval_explain: dict = field(default_factory=dict)
    facts: dict = field(default_factory=dict)
    answer: str = ""
    grounded: bool = True
    ungrounded_numbers: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# ── nodes ────────────────────────────────────────────────────────────────────────────────


def retrieve_node(state: AssistantState) -> dict:
    """Hybrid retrieval over this user's documents."""
    result = retrieve(state.user_id, state.question, k=MAX_CONTEXT_ROWS)
    notes = list(state.notes)
    if not result.rows:
        # Distinguished from "retrieval failed" on purpose: an empty index is the normal
        # state of a new account, and the generate node must say so rather than invent.
        notes.append("no indexed history matched this question")
    return {
        "retrieved": result.rows,
        "retrieval_explain": result.explain,
        "notes": notes,
    }


def rules_node(state: AssistantState) -> dict:
    """Exact figures by SQL. See facts.py for why this is not retrieval."""
    return {"facts": load_facts(state.user_id, state.now)}


def build_prompt(state: AssistantState) -> tuple[str, str]:
    """Assemble the system and user prompts. Separated out so a test can assert what the
    model is actually told, without needing a model."""
    facts = state.facts or {}

    system = (
        "You are AllowanceAI, a careful assistant for a student's personal spending.\n"
        "\n"
        "Rules you must follow:\n"
        "1. The FACTS block holds exact figures from the database. For any total, budget, "
        "balance or count, use FACTS and nothing else. Never recompute or estimate them.\n"
        "2. The HISTORY block is individual transactions retrieved for this question. Use it "
        "to talk about specific spends. Do not sum HISTORY to produce a total — it is a "
        "sample, not the whole month.\n"
        "3. If neither block answers the question, say you do not have that information. "
        "Never guess a number, and never invent a merchant or a date.\n"
        "4. All amounts are Indian rupees. Write them like ₹1,249.00.\n"
        "5. Be brief and concrete. Two or three sentences unless asked for more.\n"
        "6. Never claim to have taken an action — you can only read and explain.\n"
    )

    lines = [f"QUESTION: {state.question}", ""]

    lines.append("FACTS (exact, from the database):")
    if not facts.get("known"):
        lines.append("  (no account data available)")
    else:
        spend = facts["spend"]
        lines.append(f"  as of: {facts['as_of']}")
        lines.append(
            f"  spent this month: ₹{spend['month']:.2f} across {spend['transactions']} transactions"
        )
        lines.append(f"  spent today: ₹{spend['today']:.2f}")
        if facts.get("allowance"):
            lines.append(f"  monthly allowance: ₹{facts['allowance']:.2f}")
            lines.append(f"  remaining this month: ₹{facts['remaining']:.2f}")
        else:
            lines.append("  monthly allowance: not set")
        for row in facts.get("by_category", []):
            lines.append(
                f"  category {row['category']}: ₹{row['spent']:.2f} over {row['transactions']} transactions"
            )
        for row in facts.get("budgets", []):
            lines.append(
                f"  budget {row['category']} ({row['period']}): ₹{row['spent']:.2f} of "
                f"₹{row['budget']:.2f}, ₹{row['remaining']:.2f} left"
            )
        for row in facts.get("goals", []):
            lines.append(f"  goal {row['title']}: ₹{row['saved']:.2f} of ₹{row['target']:.2f}")

    lines.append("")
    lines.append("HISTORY (individual transactions retrieved for this question):")
    if not state.retrieved:
        lines.append("  (nothing matched)")
    else:
        for row in state.retrieved:
            lines.append(f"  - {row.chunk_text}")

    return system, "\n".join(lines)


# Matches the numbers a model might state: 1249, 1,249.00, ₹349.5, 83%.
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _numbers_in(text: str) -> set[str]:
    """Normalised numeric tokens, so "1,249.00" and "1249" compare equal."""
    out = set()
    for raw in _NUMBER.findall(text or ""):
        cleaned = raw.replace(",", "")
        if cleaned.endswith("."):
            cleaned = cleaned[:-1]
        try:
            value = float(cleaned)
        except ValueError:
            continue
        # Normalise 1249.0 and 1249.00 to the same token.
        out.add(f"{value:.2f}")
    return out


def answer_is_grounded(answer: str, state: AssistantState) -> tuple[bool, list[str]]:
    """Does every number in the answer appear in what the model was given?

    A deliberately simple, deterministic check — not a judge, no second model call. It
    cannot catch a wrong *claim* built from right numbers, and it is not meant to; it
    catches the specific failure that matters most here, which is a confidently invented
    figure. Phase 5's Guardrails AI node replaces it at this same boundary.
    """
    allowed = _numbers_in(build_prompt(state)[1])
    # Small integers are ordinary prose ("in the last 3 days", "two or three"), not
    # financial claims, so they are not treated as numbers needing a source.
    stated = {n for n in _numbers_in(answer) if float(n) >= 10}
    missing = sorted(stated - allowed)
    return (not missing), missing


def generate_node(state: AssistantState, llm: LLM) -> dict:
    system, user = build_prompt(state)
    try:
        answer = llm.complete(system, user).strip()
    except LLMNotConfigured:
        # Deliberately NOT degraded gracefully. A missing API key is an operator error, not
        # a runtime hiccup: swallowing it here would make a misconfigured deployment look
        # like a permanently flaky model, and nobody would ever go and set the key. It
        # propagates so the API layer can answer 503 and say what is wrong.
        raise
    except Exception as exc:  # noqa: BLE001 — any *transient* provider failure lands here
        log.warning("generation failed: %s", exc)
        return {
            "answer": (
                "I could not reach the language model just now, so I will not guess. "
                "Your dashboard numbers are unaffected."
            ),
            "grounded": True,
            "notes": [*state.notes, f"generation failed: {type(exc).__name__}"],
        }

    grounded, missing = answer_is_grounded(answer, state)
    notes = list(state.notes)
    if not grounded:
        # Surfaced rather than silently rewritten: a wrong answer the user can see flagged
        # is recoverable, one quietly patched over is not.
        notes.append(f"answer contained numbers not present in its sources: {missing}")
        log.warning("ungrounded numbers in answer: %s", missing)

    return {
        "answer": answer,
        "grounded": grounded,
        "ungrounded_numbers": missing,
        "notes": notes,
    }


# ── graph ────────────────────────────────────────────────────────────────────────────────


def build_graph(llm: LLM) -> Any:
    """Compile the retrieve -> rules -> generate graph.

    retrieve and rules are independent — one is vector/FTS over documents, the other is
    aggregate SQL over transactions — but they are wired in sequence rather than in
    parallel. At this scale the two queries are milliseconds, and sequential keeps the
    trace a straight line, which is what makes a Langfuse trace readable in a demo (P5:
    keep the graph linear).
    """
    graph = StateGraph(AssistantState)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("rules", rules_node)
    graph.add_node("generate", lambda state: generate_node(state, llm))

    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "rules")
    graph.add_edge("rules", "generate")
    graph.add_edge("generate", END)

    return graph.compile()


def ask(
    user_id: str,
    question: str,
    llm: LLM,
    now: datetime | None = None,
    graph_factory: Callable[[LLM], Any] = build_graph,
) -> dict:
    """Run one question through the graph and return a serialisable answer."""
    compiled = graph_factory(llm)
    state = AssistantState(
        user_id=user_id,
        question=question,
        now=now or datetime.now(timezone.utc),
    )
    final = compiled.invoke(state)

    # LangGraph hands back a dict for a dataclass state; tolerate either so a library
    # change cannot silently produce an empty answer.
    get = final.get if isinstance(final, dict) else lambda key, default=None: getattr(final, key, default)

    return {
        "answer": get("answer", ""),
        "grounded": bool(get("grounded", True)),
        "ungrounded_numbers": list(get("ungrounded_numbers", []) or []),
        "notes": list(get("notes", []) or []),
        # Citations are the retrieved rows the answer was allowed to draw on. Returned so
        # the UI can show its sources — an answer about money that cannot be checked
        # against the underlying transactions is not worth much.
        "citations": [
            {
                "text": row.chunk_text,
                "source_type": row.source_type,
                "source_id": row.source_id,
                "found_by": row.found_by,
            }
            for row in (get("retrieved", []) or [])
        ],
        "retrieval": get("retrieval_explain", {}) or {},
        "facts": get("facts", {}) or {},
    }
