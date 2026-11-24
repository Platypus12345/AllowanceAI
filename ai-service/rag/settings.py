"""Configuration for the RAG subsystem.

Read from the environment via one place, so no module reaches for os.getenv on its own
and no secret is ever a literal in the source (Rules.md golden rule 1).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

# The local docker-compose Postgres is mapped to host 5433, because a native Postgres
# often already owns 5432 on a dev machine. Only ever a fallback for local runs and CI;
# production supplies DATABASE_URL.
LOCAL_COMPOSE_DSN = "postgresql://allowance:allowance_dev_secret@127.0.0.1:5433/allowanceai"

# Pinned by approved proposal P2 (docs/TechSpec.md 3.1). 384 dimensions, which is what
# documents.embedding is declared as. Changing this means a migration AND a full re-embed
# of every existing row, so it is deliberately not configurable from the environment.
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIMS = 384

# Reciprocal Rank Fusion constant. 60 is the value from the original RRF paper and the one
# every reference implementation uses; it is here as a named constant rather than a magic
# number in the SQL so the eval can sweep it later if the corpus ever wants something else.
RRF_K = 60


@dataclass(frozen=True)
class Settings:
    database_url: str
    llm_api_key: str | None
    llm_base_url: str | None
    llm_model: str
    environment: str

    @property
    def llm_configured(self) -> bool:
        """Whether generation can run at all.

        Retrieval never needs this: embeddings are local and the fusion is SQL. So the
        service stays useful — and testable, and CI-green — with no key present.
        """
        return bool(self.llm_api_key)


def load_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL") or LOCAL_COMPOSE_DSN,
        # OPENROUTER_API_KEY first: it is the swappable-provider path from P6, and an
        # OpenRouter key is what this project actually has configured.
        llm_api_key=os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or None,
        llm_base_url=os.getenv("OPENAI_BASE_URL") or None,
        llm_model=os.getenv("OPENAI_MODEL") or "openai/gpt-4o-mini",
        environment=os.getenv("ENVIRONMENT") or "development",
    )
