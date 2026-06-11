# Bot Details — Parameter Notes (Help Tooltips)

**Date:** 2026-06-11
**Status:** Design — pending review
**Owner:** Tri (FE)

---

## Problem

The bot details screen (`src/features/bot-monitoring/BotMonitoringPage.tsx`) surfaces a
lot of jargon-heavy parameters with no explanation: backtest metrics (Sharpe, Sortino,
Profit factor, Expectancy, Max drawdown), lifecycle fields (Desired status, Process, Last
heartbeat), and risk config (Leverage, Margin mode, Max open trades, Dry-run wallet). A
user who didn't build the bot — or didn't memorise the builder copy — has no way to learn
what a field means from this screen.

The builder forms already solve this: `FormField` renders a `?` (`HelpCircle`) icon next
to a label that opens a tooltip, with copy in `strings.helpText`. The detail screen reuses
none of that — its `KV` rows, KPI tiles and metric cells render bare labels.

## Goal

Add the same `?`-icon tooltips to the **non-obvious** parameters on the bot details
screen, reusing the established pattern so it looks and behaves identically to the builder.

**Non-goals:**

- Not annotating self-evident labels (Pair, Exchange, Timeframe, Side, Entry/Exit).
- Not changing any data, formatting, or layout of the panels.
- No new tooltip/UI library — reuse the existing Radix `Tooltip` + `HelpCircle`.

## Decisions (from brainstorming)

- **Scope:** jargon / metrics + risk-affecting config only. Skip obvious labels.
- **Mechanism:** help-icon tooltip (the existing `FormField` pattern), not always-visible
  inline hint text — keeps panels compact and matches the builder.

## Approach

The help-icon + tooltip markup is currently inlined inside `FormField`. To use it in three
other render sites without copy-pasting the Radix boilerplate, extract it once and thread a
single optional `hint` prop through the detail-screen label primitives.

### 1. New reusable unit: `InfoHint`

`src/components/ui/info-hint.tsx` — the icon-button + tooltip, lifted verbatim from
`FormField` (lines 52–72). Self-contained: owns its own `TooltipProvider`.

```tsx
export function InfoHint({
  text,
  side = 'top',
  label = 'More info',
}: {
  text: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  label?: string;
}) {
  /* TooltipProvider → Tooltip → Trigger(button + HelpCircle) → Content */
}
```

- Icon sizing/colour identical to today (`h-3.5 w-3.5`, `text-fg-muted hover:text-fg`,
  focus ring). Tooltip content `max-w-xs text-xs leading-snug`.
- `FormField` is refactored to render `<InfoHint text={help} />` in place of its inlined
  block — single source of truth, zero visual change. (Low-risk; covered by existing
  builder tests.)

**What it does:** shows an info icon that reveals explanatory copy on hover/focus.
**How you use it:** drop `<InfoHint text="..." />` next to any label.
**Depends on:** `@/components/ui/tooltip`, `lucide-react`.

### 2. Thread `hint` through the three label primitives

Each gains one optional prop; when set, render `<InfoHint>` next to the label. When unset,
output is byte-for-byte unchanged.

| Primitive   | File                          | Change                                                                                                         |
| ----------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `KV`        | `detail/panel-kit.tsx`        | add `hint?: ReactNode`; render `InfoHint` after the `k` span (wrap key + icon in a `flex items-center gap-1`). |
| `Kpi`       | `detail/DetailHero.tsx`       | add `hint?: ReactNode`; render `InfoHint` next to the KPI `label`.                                             |
| metric cell | `detail/PerformancePanel.tsx` | extend the `cells` tuple to carry an optional hint; render `InfoHint` next to the cell's label `div`.          |

### 3. Copy: `strings.helpText.monitoring`

New block in `src/i18n/en.ts` under `helpText`, alongside `botConfig` / `strategy`. Keep
each string ≲ 25 words (single-tooltip rule already documented at en.ts:250).

> **House-style note:** these are single-quoted strings, so any apostrophe inside the copy
> MUST be a curly `’` (U+2019), matching `helpText.botConfig.marginMode` at en.ts:266 —
> a straight `'` would terminate the string and break the build. The copy below already
> uses `’`.

Risk-config
fields that already have builder copy (`leverage`, `marginMode`, `maxOpenTrades`,
`stakeAmount`, `dryRunWallet`) **reuse** the existing `helpText.botConfig.*` strings rather
than duplicating — only genuinely-new keys are added here.

New keys (proposed copy):

```
monitoring: {
  // Status & process
  state:        'The bot’s live process state as last reported by the backend (running, stopped, error, …).',
  desiredStatus:'The state you asked for. The bot converges to this — a mismatch with State means it’s still transitioning.',
  process:      'Whether the backend Freqtrade process is actually up. "down" while State is running means the process died.',
  lastHeartbeat:'Time since the bot last reported in. Stale heartbeats suggest the process is stuck or dead.',
  // Mode / config not covered by builder copy
  mode:         'Dry-run trades on a virtual wallet (no real funds). Live places real orders on the exchange.',
  tradingMode:  'Spot trades the asset directly; Futures trades perpetual contracts with leverage.',
  // Backtest performance metrics
  netProfit:    'Total profit/loss across all backtest trades, in stake currency. Negative = the strategy lost money.',
  trades:       'Total number of trades the strategy opened and closed during the backtest window.',
  winRate:      'Share of backtest trades that closed in profit. High win rate alone doesn’t guarantee net profit.',
  profitFactor: 'Gross profit ÷ gross loss. Above 1 means winners outweigh losers; below 1 is a losing strategy.',
  sharpe:       'Risk-adjusted return — return per unit of total volatility. Higher is better; below 0 is poor.',
  sortino:      'Like Sharpe but only penalises downside volatility. Higher is better.',
  maxDrawdown:  'Largest peak-to-trough drop in equity during the backtest. Lower is safer.',
  tradesPerDay: 'Average number of trades opened per day over the backtest window.',
  // Hero KPIs
  openTrades:   'Positions the bot holds right now, against its max-open-trades cap.',
  winRateBt:    'Win rate from the selected backtest run — historical, not live performance.',
  netBt:        'Net profit from the selected backtest run — historical, not live performance.',
}
```

### Field → copy mapping

| Panel       | Field (label)   | Source string                     |
| ----------- | --------------- | --------------------------------- |
| Config      | Stake amount    | `botConfig.stakeAmount` (reuse)   |
| Config      | Max open trades | `botConfig.maxOpenTrades` (reuse) |
| Config      | Trading mode    | `monitoring.tradingMode`          |
| Config      | Margin mode     | `botConfig.marginMode` (reuse)    |
| Config      | Mode            | `monitoring.mode`                 |
| Config      | Leverage        | `botConfig.leverage` (reuse)      |
| Config      | Dry-run wallet  | `botConfig.dryRunWallet` (reuse)  |
| Status      | State           | `monitoring.state`                |
| Status      | Desired status  | `monitoring.desiredStatus`        |
| Status      | Process         | `monitoring.process`              |
| Status      | Last heartbeat  | `monitoring.lastHeartbeat`        |
| Performance | Net profit      | `monitoring.netProfit`            |
| Performance | Trades          | `monitoring.trades`               |
| Performance | Win rate        | `monitoring.winRate`              |
| Performance | Profit factor   | `monitoring.profitFactor`         |
| Performance | Sharpe          | `monitoring.sharpe`               |
| Performance | Sortino         | `monitoring.sortino`              |
| Performance | Max drawdown    | `monitoring.maxDrawdown`          |
| Performance | Trades/day      | `monitoring.tradesPerDay`         |
| Hero KPI    | Open trades     | `monitoring.openTrades`           |
| Hero KPI    | Win rate (bt)   | `monitoring.winRateBt`            |
| Hero KPI    | Net (bt)        | `monitoring.netBt`                |

Config-panel wiring: `ConfigPanel` builds rows via a `push` helper. Add an optional
`hint` to each row (looked up by a small label→string map) so `KV` receives it.

`Pill`s (Long/Short, Wins/Losses, Avg stake, Volume, Expectancy, vs Market) are **not**
annotated — they stay as compact summary chips and the pill layout is left untouched. Only
the 8 metric grid cells carry hints (resolved below).

## Files touched

- **New:** `src/components/ui/info-hint.tsx`
- **New:** `src/components/ui/info-hint.test.tsx`
- `src/components/ui/form-field.tsx` (refactor to use `InfoHint`)
- `src/features/bot-monitoring/detail/panel-kit.tsx` (`KV` gains `hint`)
- `src/features/bot-monitoring/detail/DetailHero.tsx` (`Kpi` gains `hint` + wire 3 KPIs)
- `src/features/bot-monitoring/detail/ConfigPanel.tsx` (per-row hint lookup)
- `src/features/bot-monitoring/detail/StatusPanel.tsx` (4 `KV` hints)
- `src/features/bot-monitoring/detail/PerformancePanel.tsx` (cell hints)
- `src/i18n/en.ts` (`helpText.monitoring`)

## Testing

- **Unit (new):** `info-hint.test.tsx` — renders the trigger button with the right
  `aria-label`; tooltip content is wired (presence of the trigger + accessible name).
- **Regression:** existing `FormField` / builder tests must stay green after the refactor
  (proves the extraction is behaviour-preserving).
- **Manual (Tri):** open a bot's detail screen, hover each annotated field, confirm copy
  reads correctly and tooltips don't clip at panel edges. No headless screenshotting.

## Error handling / edge cases

- Hints are static copy — no runtime failure surface. If a `hint` is `undefined`, the
  primitive renders exactly as today (icon omitted).
- Tooltip max-width already constrains long copy; the ≲25-word rule keeps it single-popover.

## Resolved during self-review

1. **Expectancy / Pills** — left un-annotated. Pills are summary chips; annotating them
   would force a layout change for marginal value. Removed the unused `expectancy` copy key.
2. **Win rate / Net profit cells** — annotated along with the rest. All 8 Performance grid
   cells get a hint so the panel reads consistently (and the notes clarify these are
   _backtest_ figures, not live).
3. **Apostrophe escaping** — copy switched to curly `’` to match the single-quote house
   style at en.ts:266; a straight `'` would break the string literal.

No open questions remain.
