# Dashboard redesign v2 — Card Grid (direction D)

> **Date:** 2026-06-08
> **Author:** Tri (FE) + Claude
> **Status:** Design — pending review
> **Visual source of truth:** `public/dashboard-v2-cards.html` (approved mockup) · chooser `public/dashboard-v2-index.html` · all-in-one `public/dashboard-v2-all.html`
> **Supersedes layout from:** `docs/superpowers/specs/2026-06-06-dashboard-redesign-design.md` (Portfolio-hero layout). The data-loading / lifecycle / state-derivation logic from that work stays.

---

## 1. Context & goal

The Dashboard (`/dashboard`, portfolio overview) currently renders a tall "Portfolio" hero card (capital deployed + 4 stat pills) on top of a 1/2/3-column grid of bot cards. We are doing a **full visual + layout refresh** toward direction **D · Card Grid**: a calm, scannable wall of uniform, information-rich bot cards under a compact horizontal KPI bar.

**Why D:** it evolves the familiar grid (lowest retraining cost, ships fastest), keeps every bot visually symmetric regardless of state, and replaces the oversized hero with a denser, more useful KPI bar. Picked over A (dense table — too pro), B (left panel split) and C (status kanban — more churn).

**Goal of this spec:** define the new layout, the card anatomy, and — explicitly — the **display & ordering rules** (`rule hiển thị trước sau`): what shows first vs later, what each lifecycle state renders, and the precedence of page-level states.

**Non-goal:** changing data loading, polling, lifecycle actions, or state derivation. Those stay as-is in `DashboardPage.tsx`, `bot.api.ts`, `presentational-state.ts`.

---

## 2. Scope

**In scope**

- Rebuild the layout of `src/pages/DashboardPage.tsx`: replace the Portfolio hero `<section>` with a compact **Portfolio KPI bar**; add a **toolbar with status filter chips**; keep the responsive **card grid** (re-tuned).
- Redesign `src/features/bot-monitoring/BotCard.tsx` to the **direction-D card anatomy** (uniform, equal-height), including a new **open-trades gauge**.
- Add a **card ordering rule** (sort) — new today, no sort exists.
- Add **filter-by-status** (chips) + per-category counts.
- Formalize the **per-state display matrix** and **badge color system**.
- Tune **loading / empty / error / no-match** states for the new layout.

**Out of scope (deferred / not this PR)**

- Per-card **sparkline**, **equity curve**, **24h change %**, **total P&L**, **allocation donut** — all need BE time-series endpoints that do not exist yet. See §7. The card and KPI bar are designed to look complete **without** them.
- Bot **detail page** redesign, **AppHeader** redesign.
- Manual reorder / pinning / drag-and-drop, saved sort preference.

---

## 3. Layout architecture

Top → bottom inside `<main>` (keep `AppHeader`, the dot-grid background, and the modal mounts unchanged). Container widens slightly from `max-w-6xl` to `max-w-7xl` to give the grid more cards per row.

```
┌──────────────────────────────────────────────────────────────┐
│ AppHeader (unchanged)                                          │
├──────────────────────────────────────────────────────────────┤
│ PORTFOLIO KPI BAR  — one horizontal band of compact tiles      │
│  Capital deployed (big mono) │ Active/Total │ Open trades │    │
│  Idle │ Transitioning │ Errors     [Refresh]                   │
├──────────────────────────────────────────────────────────────┤
│ TOOLBAR                                                        │
│  "My bots · N"   [All][Live][Dry-run][Paused][Working][Needs]  │
│                              [search]  [Import]  [+ New bot]    │
├──────────────────────────────────────────────────────────────┤
│ CARD GRID  — repeat(auto-fill, minmax(340px, 1fr)), gap 16–18  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │ card   │ │ card   │ │ card   │ │ card   │  (equal height)   │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Portfolio KPI bar (replaces the hero)

A single horizontal band (`card-coin98-flat`, rounded-2xl, ~`p-5`). Tiles, left→right:

- **Capital deployed** — large mono, `{capital} USDC`, subtle brand glow (real: sum of running balances).
- **Active / Total** — `{active} / {total}` with bullish dot.
- **Open trades** — `{openTrades}`.
- **Idle** — `{idle}`.
- **Transitioning** — `{transitioning}` (brand color, pulse if > 0).
- **Errors** — `{error}` (bearish color, only emphasized if > 0).
- Right edge: **Refresh** icon button.

All values from `computePortfolioStats` (already exists). **No 24h%, no total P&L, no equity sparkline** here in v1 (deferred — §7). During load: render the bar with skeleton numbers (don't unmount it).

### 3.2 Toolbar

- Left: `My bots · {total}` label.
- Center/left: **status filter chips** (segmented): `All · Live · Dry-run · Paused · Working · Needs attention`, each with a count. Active chip = brand fill. Mapping in §6.4.
- Right: search input (filters by name/pair, existing behavior), `Import`, `+ New bot` (existing handlers/`requireWalletThen`).

### 3.3 Card grid

- `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))`, gap `16–18px`.
- Cards are **equal height** (grid rows stretch); short-content states pad to match.
- Card click → `navigate('/bots/{id}')` (unchanged).

---

## 4. Card anatomy (direction D)

One consistent structure for **every** state (uniformity is the point). Top → bottom:

1. **Header row:** status **badge** (color + dot/spinner per §6.5) left; bot name truncates; `pair · timeframe` muted beneath.
2. **Balance:** large mono `{balance} USDC` (em-dash `—` when not available, see matrix).
3. **Open-trades gauge** _(signature element)_: label `Open` + a segmented pip gauge rendering `openTrades / maxOpenTrades` (e.g. 3/5 = 3 filled + 2 empty pips) + the numeric `3/5`. Real data. Degrades to `—/—` gracefully.
4. **Meta row:** `Stake {stakeAmount}` · `TF {timeframe}`.
5. **Divider.**
6. **Backtest strip:** `Last backtest` + `Win {x}%` · `Trades {n}` · `Net {±abs}` (green/red). Replaced by a state hint when no backtest (see matrix).
7. **Footer actions:** `Backtest` (label varies) + `Start`/`Stop` (mode-driven) + `Delete`. Transitioning → single disabled spinner button.

> **Sparkline:** the mockup shows a small per-card sparkline; it is **deferred** (no data). The layout reserves no hard space for it — cards look complete without it. When BE ships candle/equity history, it slots between balance and gauge.

**Action logic is driven by `bot.mode` (lifecycle), NOT `bot.state` (presentational)** — preserve the current rule exactly: a LIVE bot that is also running a backtest still shows **Stop**, never Start. (See `BotCard.tsx` `Actions`.)

---

## 5. Responsive behavior

Desktop-first (the app is dark, desktop-oriented). Breakpoints for the grid + KPI bar:

| Width               | Card grid                       | KPI bar              | Chips             |
| ------------------- | ------------------------------- | -------------------- | ----------------- |
| ≥ 1280px            | 3–4 cards/row (auto-fill 340px) | full horizontal row  | inline            |
| 1024–1280           | 2–3 cards/row                   | full horizontal row  | inline            |
| 768–1024            | 2 cards/row                     | tiles wrap to 2 rows | horizontal scroll |
| < 768 (best-effort) | 1 card/row                      | tiles stack          | horizontal scroll |

Cards keep equal height within a row via grid row-stretch.

---

## 6. Display & ordering rules ⭐ (`rule hiển thị trước sau`)

### 6.1 Page-level display precedence

Evaluated in this order; first match wins (mirrors current `DashboardPage` branches):

| #   | Condition                          | Render                                                                                   |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `realBots === null` (not loaded)   | KPI bar (skeleton values) + toolbar (disabled) + **skeleton card grid** (6 placeholders) |
| 2   | `fetchError`                       | KPI bar (skeleton) + **error card** with Retry                                           |
| 3   | loaded & `realBots.length === 0`   | **`DashboardEmptyState`** (create/import CTA) — no KPI bar/toolbar                       |
| 4   | loaded & has bots                  | KPI bar (real) + toolbar + **sorted, filtered card grid**                                |
| 5   | (within #4) filter/search yields 0 | grid area shows **"no bots match"** + clear action                                       |

### 6.2 Card sort order (the "trước sau") — **default: triage-first**

Cards are sorted by **bucket priority** (top-left = highest priority), so problems and in-progress work surface first, money-makers next, dormant last:

| Priority | Bucket              | Presentational states                 | Within-bucket sort                            |
| -------- | ------------------- | ------------------------------------- | --------------------------------------------- |
| 1        | **Needs attention** | `ERROR`, `BACKTEST_FAILED`            | `ERROR` before `BACKTEST_FAILED`, then name ↑ |
| 2        | **Working**         | `STARTING`, `STOPPING`, `BACKTESTING` | balance ↓, then name ↑                        |
| 3        | **Running**         | `LIVE`, then `DRY-RUN`                | balance ↓ (biggest capital first)             |
| 4        | **Idle**            | `PAUSED`                              | `createdAt` ↓ (newest first)                  |
| 5        | **New**             | `NEW`                                 | `createdAt` ↓                                 |

- **Final tiebreak:** `id` ↑ — guarantees a **stable** order (no card jitter across polls/refreshes).
- Sort is a **pure function** of current card data; React `key={id}` keeps DOM identity so a bot moving buckets (e.g. `STARTING → LIVE`) animates as a move, not a remount.
- **Search/filter** are applied **after** sort (filter the sorted list).

> **Open decision (D-1):** triage-first (above, recommended) vs **value-first** (Running bucket at top). Confirm on review — only the bucket ordering changes, the mechanism is identical.

### 6.3 Per-state display matrix

Ports the current `BotCard` rules into an explicit table (✓ show / — hide). `mode`-driven actions in the last columns.

| State               | Badge                       | Balance      | Open gauge | Meta (stake/TF) | Backtest strip | State hint                                    | Backtest btn                       | Start/Stop                 |
| ------------------- | --------------------------- | ------------ | ---------- | --------------- | -------------- | --------------------------------------------- | ---------------------------------- | -------------------------- |
| **LIVE**            | Live (green)                | ✓            | ✓          | ✓               | ✓ if exists    | —                                             | "Backtest"                         | **Stop**                   |
| **DRY-RUN**         | Dry-run (blue)              | ✓            | ✓          | ✓               | ✓ if exists    | —                                             | "Backtest"                         | **Stop**                   |
| **PAUSED**          | Paused (muted)              | — (`—`)      | ✓ (0/max)  | ✓               | ✓ if exists    | —                                             | "Backtest"                         | **Start**                  |
| **STARTING**        | Starting… (brand, pulse)    | —            | —          | ✓               | —              | —                                             | disabled                           | **disabled spinner**       |
| **STOPPING**        | Stopping… (muted, pulse)    | —            | —          | ✓               | —              | —                                             | disabled                           | **disabled spinner**       |
| **NEW**             | New (dashed brand)          | —            | ✓ (0/max)  | ✓               | —              | "No backtest yet — run one before going live" | **"Run first backtest"** (primary) | **Start**                  |
| **BACKTESTING**     | Backtesting (info, spinner) | ✓ if running | ✓          | ✓               | —              | "Backtesting…" + spinner                      | disabled                           | mode-driven (Stop if live) |
| **BACKTEST_FAILED** | Paused (muted)              | —            | ✓          | ✓               | —              | "Backtest failed — retry below"               | **"Retry backtest"**               | **Start**                  |
| **ERROR**           | ! Error (red)               | —            | —          | —               | —              | `error_message: {text}` (red)                 | "Backtest"                         | **Start**                  |

Notes:

- "Balance ✓ if running" for BACKTESTING: a LIVE/DRY bot mid-backtest keeps its live balance; a PAUSED bot mid-backtest shows `—`.
- All numbers mono + `tabular-nums`. Net P&L colored green/red.

### 6.4 Filter chip categories

Chips filter by **presentational state**, counts derived from the card list:

| Chip                | Includes states                       |
| ------------------- | ------------------------------------- |
| **All**             | everything                            |
| **Live**            | `LIVE`                                |
| **Dry-run**         | `DRY-RUN`                             |
| **Paused**          | `PAUSED`                              |
| **Working**         | `STARTING`, `STOPPING`, `BACKTESTING` |
| **Needs attention** | `ERROR`, `BACKTEST_FAILED`, `NEW`     |

A chip with count 0 is shown disabled/dimmed (not hidden) so the set is stable. Active filter + search compose (AND).

### 6.5 Badge color system

| State                    | Color token                                                    |
| ------------------------ | -------------------------------------------------------------- |
| LIVE                     | bullish (green)                                                |
| DRY-RUN                  | **info (blue)** — _changed from current brand-yellow; see D-2_ |
| PAUSED / BACKTEST_FAILED | muted gray                                                     |
| STARTING                 | brand yellow + pulse                                           |
| STOPPING                 | muted + pulse                                                  |
| NEW                      | dashed brand outline                                           |
| BACKTESTING              | info + spinner                                                 |
| ERROR                    | bearish (red)                                                  |

> **Open decision (D-2):** make DRY-RUN **blue** (proposed — frees yellow for brand/transitioning and reads as "simulated") vs **keep current brand-yellow**. Confirm on review.

---

## 7. Data provenance — what ships in v1

Honesty rule: **v1 renders only real backend data. No fabricated time-series / P&L.**

| Field / widget                                                                    | Source                                       | v1?        |
| --------------------------------------------------------------------------------- | -------------------------------------------- | ---------- |
| name, pair, timeframe, createdAt, mode/state, errorMsg                            | `bot/list` + `getConfig` (zipped)            | ✓ real     |
| balance, openTrades                                                               | `/performance` (running bots)                | ✓ real     |
| maxOpenTrades, stakeAmount                                                        | config                                       | ✓ real     |
| lastBacktest {winRate, trades, netAbs, status}                                    | `/backtest/history?limit=1` (top-level only) | ✓ real     |
| portfolio: capitalDeployed, active, total, idle, transitioning, error, openTrades | `computePortfolioStats`                      | ✓ real     |
| **per-card sparkline**                                                            | — (field exists, always `null`)              | ✗ deferred |
| **equity curve, 24h change %, total realized P&L, allocation donut**              | no BE endpoint                               | ✗ deferred |

Deferred widgets are **omitted** in v1 (not shown as empty/fake). They become a Phase-2 follow-up once BE exposes equity/candle history. Tracked as a BE follow-up, not a blocker.

---

## 8. Components & files

| File                                                  | Change                                                                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/DashboardPage.tsx`                         | Replace hero `<section>` with `<PortfolioBar>`; add filter-chip state + `<StatusFilterChips>`; apply sort (`sortCards`) then filter; widen container; re-tune skeleton/empty/error for new layout. |
| `src/features/bot-monitoring/BotCard.tsx`             | Rebuild to direction-D anatomy (header/balance/gauge/meta/divider/strip/actions). **Preserve** `mode`-driven `Actions` + `state` display rules per §6.3.                                           |
| `src/features/bot-monitoring/PortfolioBar.tsx`        | **New** — KPI bar (props: `PortfolioStats` + `loading`).                                                                                                                                           |
| `src/features/bot-monitoring/OpenTradesGauge.tsx`     | **New** — segmented pip gauge (`open`, `max`).                                                                                                                                                     |
| `src/features/bot-monitoring/StatusFilterChips.tsx`   | **New** — chips + counts + active state.                                                                                                                                                           |
| `src/features/bot-monitoring/bot-sort.ts`             | **New** — `sortCards(cards): BotCardData[]` per §6.2 (pure, stable).                                                                                                                               |
| `src/features/bot-monitoring/bot-filter.ts`           | **New** — category mapping (§6.4), `countByCategory`, `filterByCategory`.                                                                                                                          |
| `src/features/bot-monitoring/presentational-state.ts` | Unchanged.                                                                                                                                                                                         |
| `src/features/bot-monitoring/portfolio-stats.ts`      | Unchanged (already returns all KPI numbers).                                                                                                                                                       |
| _(no i18n)_                                           | This feature uses **literal English strings inline** (matches existing `DashboardPage` / `BotCard`); `src/i18n/en.ts` is **not** touched.                                                          |

Design tokens: reuse `src/styles/tokens.css` as-is. No new colors. Tailwind utility names verified against `tailwind.config.ts`: surface elevated is `bg-surface-elevated` (not `bg-elevated`); `info`, `bullish`, `bearish`, `brand`, `fg(-muted/-secondary)`, `border(-subtle/-strong)`, `input` are all valid. Tailwind is 3.4.17 (so `line-clamp-*` is built-in). The `React.ReactNode` type is available without importing React (UMD global from `@types/react`, as used across the codebase).

---

## 9. Testing strategy

- **`bot-sort.test.ts`** — unit: given a mixed bot list, assert exact ordering (buckets + tiebreaks + stability when two refreshes carry same data).
- **`bot-filter.test.ts`** — unit: category mapping + counts for each presentational state.
- **`BotCard.test.tsx`** — per-state render: balance/gauge/strip/hint/actions visibility matches §6.3 (one case per state); `mode`-driven Stop-vs-Start (incl. LIVE-while-BACKTESTING shows Stop).
- **`DashboardPage` (existing tests)** — keep green; add: filter chip click narrows grid + updates count; sort applied before filter.
- All via Vitest + Testing Library (existing setup). `pnpm typecheck && lint && test` before commit.

---

## 10. Open decisions (confirm on review)

- **D-1 — Card sort:** triage-first (recommended) vs value-first.
- **D-2 — DRY-RUN badge:** blue (proposed) vs keep brand-yellow.
- **D-3 — Filter chips:** ship the 6-chip filter (recommended, matches mockup) vs search-only (simpler).

Everything else follows the approved mockup `public/dashboard-v2-cards.html`.
