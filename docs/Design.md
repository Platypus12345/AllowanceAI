# AllowanceAI — Design.md

## 1. Design philosophy

**Updated direction (v2):** inspired by dashboard products like Flux — light base UI with a dark sidebar and occasional dark "hero" cards for contrast, lime-green + violet accent pair, big bold rounded stat numbers, donut/circle charts, soft rounded cards with a kebab menu in the top-right corner. This replaces the earlier "dark-mode-first neon" direction — the new read is *clean and confident*, not moody. Financial numbers should still feel alive (animated counters, live-updating charts), just against a brighter, more scannable base.

Rule of thumb per screen: **one dark card max**, used for the section that deserves the most visual weight (recent activity, sleep-analysis-style deep dive, or in our case: Recent Transactions / Financial Wrapped). Everything else stays light and airy so the dark card actually pops instead of competing.

## 2. Core screens (with creative direction per screen)

| Screen | Purpose | Creative notes |
|---|---|---|
| Login / Signup | Auth entry | Split layout: left panel is the form on a plain light background; right panel is a dark brand panel with a subtle animation — coins/rupee symbols gently floating upward, or a thin animated line chart ticking as decoration. Google OAuth button and email form share the same rounded pill style as the reference's search bar. |
| Dashboard | Daily overview | Sidebar (dark, like the reference) + light main area. Top bar: avatar, greeting, search, notification bell with unread-count pill. Three-up card row: **Safety Score** (donut, like "Wellness Index"), **Safe-to-Spend Today** (nested circles split by category, like "Energy Used"), **This Week's Activity** (auto-ingested transaction count + trend pill, like "Heart Rate"). Below: one **dark hero card** — "Recent Transactions" — styled like the reference's Sleep Analysis card, with a small bar chart of the last 7 days and a lime/violet two-tone legend. |
| Chat (RAG assistant) | Ask questions about spending | Light main panel, message bubbles as soft rounded cards. Assistant replies show a small "sources" pill (like the reference's "+5%" pill) that expands to show which transactions were retrieved — this is both a design touch and a trust/demo signal. |
| Transactions | Full list, filter/search | Light card-table hybrid: each transaction is a row-card with merchant, category tag (colored pill), amount, and a small source icon (SMS / bank-linked / manual). |
| Budgets & Goals | Track progress | Each budget/goal is a card with a circular progress ring (reuse the donut component from Dashboard) rather than a flat progress bar, for visual consistency with the Wellness Index style. |
| Spending Calendar | Heatmap | A dot-grid heatmap directly inspired by the reference's Wellness Index dot pattern — each dot's opacity/size maps to that day's spend intensity instead of a generic calendar grid. |
| Financial Wrapped | Monthly story cards | This is where the "one dark card" rule gets suspended on purpose — the *entire* Wrapped experience is a full-screen, swipeable sequence of dark cards (Spotify-Wrapped-style), each with one big bold stat and a lime or violet accent shape behind it. |
| Settings | Linked accounts, prefs | Plain light cards, no dark accents — this screen should feel calm/administrative, not exciting, by contrast with everything else. |

## 3. Design tokens (starting point — refine visually during build)

```css
/* Base (light) */
--bg-base: #f4f5f0;          /* soft off-white, like the reference's main panel */
--bg-sidebar: #14151a;        /* near-black sidebar */
--bg-card: #ffffff;
--bg-card-dark: #14151a;      /* the one dark hero card per screen */

--accent-lime: #d7f24e;       /* primary accent — CTAs, active nav state, key highlights */
--accent-violet: #8b7bf7;     /* secondary accent — secondary data series, badges */
--accent-warning: #ffb84d;
--accent-danger: #ff5d7a;

--text-primary: #14151a;
--text-on-dark: #f4f5f0;
--text-muted: #8792a3;

--radius-card: 1.25rem;       /* generous rounding, matches reference card style */
--radius-pill: 999px;

--font-display: 'Space Grotesk', sans-serif;  /* big stat numbers, headings */
--font-body: 'Inter', sans-serif;
```

## 4. Component conventions

- Every card: white (or dark, for the one hero card), `--radius-card` corners, soft shadow, icon + title + kebab-menu (⋮) in the top row — directly mirroring the reference's card header pattern.
- Big stat numbers are always bold and oversized relative to their label, with a small colored trend pill (`+5%` style, lime for positive, coral for negative) next to them where a trend exists.
- Donut/circle charts are the default for anything "out of a total" (safety score, sleep-efficiency-style percentages, budget progress) — flat progress bars are the fallback only for linear/sequential things (a calendar streak, a savings goal timeline).
- Sidebar: dark background, active item shown as a light pill (like the reference's white "Dashboard" pill on the dark sidebar), badge counts as small lime circles.

## 5. Mobile vs web differences

- Mobile: bottom tab nav replaces the sidebar (Dashboard / Chat / Transactions / More); dark-sidebar aesthetic translates to a dark bottom nav bar instead.
- Web: full sidebar + top bar as described above.
- Both: same tokens, same one-dark-card-per-screen rule, same donut-chart-first convention.

## 6. Accessibility baseline

- Minimum contrast ratio 4.5:1 — check lime-on-white and lime-on-dark-sidebar carefully, lime is a light color and can fail contrast as a *text* color even though it's fine as a fill/accent.
- All donut/dot-grid charts have a non-visual data table fallback (screen-reader accessible).
- Motion (floating coins on auth screen, animated counters) respects `prefers-reduced-motion`.
