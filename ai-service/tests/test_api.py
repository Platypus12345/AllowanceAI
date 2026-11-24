"""Phase 4 — the HTTP surface, with the trust model as the headline.

These endpoints take a `user_id` in the body and return that user's financial history. The
only thing standing between that and anyone reading anyone's spending is the internal-token
check, so it is tested harder than anything else here — including the case where it is not
configured at all, which must fail closed rather than open.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rag import db
from rag.api import router
from rag.indexer import reindex_user
from tests.conftest import requires_db

TOKEN = "test-internal-token-not-a-real-secret"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", TOKEN)
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def unconfigured_client(monkeypatch):
    """No INTERNAL_API_TOKEN in the environment at all."""
    monkeypatch.delenv("INTERNAL_API_TOKEN", raising=False)
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as c:
        yield c


def _auth():
    return {"X-Internal-Token": TOKEN}


def _seed(user_id, rows):
    with db.transaction() as cur:
        cur.execute(
            "INSERT INTO linked_accounts (id,user_id,source,linked_at) VALUES (%s,%s,'sms',NOW()) RETURNING id",
            (str(uuid.uuid4()), user_id),
        )
        account_id = cur.fetchone()["id"]
        ids = []
        for amount, merchant, day in rows:
            tx = str(uuid.uuid4())
            ids.append(tx)
            cur.execute(
                """INSERT INTO transactions (id,user_id,linked_account_id,amount,merchant,source,
                   is_recurring,is_duplicate_flag,occurred_at,created_at)
                   VALUES (%s,%s,%s,%s,%s,'sms',false,false,%s,NOW())""",
                (tx, user_id, account_id, Decimal(str(amount)), merchant, f"2026-03-{day:02d} 09:30:00+00"),
            )
    return ids


# ── the trust model ──────────────────────────────────────────────────────────────────────


PROTECTED = [
    ("/assistant/ask", {"user_id": "u", "question": "q"}),
    ("/assistant/retrieve", {"user_id": "u", "query": "q"}),
    ("/assistant/index/transaction", {"transaction_id": "t"}),
    ("/assistant/index/user", {"user_id": "u"}),
    ("/assistant/warm", None),
]


@pytest.mark.parametrize("path,payload", PROTECTED)
def test_no_token_is_rejected(client, path, payload):
    res = client.post(path, json=payload) if payload else client.post(path)
    assert res.status_code == 401, f"{path} served a request with no token"


@pytest.mark.parametrize("path,payload", PROTECTED)
def test_a_wrong_token_is_rejected(client, path, payload):
    headers = {"X-Internal-Token": "wrong"}
    res = client.post(path, json=payload, headers=headers) if payload else client.post(path, headers=headers)
    assert res.status_code == 401, f"{path} accepted a wrong token"


@pytest.mark.parametrize("path,payload", PROTECTED)
def test_an_unconfigured_service_fails_closed(unconfigured_client, path, payload):
    """The case that matters most.

    With no INTERNAL_API_TOKEN set, every endpoint must refuse — even when the caller
    presents a token, since there is nothing to compare it against. A development default
    would be a hardcoded credential in a public repo, and an absent check that defaults to
    "allow" is how a service like this reaches production wide open.
    """
    for headers in ({}, {"X-Internal-Token": TOKEN}, {"X-Internal-Token": ""}):
        res = client_post(unconfigured_client, path, payload, headers)
        assert res.status_code == 503, f"{path} served with no token configured (headers={headers})"
        assert "not configured" in res.json()["detail"]


def client_post(c, path, payload, headers):
    return c.post(path, json=payload, headers=headers) if payload else c.post(path, headers=headers)


def test_a_token_prefix_is_not_accepted(client):
    """compare_digest is used so a match cannot be found a character at a time. This pins
    the behaviour rather than the implementation."""
    for bad in (TOKEN[:-1], TOKEN[:5], TOKEN + "x", TOKEN.upper()):
        res = client.post("/assistant/warm", headers={"X-Internal-Token": bad})
        assert res.status_code == 401, f"accepted {bad!r}"


def test_health_is_open_and_says_what_is_actually_available(client):
    """Unauthenticated on purpose — a health check that needs a secret is no use to a load
    balancer. It reports capabilities separately because "no LLM key" and "no internal
    token" both leave retrieval working, and one boolean would hide that."""
    body = client.get("/assistant/health").json()
    assert body["status"] == "ok"
    assert body["retrieval"] == "available"
    assert body["internal_auth"] == "configured"
    assert "generation" in body


def test_health_reports_missing_internal_auth_rather_than_pretending(unconfigured_client):
    body = unconfigured_client.get("/assistant/health").json()
    assert body["internal_auth"] == "NOT CONFIGURED"
    # Retrieval genuinely does still work, so it must not be reported as broken.
    assert body["retrieval"] == "available"


# ── validation ───────────────────────────────────────────────────────────────────────────


def test_malformed_payloads_are_rejected_before_touching_the_database(client):
    for payload in (
        {},
        {"user_id": "u"},
        {"question": "q"},
        {"user_id": "", "question": "q"},
        {"user_id": "u", "question": ""},
        {"user_id": "u", "question": "x" * 1001},
    ):
        assert client.post("/assistant/ask", json=payload, headers=_auth()).status_code == 422, payload


def test_retrieve_rejects_an_unknown_mode_and_an_out_of_range_k(client):
    base = {"user_id": str(uuid.uuid4()), "query": "q"}
    assert client.post("/assistant/retrieve", json={**base, "mode": "bm25"}, headers=_auth()).status_code == 422
    assert client.post("/assistant/retrieve", json={**base, "k": 0}, headers=_auth()).status_code == 422
    assert client.post("/assistant/retrieve", json={**base, "k": 51}, headers=_auth()).status_code == 422


# ── behaviour ────────────────────────────────────────────────────────────────────────────


@requires_db
def test_retrieve_returns_ranks_from_both_arms(client, user_id):
    _seed(user_id, [(1249, "ZORVEX PANTRY", 2), (340, "corner grocery shop", 3)])
    reindex_user(user_id)

    body = client.post(
        "/assistant/retrieve",
        json={"user_id": user_id, "query": "how much did I spend at ZORVEX PANTRY", "k": 5},
        headers=_auth(),
    ).json()

    assert body["rows"]
    top = body["rows"][0]
    assert "ZORVEX PANTRY" in top["text"]
    assert top["found_by"] == "both"
    assert top["dense_rank"] is not None and top["lexical_rank"] is not None
    assert body["explain"]["mode"] == "hybrid"
    assert body["explain"]["rrf_k"] == 60


@requires_db
def test_retrieve_can_show_what_a_single_arm_would_have_returned(client, user_id):
    """What makes the hybrid comparison demonstrable live, not just in a test file."""
    _seed(user_id, [(299, "ref 884421 electricity bill", 16)])
    reindex_user(user_id)

    for mode in ("hybrid", "dense", "lexical"):
        body = client.post(
            "/assistant/retrieve",
            json={"user_id": user_id, "query": "reference 884421", "mode": mode},
            headers=_auth(),
        ).json()
        assert body["explain"]["mode"] == mode


@requires_db
def test_indexing_one_transaction_then_retrieving_it(client, user_id):
    tx_ids = _seed(user_id, [(1249, "ZORVEX PANTRY", 2)])

    indexed = client.post(
        "/assistant/index/transaction",
        json={"transaction_id": tx_ids[0]},
        headers=_auth(),
    ).json()
    assert indexed["indexed"] == 1
    assert "ZORVEX PANTRY" in indexed["chunk_text"]

    found = client.post(
        "/assistant/retrieve",
        json={"user_id": user_id, "query": "ZORVEX PANTRY"},
        headers=_auth(),
    ).json()
    assert any("ZORVEX PANTRY" in r["text"] for r in found["rows"])


@requires_db
def test_reindexing_a_user_reports_the_document_count(client, user_id):
    _seed(user_id, [(100, "shop one", 1), (200, "shop two", 2), (300, "shop three", 3)])

    body = client.post("/assistant/index/user", json={"user_id": user_id}, headers=_auth()).json()
    assert body["transactions"] == 3
    assert body["indexed"] == 3
    assert body["documents"] == 3

    # Idempotent through the API too, not only at the function level.
    again = client.post("/assistant/index/user", json={"user_id": user_id}, headers=_auth()).json()
    assert again["documents"] == 3


@requires_db
def test_one_users_token_cannot_fetch_another_users_history(client, user_id, other_user):
    """The internal token authenticates the API server, not a user — so it is the
    `user_id` filter inside retrieval that keeps users apart. Asserted here at the HTTP
    boundary as well as in test_retrieval, because this is the layer an attacker reaches."""
    secret = "VERYPRIVATECLINIC"
    _seed(other_user, [(99999, secret, 1)])
    reindex_user(other_user)
    _seed(user_id, [(100, "my tea stall", 2)])
    reindex_user(user_id)

    body = client.post(
        "/assistant/retrieve",
        json={"user_id": user_id, "query": f"{secret} 99999", "k": 10},
        headers=_auth(),
    ).json()
    assert all(secret not in r["text"] for r in body["rows"])


@requires_db
def test_ask_answers_503_rather_than_500_when_no_llm_key_is_configured(client, user_id, monkeypatch):
    """The service is fine, it just has no model. A 500 would send someone hunting a bug
    that is really a missing env var, and the message says retrieval still works so the
    caller can degrade instead of showing an error."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    res = client.post(
        "/assistant/ask",
        json={"user_id": user_id, "question": "how much did I spend"},
        headers=_auth(),
    )
    assert res.status_code == 503
    assert "cannot generate" in res.json()["detail"]
