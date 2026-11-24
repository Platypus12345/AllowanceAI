# Task.md — things only Aditya can do

This is your checklist. Claude keeps it updated; it holds **only** the steps that need
your hands (dashboards, secrets, browser clicks). Everything Claude can do itself goes in
[Tracker.md](Tracker.md) instead.

Last updated: 2026-11-25 — **steps 1-7 are done and I verified 3-7 against the live
deployment myself.** Only step 8 needs your hands (one Google login click), plus the new
assistant section below.

Suites now: **server 65 pass / 0 fail**, **ai-service 76 pass / 0 fail**.
Phases 3 and 4 are delivered — safe-to-spend on the dashboard, and the RAG assistant.

**Never paste a password, connection string or API key into chat.** Set them in the
provider dashboards yourself. Nothing secret belongs in this repo.

---

## 🔴 TONIGHT — get the live login working

Do these in order. Order matters: step 2 fails if step 1 is skipped.

### [x] 1. Enable pgvector in Supabase, in the `public` schema — DONE

**Verified 2026-11-10.** The check query returned `extname = vector`, `schema = public`.
Already correct, so nothing was run — no `CREATE EXTENSION`, no `ALTER EXTENSION`.
Step 2 is unblocked. Kept below for the record / if you ever rebuild the database.

Supabase Dashboard → **SQL Editor** → run:

```sql
SELECT e.extname, n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'vector';
```

Then act on what you see:

| Result | Run this |
|---|---|
| **no rows** | `CREATE EXTENSION vector WITH SCHEMA public;` |
| schema = **`extensions`** | `ALTER EXTENSION vector SET SCHEMA public;` |
| schema = **`public`** | nothing — already correct |

Check it worked: `SELECT '[1,2,3]'::vector;` should return `[1,2,3]`, not an error.

> **Why this matters.** Claude reproduced this on a throwaway `pgvector:pg16` database. If
> `vector` sits in an `extensions` schema, the migration's
> `CREATE EXTENSION IF NOT EXISTS vector` **silently does nothing**, then the next statement
> dies with `ERROR: type "vector" does not exist`. **Clicking "enable vector" in the Supabase
> dashboard UI is what puts it in the wrong schema.** So do it with the SQL above.

### [x] 2. Apply the database migrations — DONE

**Applied 2026-11-19.** `Applying migration 20261005000000_init` → `All migrations have been
successfully applied`, against
`aws-0-ap-northeast-2.pooler.supabase.com:5432`. Verified independently: all 12 tables
present (`users`, `transactions`, `linked_accounts`, `budgets`, `goals`, `categories`,
`documents`, `badges`, `user_badges`, `notifications`, `audit_log`, `_prisma_migrations`)
and `vector` confirmed in schema `public`.

> **Gotcha worth remembering.** `server/.env` defines `DATABASE_URL` and `DIRECT_URL`
> pointing at the **local** docker Postgres on `127.0.0.1:5433`, which is already migrated.
> If the shell variables do not take, Prisma connects there instead, prints
> `No pending migrations to apply.` and touches Supabase not at all — a success message for
> work that never happened. Always check the `Datasource "db": ... at "<host>"` line Prisma
> prints: it names the database that is actually about to change.

Original instructions kept below for a rebuild.

Get both strings from Supabase → **Connect**. Do not hand-build the hostname.

```powershell
cd C:\Users\Aditya\Desktop\AllowanceAI\allowance-ai\server
$env:DATABASE_URL = "<Transaction pooler URL, port 6543, ending ?pgbouncer=true>"
$env:DIRECT_URL    = "<Session pooler URL, port 5432>"
npx prisma migrate deploy
```

Want to see: `1 migration found` then `Applied migration 20261005000000_init`.

Then confirm the tables exist — Supabase SQL Editor:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

Expect `users`, `transactions`, `linked_accounts`, `budgets`, `goals`, `categories`,
`documents`, `badges`, `user_badges`, `notifications`, `audit_log`, `_prisma_migrations`.

> If your password has `@ : / ? # & %` in it, URL-encode it or Prisma misreads the URL.
> **Never** run `prisma migrate dev` against production — it can reset data. `deploy` only.

### [x] 3. Set the environment variables in Render — DONE, verified 2026-11-25

**Verified live:** `GET /api/health` returns
`{"status":"ok","dbReady":true,"db":"postgres","legacyMongoReady":false}`. So
`DATABASE_URL` is right, `MONGO_URI` is gone, and Postgres is reachable from Render.
**You need to come back to this section once** — see "THE ASSISTANT" below, which adds
`INTERNAL_API_TOKEN`.

Render → `allowanceai-api` → **Environment**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the **6543** pooler URL, ending `?pgbouncer=true` |
| `DIRECT_URL` | the **5432** session pooler URL |
| `CLIENT_URL` | `https://allowance-ai-eight.vercel.app` |
| `GOOGLE_CALLBACK_URL` | `https://allowanceai-api.onrender.com/api/auth/google/callback` |
| `SETU_ENV` | `sandbox` |
| `MONGO_URI` | **delete this variable** |
| `REDIS_URL` | **leave unset** — optional cache only, see note below |
| `JWT_SECRET` | **do not touch** — changing it logs out every existing user |

> **`REDIS_URL` is optional and you do not need it.** The dashboard caches its summary in
> Redis for 60s when one is available, and reads straight from PostgreSQL when it is not.
> Both paths are tested and return identical numbers. Render provisions no Redis, so leaving
> this unset is the expected production setup — not a degraded one.

### [x] 4. Deploy and check Auto-Deploy — DONE, verified 2026-11-25

**Verified live:** the deployed Vercel bundle contains the v2 dashboard
(`Add a spend`, `dashboard/summary`, `Spent this month` all present in the served JS).

Render → **Manual Deploy → Deploy latest commit** (must be `c23ff7a` or newer — that is
the one with the v2 dashboard, without it login lands on a broken page).

Then Render → **Settings → Build & Deploy → Auto-Deploy** = **On**, branch `main`.
Otherwise every future push needs a manual deploy.

### [x] 5. Verify the API — DONE, verified 2026-11-25

**Verified live:** HTTP 200 with `"dbReady":true,"db":"postgres"`. Nothing to do.

```powershell
curl.exe -s https://allowanceai-api.onrender.com/api/health
```

| You see | Meaning |
|---|---|
| `"dbReady":true,"db":"postgres"` | ✅ working — Google login will now proceed |
| `"dbReady":false` | ❌ `DATABASE_URL` wrong or unreachable — check Render logs for `PostgreSQL not reachable:` |
| `"legacyMongoReady":false` | ✅ correct and expected, ignore it |

First call may take 30-60s — Render free instances sleep. That is normal.

### [x] 6. Check Vercel — DONE, verified 2026-11-25

**Verified live:** `https://allowanceai-api.onrender.com` is baked into the served
bundle, with **no** `localhost` fallback and no stray `/api` suffix. The env var took
and the rebuild happened.

> You WILL need one more Vercel redeploy after the next push, to pick up the assistant
> panel and safe-to-spend card. Auto-deploy normally handles it.

Vercel → project → **Settings → Environment Variables**:
`VITE_API_URL` = `https://allowanceai-api.onrender.com` (**no** `/api` on the end).

Then **Deployments → Redeploy**.

> Vite bakes env vars in at **build** time. Changing the variable without a rebuild
> changes nothing at all. This catches people out constantly.

### [x] 7. Google Cloud Console — the server side is right, 2026-11-25

**Verified live:** `/api/auth/google` redirects with
`redirect_uri=https://allowanceai-api.onrender.com/api/auth/google/callback`, exactly as
it should. Whether Google's console *accepts* it I cannot check without logging in as
you — that is step 8.

**APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs** must
contain exactly, with no trailing slash:

```
https://allowanceai-api.onrender.com/api/auth/google/callback
```

### [ ] 8. Smoke-test the live site — **ONLY THE GOOGLE CLICK IS LEFT**

**I already ran the rest against production on 2026-11-25**, as a throwaway account:
register → login → 6 default categories visible → budget → goal → add a ₹349 spend → the
budget bar moved to 7% used, ₹4,651 remaining, goal at 19%, transaction tagged `Manual`.
The whole PostgreSQL demo path works live. (Test account left behind:
`smoke-1795547805@allowanceai-test.invalid` — harmless, say the word and I will remove it.)

**So all you need to do is click "Sign in with Google" once** and confirm it lands you on
the dashboard. If it fails, the redirect URI in step 7 is missing from the Google console.

1. Open https://allowance-ai-eight.vercel.app
2. Register with email + password → should land you logged in
3. Log out, log back in
4. Try **Sign in with Google**

5. You should land on the **v2 dashboard**: spend this month, budget bars, goals, recent
   transactions, and an "Add a spend" form. Add one — the numbers update immediately.

**This changed on 2026-11-10.** Before, every screen in the client called v1 Mongoose
routes, including the dashboard itself (`/budget/stats`). With `MONGO_URI` deleted you
would have logged in successfully and landed on a page that returned 500. The v2 dashboard
now reads PostgreSQL and is what `/` serves.

**Known broken, don't be surprised:** "Forgot password" returns 404 (the route no longer
exists on the Prisma auth router), and the old v1 screens — expenses, jars, splits,
wishlist, friends, and the old dashboard now parked at `/v1` — still call Mongoose routes
and will fail with `MONGO_URI` gone. All logged in Tracker.md. **For your presentation,
demo the landing dashboard: add a spend → watch the budget bar and totals move.** That
whole path is on PostgreSQL and tested end-to-end.

---

## 🤖 THE ASSISTANT — one new thing to do

Phase 4 is built and tested: the assistant answers questions from your own transactions,
using hybrid search over PostgreSQL. It works end to end locally — I verified it with your
real OpenRouter key. To make it work **in production** it needs one shared secret.

**Nothing breaks if you skip this.** With the token unset, `/api/assistant/status` reports
`configured: false` and the client hides the assistant panel completely. The dashboard,
budgets, goals, safe-to-spend and ingestion are all unaffected. So this is additive, and
safe to do after your demo if you would rather not touch Render tonight.

### [ ] A. Generate one secret

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy it. It goes in **two** places and **must be byte-identical in both**, or the assistant
returns 401 forever.

### [ ] B. Put it on both Render services

| Service | Variable | Value |
|---|---|---|
| `allowanceai-api` | `INTERNAL_API_TOKEN` | the secret from A |
| `allowanceai-api` | `AI_SERVICE_URL` | `https://allowanceai-ai.onrender.com` (no trailing slash) |
| `allowanceai-ai` | `INTERNAL_API_TOKEN` | **the same secret** |
| `allowanceai-ai` | `DATABASE_URL` | the **6543** pooler URL, ending `?pgbouncer=true` |
| `allowanceai-ai` | `OPENAI_API_KEY` | your OpenRouter key |
| `allowanceai-ai` | `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` |

> **Why a shared secret at all.** `ai-service`'s `/assistant/*` endpoints take a `user_id`
> and return that user's spending history. If they were reachable from a browser, anyone
> could read anyone's finances by changing a UUID. So the chain is
> **browser → API (checks your login) → ai-service (checks this token)**. `ai-service`
> refuses to serve at all when the token is unset — it fails closed, never open.
>
> `allowanceai-ai` does **not** need `DIRECT_URL`: it never runs migrations.

### [ ] C. Check it

```powershell
curl.exe -s https://allowanceai-ai.onrender.com/assistant/health
```

| You see | Meaning |
|---|---|
| `"internal_auth":"configured"` and `"generation":"available"` | ✅ ready |
| `"internal_auth":"NOT CONFIGURED"` | token missing on `allowanceai-ai` |
| `"generation":"no LLM key configured"` | `OPENAI_API_KEY` missing there |

Then on the site: open the dashboard and ask *"How much have I spent this month?"* The
answer shows the transactions it used, each tagged with how it was found.

### [ ] D. First question will be slow — that is expected

The embedding model is ~65 MB and loads on first use, and Render free instances sleep. The
first question after a quiet spell can take 30-60s or time out once. **Ask one throwaway
question a minute before you demo** and every later one is fast.

---

## ⚠️ CI shows a red ✗ right now — it is a GitHub outage, not our code

Commit `95a6f4a` shows a failed CI run. **Nothing is wrong with the repo.** During that
push, GitHub Actions was in a declared **major outage**
("Incident with Actions", 2026-11-09 18:12 UTC). Jobs were never scheduled:
attempt 1 created only 1 of 3 jobs, attempt 2 created **zero**, and
`gh run view --log-failed` returns nothing at all — because no job ever ran, let alone
failed.

Evidence it is not us:

- `.github/workflows/ci.yml` is **byte-identical** between the last green run (`86b2852`)
  and the red one (`95a6f4a`) — same git blob `7ca69f4`. The diff touches no CI file.
- The same suite was run locally against a **fresh, empty** database under CI conditions
  (all 5 test files racing to migrate a blank DB): **28 tests, 28 pass, 0 fail.**

### [x] Re-run CI — DONE, it went green

**Resolved 2026-11-10.** GitHub reported All Systems Operational, the run was re-triggered
on the *same commit* with no code change, and all jobs passed. Confirms the red ✗ was the
outage. Nothing was wrong with the repo. Original instructions kept below for reference.

```powershell
cd C:UsersAdityaDesktopAllowanceAIallowance-ai
gh run rerun --failed            # or just: gh run list --limit 3
gh run watch                     # pick the run, wait for it
```

Expect all three jobs green, with `# pass 28` / `# fail 0` in the Server job log.
Do not change any code to "fix" this — there is nothing to fix.

---

## ✅ DECISIONS — MADE 2026-11-25, nothing pending

You approved **P1, P2, P3, P4**. They are written into the specs; no action left for you.

| # | Decision | Outcome |
|---|---|---|
| P1 | Hybrid retrieval (pgvector + full-text, RRF fusion) | ✅ adopted — TechSpec §3, Schema §3/§4 |
| P2 | Pin embeddings to `bge-small-en-v1.5` (384-dim, local) | ✅ adopted — TechSpec §3.1 |
| P3 | Deterministic Recall@K CI gate; Ragas → nightly | ✅ adopted — Phase 5 DoD rewritten |
| P4 | Transactions: one row → one sentence, no chunking | ✅ adopted — TechSpec §3.2 |
| P9 | Drop RabbitMQ from the critical path | ❌ **not** adopted — Rules.md mandate stands |
| P6 | LLM: local embeddings + swappable small chat model | deferred to Phase 4 |
| P10 / P11 | Reranking / query rewriting | skipped |

**One thing this buys you for the presentation:** P2 is a good answer to "why 384
dimensions?" — the column was already `vector(384)`, which silently rules out most current
embedding models (768, 1024, 3072). Naming that constraint out loud, and the fact that
changing it later costs a migration *plus* a full re-embed, is the kind of detail a
knowledgeable reviewer probes for.

Still open and genuinely undecided: P5, P7, P8, P10, P11 — none of them block a demo.

---

## 🔵 OPTIONAL — after step 2 succeeds

### [x] Seed the default categories on Supabase — DONE

**Seeded 2026-11-19.** `Created 6 default categories: Food, Transport, Shopping,
Entertainment, Health, Other`. Re-ran to confirm idempotency:
`All 6 default categories already present — nothing to do.` All six verified in Supabase as
system rows (`is_default = true`, `user_id IS NULL`), so every new account sees them without
creating anything.

New accounts otherwise land on an empty category list. Safe to re-run, and it never
touches a user’s own categories. Check first, then write:

```powershell
cd C:UsersAdityaDesktopAllowanceAIallowance-aiserver
$env:DATABASE_URL = "<6543 pooler URL, ending ?pgbouncer=true>"
$env:DIRECT_URL    = "<5432 session pooler URL>"
npm run seed:categories -- --dry-run   # shows what it would create, writes nothing
npm run seed:categories                # actually creates them
```

Expect: `Created 6 default categories: Food, Transport, Shopping, Entertainment, Health, Other`.
Run it twice if you like — the second run prints "already present, nothing to do".

---

## 🟢 LATER — not blocking anything

### [ ] Keep Setu on sandbox
`SETU_ENV=sandbox` is pinned in `render.yaml`. Per Rules.md it must never be flipped to
production without you explicitly saying so.

### [ ] Optional: free-tier accounts for Phase 4+
Only needed when the RAG assistant is built, not now:
- **Google AI Studio** — a Gemini API key. Note the free tier says *"Content used to improve
  our products"*. Fine for synthetic demo data; worth knowing before real data touches it.
- **Langfuse** — free cloud tier or self-host, for tracing.
- **Sentry** — free tier, Phase 7.

### [ ] If Docker Desktop won't start
It hung once during this session (VM backend dead, WSL distro stopped). Fix that worked:

```powershell
Get-Process "*Docker*","com.docker*" | Stop-Process -Force
wsl --shutdown
Start-Process "C:\Users\Aditya\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
```

It was ready ~5s later. Worth knowing before a presentation.

---

## ✅ ALREADY DONE — no action needed

- Phase 2 ingestion committed, pushed, **CI green on the real run** (`tests 14 / pass 14 / fail 0`,
  including `ok 3 - Phase 2 — ingestion persistence against live Postgres` in CI itself).
- The live-login bug is **fixed in code** (`66b59a9`) — but not live until you do step 4 above.
- `render.yaml`, `.env.example`, `schema.prisma` now document `DATABASE_URL` + `DIRECT_URL`.
- Redis + RabbitMQ proven healthy locally (`PONG`, `Ping succeeded`).
- Three Phase 1 leftovers closed with real test output: Google OAuth writes `users.google_id`;
  categories + goals read-back tests (the old DoD only covered budgets); default categories seeded.
- **Security bug found and fixed:** `POST /api/categories` trusted a client-supplied
  `isDefault`, which let any user publish a category into every other user’s list.
  Now always written as false. This one is worth mentioning in your presentation —
  it was caught by writing the missing test, not by reading the code.
