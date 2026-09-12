# AllowanceAI — App Flow

## 1. Onboarding

1. User signs up (email/password or Google OAuth) on web or mobile.
2. Platform-specific data-linking step (see §2) — skippable, but the app nudges strongly since it's the core value prop.
3. First-run: quick budget setup (monthly allowance amount, top 3 spend categories) — this seeds the "rules" the AI assistant will later use.

## 2. Data-linking flow (by platform)

**Mobile (Android):**
1. App requests SMS read permission with a clear explanation screen (why, what's read, what's not stored raw).
2. Background job parses incoming bank/UPI SMS, extracts amount/merchant/category guess, POSTs to `server/`.
3. If permission denied → falls back to manual entry, same as web without a linked account.

**Mobile (iOS):**
1. SMS reading isn't offered (OS restriction) — user is routed straight to manual entry or, once built, the same Setu AA flow as web.

**Web:**
1. User chooses "Link bank account" → Setu AA consent flow (sandbox) → redirected back with a consent handle.
2. `server/` polls/fetches statement data via Setu AA, parses into `transactions`.
3. Fallback (if not using AA): "Connect Gmail" → parses transaction-alert emails on a schedule.

## 3. Daily use loop

1. User opens app → dashboard shows: safety score, today's remaining safe-to-spend amount, recent transactions (auto-ingested, no action needed).
2. New transactions trigger a Redis-cached dashboard recompute and a websocket push to any open client, so the UI updates live without a refresh.
3. Duplicate detection runs on ingestion — near-identical amount+merchant+timestamp within a short window is flagged, not silently double-counted.

## 4. AI chat / RAG flow

1. User asks the assistant a question ("how much did I spend on food this week", "can I afford X").
2. `ai-service/` receives the message with `session_id`.
3. **Retrieve node (LangGraph):** embed the question, query pgvector for relevant past transactions/notes/chat turns.
4. **Rules node:** pull exact current-month budget/balance numbers directly from Postgres (never from vector retrieval).
5. **Generate node:** LLM call with retrieved context + rules + recent Redis-stored chat history.
6. **Guardrails node:** Guardrails AI checks the reply (no fabricated numbers, stays in scope) before it's returned.
7. Reply streams back to the client over websocket, token by token.
8. The full run (all four nodes) is traced in Langfuse — useful for debugging and for demoing "here's how the AI actually reasons" to a recruiter.

## 5. Budget/goal flow

1. User sets a goal (e.g., save ₹5,000 this month) or a category budget.
2. Every new transaction re-checks active budgets/goals; if a threshold is crossed, a notification is queued.
3. Monthly report aggregates the month's data into the spending heatmap calendar and safety-score trend.

## 6. Notification flow

1. Triggers: budget threshold crossed, unusual spend detected, streak milestone, weekly digest.
2. Notifications are generated server-side, queued (RabbitMQ), and delivered via push (mobile) or in-app banner (web) — never blocking the request that triggered them.

## 7. Financial Wrapped flow

1. On the 1st of each month, a scheduled job aggregates the previous month's data per user.
2. Generates story-card data (top category, biggest single spend, savings streak, a fun stat) — rendered client-side as the Spotify-Wrapped-style cards.
3. This job is a good candidate for the "serverless" piece of the stack (a scheduled Lambda or Render cron job) rather than living in the always-on API.
