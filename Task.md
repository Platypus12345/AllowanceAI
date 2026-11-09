# Task.md — things only Aditya can do

This is your checklist. Claude keeps it updated; it holds **only** the steps that need
your hands (dashboards, secrets, browser clicks). Everything Claude can do itself goes in
[Tracker.md](Tracker.md) instead.

Last updated: 2026-11-09, after pushing `baa91c9`. Full server suite: **28 tests, 28 pass, 0 fail.**

**Never paste a password, connection string or API key into chat.** Set them in the
provider dashboards yourself. Nothing secret belongs in this repo.

---

## 🔴 TONIGHT — get the live login working

Do these in order. Order matters: step 2 fails if step 1 is skipped.

### [ ] 1. Enable pgvector in Supabase, in the `public` schema

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

### [ ] 2. Apply the database migrations from your machine

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

### [ ] 3. Set the environment variables in Render

Render → `allowanceai-api` → **Environment**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the **6543** pooler URL, ending `?pgbouncer=true` |
| `DIRECT_URL` | the **5432** session pooler URL |
| `CLIENT_URL` | `https://allowance-ai-eight.vercel.app` |
| `GOOGLE_CALLBACK_URL` | `https://allowanceai-api.onrender.com/api/auth/google/callback` |
| `SETU_ENV` | `sandbox` |
| `MONGO_URI` | **delete this variable** |
| `JWT_SECRET` | **do not touch** — changing it logs out every existing user |

### [ ] 4. Deploy and check Auto-Deploy

Render → **Manual Deploy → Deploy latest commit** (must be `86b2852` or newer).

Then Render → **Settings → Build & Deploy → Auto-Deploy** = **On**, branch `main`.
Otherwise every future push needs a manual deploy.

### [ ] 5. Verify the API

```powershell
curl.exe -s https://allowanceai-api.onrender.com/api/health
```

| You see | Meaning |
|---|---|
| `"dbReady":true,"db":"postgres"` | ✅ working — Google login will now proceed |
| `"dbReady":false` | ❌ `DATABASE_URL` wrong or unreachable — check Render logs for `PostgreSQL not reachable:` |
| `"legacyMongoReady":false` | ✅ correct and expected, ignore it |

First call may take 30-60s — Render free instances sleep. That is normal.

### [ ] 6. Check Vercel, then redeploy it

Vercel → project → **Settings → Environment Variables**:
`VITE_API_URL` = `https://allowanceai-api.onrender.com` (**no** `/api` on the end).

Then **Deployments → Redeploy**.

> Vite bakes env vars in at **build** time. Changing the variable without a rebuild
> changes nothing at all. This catches people out constantly.

### [ ] 7. Google Cloud Console — redirect URI

**APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs** must
contain exactly, with no trailing slash:

```
https://allowanceai-api.onrender.com/api/auth/google/callback
```

### [ ] 8. Smoke-test the live site

1. Open https://allowance-ai-eight.vercel.app
2. Register with email + password → should land you logged in
3. Log out, log back in
4. Try **Sign in with Google**

**Known broken, don't be surprised:** "Forgot password" returns 404 (the route no longer
exists on the Prisma auth router), and the old v1 screens — expenses, jars, splits,
wishlist, friends — will fail because they still call Mongoose routes and `MONGO_URI` is
gone. Both are logged in Tracker.md Backlog. **For your presentation, demo
login → budgets → goals → transactions.** That path is on PostgreSQL and tested.

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

### [ ] Re-run CI once https://www.githubstatus.com shows Actions operational

```powershell
cd C:UsersAdityaDesktopAllowanceAIallowance-ai
gh run rerun --failed            # or just: gh run list --limit 3
gh run watch                     # pick the run, wait for it
```

Expect all three jobs green, with `# pass 28` / `# fail 0` in the Server job log.
Do not change any code to "fix" this — there is nothing to fix.

---

## 🟡 DECISIONS CLAUDE IS WAITING ON

From [docs/Proposals.md](docs/Proposals.md). Nothing is implemented. Reply with the numbers
you approve — e.g. "do P1, P3, P4".

| # | Decision | Claude's recommendation |
|---|---|---|
| P1 | Hybrid retrieval (pgvector + full-text, RRF fusion) | **adopt now** — decide before Phase 4 code exists |
| P3 | Deterministic Recall@K CI gate; Ragas → nightly | **adopt now** — changes a committed Phase 5 DoD, so needs your word |
| P4 | Transactions: one row → one sentence, no chunking | **adopt now** |
| P2 | Pin embeddings to `bge-small-en-v1.5` (384-dim) | **adopt now** — docs only, you're already locked in by the schema |
| P6 | LLM: local embeddings + swappable small chat model | **adopt later** (Phase 4) |
| P9 | Drop RabbitMQ from the critical path | your call — contradicts a Rules.md mandate |
| P10 / P11 | Reranking / query rewriting | **skip for now** |

Approved items go: docs commit first, then implementation. Claude will not touch specs or
code for these until you say so.

---

## 🔵 OPTIONAL — after step 2 succeeds

### [ ] Seed the default categories on Supabase

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
