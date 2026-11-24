"""The LLM adapter. One implementation, one narrow interface (proposal P6's principle).

P6 says build for longevity rather than one vendor's free tier. In practice that means the
graph depends on a two-method protocol (`complete`) and nothing else, so changing provider
is this file and no other. It speaks the OpenAI chat-completions shape, which OpenRouter,
Groq, Together, a local llama.cpp server and OpenAI itself all accept — so "swap the model"
is an env var, not a code change.
"""

from __future__ import annotations

import logging

from .settings import Settings, load_settings

log = logging.getLogger(__name__)


class LLMNotConfigured(RuntimeError):
    """Raised when generation is attempted with no API key.

    Its own type so the API layer can answer 503 with a clear message instead of a 500 with
    a stack trace. Retrieval does not raise this — it never needs a key.
    """


class OpenAICompatibleLLM:
    """Chat completions over any OpenAI-shaped endpoint."""

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or load_settings()
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not self._settings.llm_configured:
                raise LLMNotConfigured(
                    "No OPENROUTER_API_KEY or OPENAI_API_KEY is set, so the assistant "
                    "cannot generate an answer. Retrieval and the dashboard are unaffected."
                )
            from openai import OpenAI

            kwargs = {"api_key": self._settings.llm_api_key}
            if self._settings.llm_base_url:
                kwargs["base_url"] = self._settings.llm_base_url
            self._client = OpenAI(**kwargs)
        return self._client

    def complete(self, system: str, user: str) -> str:
        response = self._get_client().chat.completions.create(
            model=self._settings.llm_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            # Low but not zero. This is a factual assistant over the user's own data, so
            # there is nothing to be gained from creative variation, and a lot to lose.
            temperature=0.2,
            max_tokens=500,
        )
        return (response.choices[0].message.content or "").strip()


class EchoLLM:
    """A deterministic stand-in used by tests and by a keyless local run.

    Not a mock in the test-double sense — it is a real implementation of the protocol that
    reports what it was given. It makes "does the graph wire up and ground correctly"
    answerable with no API key and no network, which Rules.md requires of every node.
    """

    def __init__(self, reply: str | None = None):
        self.reply = reply
        self.calls: list[tuple[str, str]] = []

    def complete(self, system: str, user: str) -> str:
        self.calls.append((system, user))
        if self.reply is not None:
            return self.reply
        return "I can see your spending history but no language model is configured here."
