# AllowanceAI — Production deployment checklist

> **v2 note.** The datastore is **PostgreSQL + pgvector** (Supabase free tier), not MongoDB.
> Auth, categories, budgets, goals and ingestion are all Prisma/PostgreSQL. MongoDB is
> legacy v1 only and is **optional** — the server boots and logs in without it.
>
> **Never commit a connection string, password or key.** Everything secret is set in the
> Render / Vercel dashboards. `render.yaml` only declares variable *names* (`sync: false`).

## Quick links

- **GitHub:** https://github.com/Platypus12345/AllowanceAI
- **Frontend (Vercel):** `https://allowance-ai-eight.vercel.app`
- **API (Render):** `https://allowanceai-api.onrender.com`
- **AI (Render):** `https://allowanceai-ai.onrender.com`

## 1. Supabase (PostgreSQL + pgvector)

Free tier. Create the project, then grab **two** connection strings from
**Dashboard → Connect**. Copy them verbatim — do not hand-build the hostname, it differs
per project and region.

| Var | Which string | Port | Used by |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** + `?pgbouncer=true` | 6543 | the running app |
| `DIRECT_URL` | **Session pooler** | 5432 | `prisma migrate` only |

Shape (placeholders — fill from the dashboard):

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<host>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.<project-ref>:<password>@<host>.pooler.supabase.com:5432/postgres
```

**Why two:** the transaction pooler cannot hold prepared statements (hence `pgbouncer=true`)
and drops the Postgres advisory lock `prisma migrate deploy` takes, so migrations run
through port 6543 can hang or half-apply. `schema.prisma` declares `directUrl`, so
**`DIRECT_URL` must always exist** or every Prisma CLI command fails with
`P1012 Environment variable not found: DIRECT_URL`. (`prisma generate`, which runs in the
Render build, needs only `DATABASE_URL` — verified.)

If your password contains `@ : / ? # & %`, URL-encode it or Prisma will misparse the URL.

### 1a. Enable pgvector **before** the first migration

The `documents` table has an `embedding vector(384)` column. The migration says
`CREATE EXTENSION IF NOT EXISTS vector;` unqualified, so the extension must resolve on the
default `search_path`. If Supabase has already put `vector` in the `extensions` schema
(what the dashboard toggle does), that unqualified `vector(384)` can fail with
`type "vector" does not exist`.

Run this in **Supabase → SQL Editor** first:

```sql
-- 1. Where is pgvector, if anywhere?
SELECT e.extname, n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'vector';
```

- **No rows** → `CREATE EXTENSION vector WITH SCHEMA public;`
- **Row says `extensions`** → `ALTER EXTENSION vector SET SCHEMA public;`
- **Row says `public`** → nothing to do.

Confirm with `SELECT '[1,2,3]'::vector;` — it should return a value, not an error.

> **Verified, not guessed.** Reproduced against `pgvector/pgvector:pg16` on a throwaway
> database: with `vector` installed in an `extensions` schema, the migration's
> `CREATE EXTENSION IF NOT EXISTS vector` silently no-ops
> (`NOTICE: extension "vector" already exists, skipping`) and the next statement dies with
> `ERROR: type "vector" does not exist`. After `ALTER EXTENSION vector SET SCHEMA public`,
> both `CREATE TABLE probe (embedding vector(384))` and `SELECT '[1,2,3]'::vector` succeed.
> So **enabling pgvector from the Supabase dashboard toggle can break
> `prisma migrate deploy`** — check the schema first.

### 1b. Apply migrations (run this yourself, from your machine)

Migrations are deliberately **not** in the Render build command, so a deploy can never
silently alter the production database.

```powershell
cd server
$env:DATABASE_URL = "<the 6543 pooler URL with ?pgbouncer=true>"
$env:DIRECT_URL    = "<the 5432 session pooler URL>"
npx prisma migrate deploy
```

Expect `1 migration found` → `Applied migration 20261005000000_init`. Then verify:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

You should see `users`, `linked_accounts`, `transactions`, `budgets`, `goals`,
`categories`, `documents`, `badges`, `user_badges`, `notifications`, `audit_log`,
plus `_prisma_migrations`.

Do **not** run `prisma migrate dev` against production — it wants a shadow database and
can reset. `migrate deploy` only.

## 2. Render (`allowanceai-api`)

Dashboard → the service → **Environment**. Set:

| Var | Value |
|---|---|
| `DATABASE_URL` | the 6543 pooler URL, ending `?pgbouncer=true` |
| `DIRECT_URL` | the 5432 session pooler URL |
| `JWT_SECRET` | **leave as-is** — rotating it logs every existing user out |
| `CLIENT_URL` | `https://allowance-ai-eight.vercel.app` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://allowanceai-api.onrender.com/api/auth/google/callback` |
| `AI_SERVICE_URL` | `https://allowanceai-ai.onrender.com` |
| `SETU_ENV` | `sandbox` — never `production` |
| `MONGO_URI` | **delete it.** Legacy v1 only; absent is the correct state |

Then **Manual Deploy → Deploy latest commit** (Render does not pick up `render.yaml`
env-var changes on its own; dashboard values win regardless).

Check **Settings → Build & Deploy → Auto-Deploy** is **On** for branch `main`, or every
push needs a manual deploy.

Free-tier instances sleep after ~15 min idle, so the first request can take 30-60s. That
is expected, not a bug — but it is *not* the same failure as a missing `DATABASE_URL`.

### Verify

```bash
curl -s https://allowanceai-api.onrender.com/api/health
```

Want: `{"status":"ok","dbReady":true,"db":"postgres","legacyMongoReady":false,...}`

- `dbReady: true` → PostgreSQL is reachable. **The web client gates login on this flag**,
  so it must be `true` or Google login will refuse to start.
- `dbReady: false` → `DATABASE_URL` is wrong/unreachable. Check Render logs for
  `PostgreSQL not reachable:` or `FATAL CONFIG: DATABASE_URL is not set`.
- `legacyMongoReady: false` is **fine and expected**.

Then end-to-end:

```bash
curl -s -X POST https://allowanceai-api.onrender.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-test@example.com","password":"correcthorse8"}'
```

Want HTTP 201 with a `token`. A 500 means the DB is not actually writable.

## 3. Google OAuth

In **Google Cloud Console → Credentials → your OAuth client**, the Authorized redirect URI
must match `GOOGLE_CALLBACK_URL` exactly, including scheme and no trailing slash:

```
https://allowanceai-api.onrender.com/api/auth/google/callback
```

`config/passport.js` and `routes/auth.js` are fully Prisma — a Google sign-in upserts a
`users` row by `google_id`, falling back to matching on `email`. There is no Mongoose in
the auth path.

## 4. Vercel (`client`)

1. Project root: **`client`**.
2. `VITE_API_URL` = `https://allowanceai-api.onrender.com` (no `/api` suffix — the axios
   client appends it).
3. Confirm **Settings → Git → Production Branch** is `main` and auto-deploy is on.
4. Redeploy after changing `VITE_API_URL` — Vite inlines env vars at **build** time, so an
   env change with no rebuild changes nothing.

## 5. Known gaps (v1 leftovers, not deploy blockers)

- `LoginPage.jsx` posts to `/api/auth/forgot-password`, which no longer exists on the
  Prisma auth router → 404. Password reset is unavailable until the frontend rebuild.
- `client/` and `mobile/` are still v1 code; the v1 routes they call (expenses, jars,
  splits, wishlist, …) are still Mongoose and need `MONGO_URI` to work. With Mongo absent
  those specific screens fail while auth, budgets, goals and ingestion work. Fixing this is
  Phase 3 (frontend rebuild).
