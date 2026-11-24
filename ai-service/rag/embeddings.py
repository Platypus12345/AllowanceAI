"""Local embeddings, pinned to bge-small-en-v1.5 at 384 dimensions (proposal P2).

Why fastembed (ONNX) rather than sentence-transformers, which TechSpec 3.1 named
originally: the *model* is identical and so is the dimension, only the runtime differs.
P2's stated reasons for choosing a local model were no quota, no key, runs free in CI, and
"Render's free tier is memory-constrained, watch RSS". sentence-transformers pulls torch —
on the order of a gigabyte installed — which does not fit that tier and makes a CI install
slow enough that people start skipping it. The whole fastembed stack here measures 203 MB
of site-packages (54 MB of it onnxruntime) plus a 65 MB model, so it serves P2's own
rationale better than the library P2 named. Recorded as a deliberate deviation in
TechSpec 3.1 rather than made silently.

Honest caveat, because it is a real difference and not just a packaging one: fastembed
resolves this model to Qdrant's int8-quantized ONNX export
(`qdrant/bge-small-en-v1.5-onnx-q`), not the fp32 original. Quantization perturbs vectors
slightly, so cosine distances are not bit-identical to a sentence-transformers run. It does
not change the dimension, the tokenizer or the ranking behaviour this product depends on,
and the deterministic eval gate (P3) measures retrieval quality directly — so if the
quantization ever cost us real recall, that gate is what would catch it.
"""

from __future__ import annotations

import threading
from functools import lru_cache
from typing import Iterable, Sequence

from .settings import EMBEDDING_DIMS, EMBEDDING_MODEL

# Loading the model takes ~10s and costs real memory, so it is loaded once per process and
# never per request. Guarded by a lock because two concurrent requests arriving before the
# first load finishes would otherwise both construct one and double the RSS — the exact
# failure the free tier cannot absorb.
_model_lock = threading.Lock()
_model = None


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:  # re-checked under the lock
                from fastembed import TextEmbedding

                _model = TextEmbedding(model_name=EMBEDDING_MODEL)
    return _model


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """Embed a batch. Batching matters: this is called per ingested transaction."""
    if not texts:
        return []
    vectors = [list(map(float, v)) for v in _get_model().embed(list(texts))]
    for v in vectors:
        if len(v) != EMBEDDING_DIMS:
            # A dimension mismatch here would otherwise surface as an opaque Postgres
            # error on insert, pointing at the database rather than at the model.
            raise ValueError(
                f"{EMBEDDING_MODEL} produced {len(v)} dims, but documents.embedding is "
                f"vector({EMBEDDING_DIMS}). The column and every stored row would need "
                f"re-embedding to change this — see TechSpec 3.1."
            )
    return vectors


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]


def to_pgvector(vector: Iterable[float]) -> str:
    """Render a vector as the literal pgvector input format: '[1,2,3]'.

    Passed as a string parameter and cast in SQL (`%s::vector`) so the value is still a
    bound parameter and never interpolated into the statement.
    """
    return "[" + ",".join(f"{float(x):.7g}" for x in vector) + "]"


@lru_cache(maxsize=1)
def warm() -> bool:
    """Load the model ahead of the first request.

    Called at startup so the first user question does not pay the ~10s load. lru_cache
    makes it idempotent and effectively free to call again.
    """
    _get_model()
    return True
