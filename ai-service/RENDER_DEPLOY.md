# Deploy AllowanceAI FastAPI service on Render

This service lives in **`ai-service/`** and exposes AI endpoints used by the Node API (`server/`).

## Project layout

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app (`app` instance) — routes `/ask`, `/predict`, `/tips`, `/health`, etc. |
| `llm_client.py` | OpenAI / OpenRouter client |
| `prompt_builder.py` | System prompts and financial context |
| `requirements.txt` | Python dependencies |
| `runtime.txt` | Python version for Render (`3.11.9`) |

There is no separate `app.py`; Render starts **`main:app`** with uvicorn.

## Render Web Service settings

Create a **Web Service** (or use the repo `render.yaml` Blueprint).

| Setting | Value |
|---------|--------|
| **Root directory** | `ai-service` |
| **Runtime** | Python 3 |
| **Build command** | `pip install -r requirements.txt` |
| **Start command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Health check path** | `/health` |

Render sets `PORT` automatically; the app must listen on `0.0.0.0` and that port (the start command above does this).

## Required environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI or OpenRouter API key |
| `OPENAI_MODEL` | No | Default: `openai/gpt-4o-mini` |
| `OPENAI_BASE_URL` | No | Default: `https://openrouter.ai/api/v1` (OpenRouter). Use `https://api.openai.com/v1` for OpenAI directly. |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Defaults include Vercel + Render API URLs. |

Example (OpenRouter):

```
OPENAI_API_KEY=sk-or-v1-...
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

## CORS (production)

By default, these origins are allowed:

- `https://allowance-ai-eight.vercel.app`
- `https://allowanceai-api.onrender.com`
- `http://localhost:5173`
- `http://localhost:5000`

Override with `ALLOWED_ORIGINS` if you add preview domains.

## After deploy

1. Copy the service URL (e.g. `https://allowanceai-ai.onrender.com`).
2. On the **Node API** Render service, set:
   ```
   AI_SERVICE_URL=https://allowanceai-ai.onrender.com
   ```
3. Verify:
   ```bash
   curl https://allowanceai-ai.onrender.com/health
   ```
   Expected: `{"status":"ok","model":"..."}`

## Local development

```bash
cd ai-service
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Blueprint (optional)

The repo root `render.yaml` defines `allowanceai-ai` with the same root dir, build, and start commands. Connect the GitHub repo in Render → **New Blueprint** to provision both API and AI services.
