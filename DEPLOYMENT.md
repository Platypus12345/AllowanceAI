# AllowanceAI — Production deployment checklist

## Quick links (fill after deploy)

- **GitHub:** https://github.com/Platypus12345/AllowanceAI
- **Frontend (Vercel):** `https://____________.vercel.app`
- **API (Render):** `https://allowanceai-api.onrender.com`
- **AI (Render):** `https://allowanceai-ai.onrender.com`

## 1. MongoDB Atlas

1. Create cluster → **allowanceai** database.
2. User + password → add to `MONGO_URI`.
3. Network: **Allow access from anywhere** (`0.0.0.0/0`) for Render.

## 2. Render

1. Dashboard → **New** → **Blueprint**.
2. Connect `Platypus12345/AllowanceAI` repo.
3. Paste env vars from `server/.env.example` and `ai-service/.env.example`.
4. After deploy, set `AI_SERVICE_URL` on API service to AI service URL.
5. Set `CLIENT_URL` to your Vercel URL.

## 3. Vercel

1. Import repo → Root: **client**.
2. `VITE_API_URL` = Render API URL (no `/api` suffix).
3. Deploy → update Render `CLIENT_URL`.

## 4. Google OAuth (optional)

Authorized redirect URI:

`https://<your-api>.onrender.com/api/auth/google/callback`

## 5. Verify

```bash
curl https://<api>/api/health
```

Open Vercel URL → signup → add expense → AI chat → install PWA.
