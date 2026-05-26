# AllowanceAI
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/01b492ee-0eb5-49c1-85d6-6fd36a56fd41" />

Now Live @https://allowance-ai-eight.vercel.app/

AI-powered personal finance assistant for students — track allowance, expenses, budgets, and get smart coaching with a neon fintech UI. Installable as a PWA on mobile and desktop.

## Highlights

- Full-stack MERN + FastAPI microservice architecture
- AI-powered budgeting assistant with LLM integration
- JWT + Google OAuth authentication
- Real-time analytics and smart budget predictions
- SMS expense parsing and recurring expense tracking
- Cross-platform support via PWA + React Native mobile app
  
## Live demo

| Service | URL |
|---------|-----|
| **Web app (PWA)** | Deploy to Vercel — see [Deployment](#deployment) |
| **API** | `https://allowanceai-api.onrender.com` (after Render blueprint) |
| **AI service** | `https://allowanceai-ai.onrender.com` |
| **GitHub** | https://github.com/Platypus12345/AllowanceAI |

> **Repo is ready locally** — run `gh auth login` then `.\scripts\deploy-production.ps1` to push and deploy.

## Features

- JWT + Google OAuth authentication, signup, forgot/reset password
- Dashboard with financial safety score, daily limits, spend prediction
- Expense tracking, categories, duplicate detection, recurring expenses
- AI chat assistant with personality modes and tool actions
- Budget goals, monthly report, spending heatmap calendar
- Smart notifications, gamification (XP, badges, streaks)
- SMS expense parsing with automatic transaction detection
- Monthly **Financial Wrapped** (Spotify-style story cards)
- PWA — add to home screen, offline shell, standalone mode
- React Native mobile app (Expo) in `/mobile`

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, Recharts |
| Backend | Node.js, Express 5, MongoDB (Mongoose) |
| AI | Python FastAPI, OpenAI |
| Mobile | Expo Router, React Native |
| Deploy | Vercel (client), Render (server + AI) |

## Project structure

```txt
allowance-ai/
├── client/          # React web app (Vercel root)
├── server/          # Express API (Render root)
├── ai-service/      # FastAPI AI service (Render)
├── mobile/          # Expo React Native app
└── render.yaml      # Render blueprint
```

## Local setup

### Prerequisites

- Node.js 20+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Python 3.11+ (for AI service)

### 1. Clone & install

```bash
git clone https://github.com/Platypus12345/AllowanceAI.git
cd AllowanceAI
cd server && npm install && cd ..
cd client && npm install && cd ..
cd ai-service && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
```

### 2. Environment

Copy examples and fill in values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
cp ai-service/.env.example ai-service/.env
```

### 3. Run (4 terminals)

```bash
# MongoDB — local or Atlas URI in server/.env
cd server && npm run dev          # http://localhost:5000
cd ai-service && uvicorn main:app --reload --port 8000
cd client && npm run dev          # http://localhost:5173
cd mobile && npx expo start       # optional
```

## Deployment

### MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Database Access → create user with password.
3. Network Access → allow `0.0.0.0/0` (or Render IPs).
4. Connect → copy connection string into `MONGO_URI`.

### Render (backend)

1. Fork/push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect repo.
3. Apply `render.yaml` (creates `allowanceai-api` + `allowanceai-ai`).
4. Set secrets in each service:

**allowanceai-api (`server/`):**

- `MONGO_URI` — Atlas connection string
- `JWT_SECRET` — long random string
- `CLIENT_URL` — `https://your-app.vercel.app` (comma-separate preview URLs if needed)
- `EMAIL_USER`, `EMAIL_PASS` — Gmail app password for reset emails
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `AI_SERVICE_URL` — `https://allowanceai-ai.onrender.com`

**allowanceai-ai (`ai-service/`):**

- `OPENAI_API_KEY`

5. Note API URL: `https://allowanceai-api.onrender.com`

### Vercel (frontend)

1. [vercel.com](https://vercel.com) → Import GitHub repo.
2. **Root Directory:** `client`
3. **Environment variable:**

   `VITE_API_URL` = `https://allowanceai-api.onrender.com`

4. Deploy → copy production URL.
5. Update Render `CLIENT_URL` with the Vercel URL and redeploy API if needed.

### PWA install

1. Open the Vercel URL in Chrome (Android/desktop) or Safari (iOS).
2. **Chrome:** menu → *Install AllowanceAI* / *Add to Home Screen*.
3. **Safari (iOS):** Share → *Add to Home Screen*.
4. App opens fullscreen with `#0b1326` theme.

## API health

```bash
curl https://allowanceai-api.onrender.com/api/health
```

## Scripts

| Path | Command | Description |
|------|---------|-------------|
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | Production build |
| `server/` | `npm start` | Production API |
| `server/` | `npm run dev` | Nodemon dev |

## License
MIT License
