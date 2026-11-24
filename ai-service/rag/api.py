"""HTTP surface for the RAG subsystem.

Trust model, which is the important part of this file. These endpoints take a `user_id` in
the request body and return that user's financial history. If they were reachable from a
browser, anyone could read anyone's spending by changing a UUID. So:

  browser -> server/ (verifies the user's JWT, knows who they are) -> ai-service

`ai-service` therefore authenticates the *caller* (the Node API), not the end user, with a
shared `X-Internal-Token`. It is **fail-closed**: if `INTERNAL_API_TOKEN` is not set, every
endpoint here answers 503 rather than serving. A development default would be a hardcoded
credential in a public repo, and "it works on my machine because the check is off" is how
this kind of thing reaches production open.

`compare_digest` rather than `==` so the comparison does not leak the token's length or a
matching prefix through timing.
"""

from __future__ import annotations

import logging
import os
from secrets import compare_digest

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .embeddings import warm
from .graph import ask
from .indexer import count_documents, index_transaction, reindex_user
from .llm import LLMNotConfigured, OpenAICompatibleLLM
from .retrieval import retrieve
from .settings import load_settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["assistant"])


def _require_internal_auth(token: str | None) -> None:
    expected = os.getenv("INTERNAL_API_TOKEN") or ""
    if not expected:
        log.error("INTERNAL_API_TOKEN is not set; refusing to serve assistant endpoints")
        raise HTTPException(
            status_code=503,
            detail=(
                "ai-service is not configured for authenticated access. Set "
                "INTERNAL_API_TOKEN here and on the API server."
            ),
        )
    if not token or not compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="invalid or missing X-Internal-Token")


class AskRequest(BaseModel):
    user_id: str = Field(min_length=1)
    question: str = Field(min_length=1, max_length=1000)


class RetrieveRequest(BaseModel):
    user_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=1000)
    k: int = Field(default=8, ge=1, le=50)
    # "hybrid" in production; the other two exist so the retrieval explanation can show,
    # live in a demo, what each arm alone would have returned.
    mode: str = Field(default="hybrid", pattern="^(hybrid|dense|lexical)$")


class IndexTransactionRequest(BaseModel):
    transaction_id: str = Field(min_length=1)


class ReindexRequest(BaseModel):
    user_id: str = Field(min_length=1)


@router.get("/health")
async def assistant_health():
    """Deliberately unauthenticated and deliberately specific.

    Reports which capabilities are actually available rather than a bare "ok", because the
    two interesting states here — no LLM key, no internal token — both leave retrieval
    working and only generation broken. A single boolean would hide that.
    """
    settings = load_settings()
    return {
        "status": "ok",
        "retrieval": "available",
        "generation": "available" if settings.llm_configured else "no LLM key configured",
        "internal_auth": "configured" if os.getenv("INTERNAL_API_TOKEN") else "NOT CONFIGURED",
        "model": settings.llm_model if settings.llm_configured else None,
    }


@router.post("/ask")
async def assistant_ask(
    body: AskRequest,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    _require_internal_auth(x_internal_token)
    try:
        return ask(body.user_id, body.question, OpenAICompatibleLLM())
    except LLMNotConfigured as exc:
        # 503, not 500: the service is fine, it just has no model. Retrieval still works,
        # which the message says so the caller can degrade rather than show an error.
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/retrieve")
async def assistant_retrieve(
    body: RetrieveRequest,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    """Retrieval with no generation. Needs no LLM key at all.

    Powers the "why did it return that?" view, and is what makes the hybrid-vs-single-arm
    comparison demonstrable live rather than only in a test.
    """
    _require_internal_auth(x_internal_token)
    result = retrieve(body.user_id, body.query, k=body.k, mode=body.mode)
    return {
        "rows": [
            {
                "id": r.id,
                "text": r.chunk_text,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "found_by": r.found_by,
                "dense_rank": r.dense_rank,
                "lexical_rank": r.lexical_rank,
                "rrf_score": round(r.rrf_score, 6),
            }
            for r in result.rows
        ],
        "explain": result.explain,
    }


@router.post("/index/transaction")
async def assistant_index_transaction(
    body: IndexTransactionRequest,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    _require_internal_auth(x_internal_token)
    return index_transaction(body.transaction_id)


@router.post("/index/user")
async def assistant_reindex_user(
    body: ReindexRequest,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    """Backfill or rebuild one user's whole history.

    Needed after a render-template or embedding-model change, and to index transactions
    that predate the assistant.
    """
    _require_internal_auth(x_internal_token)
    result = reindex_user(body.user_id)
    result["documents"] = count_documents(body.user_id)
    return result


@router.post("/warm")
async def assistant_warm(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    """Load the embedding model before the first real question pays its ~10s cost.

    Worth having explicitly on a free tier that sleeps: the API server can call this when
    it wakes, so a demo's first question is not the one that waits.
    """
    _require_internal_auth(x_internal_token)
    warm()
    return {"warm": True}
