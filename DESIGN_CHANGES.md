# DESIGN_CHANGES.md — AllowanceAI Stitch Design System Migration

## Overview

This document tracks all visual layer changes made during the AllowanceAI migration to the **Stitch Design System**. No backend logic, API calls, or data models were modified.

---

## Design System Tokens

| Token | Value | Usage |
|---|---|---|
| Background | `#0b1326` | App shell background |
| Primary | `#c0c1ff` | Accents, icons, primary actions |
| Secondary | `#44e2cd` | Success, highlights, AI previews |
| Tertiary | `#ffb690` | Warnings, streaks, tips |
| Primary Container | `#6366f1` (indigo-500) | CTA buttons, active tabs |
| On Surface | `#e2e8f0` | Body text |
| On Surface Variant | `#94a3b8` | Subtitles, secondary labels |
| Error | `rgba(255,100,100,...)` | Destructive actions |

## Typography

| Role | Font Family | Weight |
|---|---|---|
| All UI labels, headings, body | Plus Jakarta Sans | 400–800 |
| All numbers, financial data | Space Grotesk | 500–700 |

---

## Phase 1 — Core Screens (Prior Sessions)

### Web Client (`client/src/`)
- `index.html` — Added Google Fonts (Plus Jakarta Sans, Space Grotesk), Material Symbols
- `index.css` — Full Stitch token system, glass-card, glow utilities, scrollbar hide
- `tailwind.config.js` — Extended with custom colors, font families, spacing, border-radius
- `components/AmbientBackground.jsx` — [NEW] Animated ambient blob layer
- `components/TopAppBar.jsx` — Stitch header with glassmorphism
- `components/Sidebar.jsx` — Material Icons nav, active states, glass card
- `components/DashboardStats.jsx` — Premium stat cards with glow
- `components/SpendingChart.jsx` — Custom gradient donut chart
- `components/ExpenseList.jsx` — Stitch list rows with category chips
- `components/ExpenseForm.jsx` — Glass form with quick-amount chips
- `components/AIChat.jsx` — Chat bubbles with typing indicator
- `components/BudgetGoals.jsx` — Progress bars with color-coded status
- `components/SpendPrediction.jsx` — AI prediction cards
- `components/ReportCard.jsx` — Grade badge with neon glow
- `components/SplitsTab.jsx` — Split card grid
- `components/RecurringExpenses.jsx` — Subscription list
- `components/SavingTips.jsx` — AI tips with icons
- `components/AnalyticsChart.jsx` — Multi-line chart with gradient fills
- `pages/LoginPage.jsx` — Full glassmorphism login with ambient background
- `pages/DashboardPage.jsx` — Shell with sidebar, tab routing, profile panel

### Mobile (`mobile/`)
- `constants/theme.ts` — [NEW] Unified color + font constants
- `components/AmbientBackground.tsx` — [NEW] React Native ambient blob layer
- `components/TopAppBar.tsx` — Stitch top bar with blur
- `app/_layout.tsx` — Root stack with font loading, push notifications
- `app/(tabs)/_layout.tsx` — Custom tab bar with glassmorphism FAB
- `app/(tabs)/index.tsx` — Dashboard with hero card, survival status, quick stats
- `app/(tabs)/profile.tsx` — Profile with settings navigation rows
- `app/(tabs)/ai.tsx` — AI chat screen
- `app/(tabs)/expenses.tsx` — Expense log
- `app/(tabs)/goals.tsx` — Budget goals with ring charts
- `app/login.tsx` — Mobile login with glassmorphism
- `app/sms-log.tsx` — SMS tracking log with status pills
- `app/report.tsx` — Monthly report card
- `app/prediction.tsx` — Spend prediction
- `app/analytics.tsx` — Analytics chart screen
- `app/saving-tips.tsx` — AI saving tips
- `app/allowance-request.tsx` — Legacy allowance request (superseded)

---

## Phase 2 — New Screens (This Session)

### Web Client — New Pages

#### [NEW] `pages/AIPersonalityPage.jsx`
Route: `/profile/ai-personality`
- 2×2 personality grid with animated selected state (teal border + glow)
- Dynamic "Current Mood Preview" card — quote updates on tap
- Save → `PUT /api/user/preferences { aiPersonality }` + localStorage
- Pro Tip banner with `tips_and_updates` icon

#### [NEW] `pages/HelpPage.jsx`
Route: `/help`
- Searchable topic list with icon containers
- 2-col support channel buttons (AI Chat + Email)
- AI Financial Counselor highlight card with indigo/teal blobs
- Footer with version info

#### [NEW] `pages/RequestMoneyPage.jsx`
Route: `/request-money`
- Tab toggle: "From Parents 👨👩👦" / "From Friends 💸"
- Large centered amount input with ₹ prefix + quick-amount chips
- Parent tab: avatar selector, reason textarea + quick-chips, AI Tip card, WhatsApp deep-link CTA
- Friends tab: friend balance cards (unsettled amounts), UPI / WhatsApp method toggle, UPI collect link, WhatsApp pre-fill
- Pending requests collapsible list with PENDING / RECEIVED / NO RESPONSE status pills
- Calls `POST /api/allowance-requests` and `POST /api/splits/request`

#### [NEW] `pages/SMSSyncPage.jsx`
Route: `/profile/sms-sync`
- Web-only static information page (SMS not available on web/iOS)
- Hero illustration with message icon + settings badge
- Android-only amber info banner
- Privacy Guarantee card with teal left border

### Mobile — New Screens

#### [NEW] `app/ai-personality.tsx`
- 2×2 personality grid with dynamic selected state (teal border + shadow)
- Quote preview card updates on selection tap
- Saves to `AsyncStorage` key `aiPersonality` + calls `PUT /api/user/preferences`
- Pro Tip banner + Save Preferences CTA with bolt icon

#### [NEW] `app/help.tsx`
- Search bar with `search` icon placeholder
- 3 recommended topics with colored icon containers
- 2-col support grid (Chat with AI → AI tab, Email us → mailto)
- AI Counselor card with "NEW" badge + indigo/teal blobs
- App version footer

#### [NEW] `app/request-money.tsx`
- Full parity with web RequestMoneyPage
- Parent tab: avatar scroll, reason textarea, AI tip card
- Friends tab: friend balance horizontal scroll, UPI/WhatsApp pill toggle, UPI collect deep-link (`upi://collect?...`)
- Calls `postAllowanceRequest` and `postSplitRequest` from `budgetClient.ts`

#### [NEW] `app/sms-sync.tsx`
- Hero section: circular glass container with `message` icon + settings badge
- Enable toggle using `useSMS()` context
- Active Channels list: Bank SMS, GPay, PhonePe with check_circle / radio indicators
- "Test Sync" button (simulates last 5 SMS parse)
- Privacy Guarantee card with teal left border

### API Client Updates

#### `mobile/src/api/budgetClient.ts`
- `updatePreferences({ aiPersonality })` — `PUT /api/user/preferences`
- `postSplitRequest({ amount, reason, toUserId?, method })` — `POST /api/splits/request`

### Navigation Integration

#### Web `App.jsx`
Added protected routes:
- `/profile/ai-personality` → `AIPersonalityPage`
- `/help` → `HelpPage`
- `/request-money` → `RequestMoneyPage`
- `/profile/sms-sync` → `SMSSyncPage`

#### Mobile `app/_layout.tsx`
Added Stack screens:
- `ai-personality`
- `help`
- `request-money`
- `sms-sync`

#### Mobile `app/(tabs)/profile.tsx`
Updated settings list rows to navigate to new screens:
- "Request Allowance" → `/request-money`
- "SMS Tracking Sync" → `/sms-sync` (Android only)
- "AI Personality Settings" → `/ai-personality`
- "Help & Support" → `/help`

#### Web `DashboardPage.jsx`
Added `profile` tab view with:
- Avatar + name hero row
- Account settings card → Request Allowance, Monthly Report
- App preferences card → AI Personality, SMS Sync, Help & Support (all navigating to new routes)

---

## Summary Statistics

| Category | Count |
|---|---|
| New web pages | 4 |
| New mobile screens | 4 |
| Updated navigation files | 4 |
| New API functions | 2 |
| Total new files | 8 |
| Modified files | 6 |
