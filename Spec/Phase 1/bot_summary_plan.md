# BOT SUMMARY — Phase 1 MVP

> Plan: thêm 1 widget tóm tắt "**bot này sẽ làm gì**" bằng tiếng Anh tự
> nhiên, derive **chính xác** từ BuilderState đang có. User không phải đọc
> JSON hay đoán theo card preview — họ thấy thẳng:
>
> _"Bot này trade BTC/USDC perpetual futures, 5-minute candles. Vào lệnh
>  Long khi RSI(14) dưới 30 (oversold). Chốt lời 5% đóng nửa vị thế, chốt
>  10% đóng thêm 25%. Cắt lỗ ở −3%."_
>
> **Status**: Plan, chưa code. Confirm 4 decision ở §10 trước khi bắt đầu.
>
> **Prerequisite**: ✅ 2-phase UI redesign + Bot templates (`feat/2-phase-ui`).
> Summary derive từ existing BuilderState shape — không đụng data layer.

---

## 1 · Vấn đề / motivation

User pain point hiện tại:
- Setup bot xong xuôi vẫn không chắc nó **thực sự sẽ làm gì** khi chạy.
- Card preview chỉ show chips ("Long • Market • TP/SL"), không giải thích logic.
- JSON tab quá technical cho beginner.
- Cypheus chat narration tan đi sau khi build xong — không reread được.

Cần một **derived view** chuyển state → tiếng Anh tự nhiên:
- Đọc 30 giây hiểu hết bot.
- Update real-time khi user chỉnh field.
- Là source-of-truth ngôn ngữ — KHÔNG editable từ đây (tránh confusion 2 cách edit).

### So với existing UI

| Component | Mục đích |
|---|---|
| StepCardSummary (chips) | Quick visual: status + key tokens |
| JsonLiveView | Power user reference |
| CypheusChat narration | One-time storytelling (template animation) |
| **BotSummary (mới)** | Đọc-hiểu permanent text — bridge giữa visual chips và raw JSON |

---

## 2 · Acceptance criteria

| # | Yêu cầu |
|---|---|
| G1 | Render 1 card "What this bot does" trên canvas, dưới Phase 2 + Add Strategy button |
| G2 | Section structure: Market / Risk / Entry / Action / Exit / Notifications |
| G3 | Mỗi section update **realtime** khi state đổi (zustand selector + memo) |
| G4 | Khi bot chưa configured → render gracefully ("Setup not complete yet — fill the phases above") |
| G5 | Plain English translation cho condition tree (RSI<30, MACD>0, candle.close>MA-50, AND/OR groups, unary ops với percentage) |
| G6 | Plain English cho close method: tp_sl multi-tier / roi steps / indicator exit / manual |
| G7 | Tone-coded inline emphasis: bullish (long, TP) green / bearish (SL, short) red / neutral grey — match card_yellow_stages exception cho trading semantics |
| G8 | Read-only widget — KHÔNG có edit button bên trong |
| G9 | Reduce-motion friendly (no animations beyond fade-in) |
| G10 | i18n-ready: all generated text qua helpers, strings tập trung |
| G11 | Tests: unit cover 8 built-in templates → expected summary text matches snapshot |

---

## 3 · UX placement (CONFIRMED — HYBRID)

Quyết định: **HYBRID** với 4-layer progressive disclosure (xem §13).

Card always-visible trên canvas, nhưng nội dung adapt theo trạng thái:
- L1 pristine → ẩn hoàn toàn (đỡ noise)
- L2 partial → render gracefully với "—" placeholders
- L3 simple → all sections expanded
- L4 complex (≥3 conditions hoặc multi-tier exit) → Entry / Exit auto-collapse với "▼ Show details"
- Plus: gap warning footer khi translator gặp shape không cover (§13)

### (Original) Option A: Canvas card dưới Strategy
```
[Phase 1: Bot Basics]
[Phase 2: Strategy]
[+ Add Strategy]
─────────────────
[📖 What this bot does]   ← always visible, progressive content
  Market: ...
  Risk: ...
  ▼ Show entry / exit details (collapsed sections)
```
- ✅ Discoverable, không tốn click
- ✅ Permanent + scannable — user re-read khi cần
- ✅ Update live khi user chỉnh field
- ❌ Tốn vertical space trên canvas

### Option B: Dedicated modal / dialog
- Click "Explain bot" button → mở modal full-screen với markdown
- ❌ Khó discover, tốn click

### Option C: Inline expand trong Strategy card
- Click "Show details" → expand StrategyCard hiện thị summary
- ❌ Mixes edit + review UX

### Option D: Replace empty state khi configured
- Empty state khi count=0; Summary khi count=2
- ❌ Lost when partially configured

### Option E: Ở Export dialog header (pre-flight check)
- ❌ Chỉ thấy lúc Export, beginner không tới

→ **Đề xuất: A**. Permanent canvas card, progressive content.

---

## 4 · Section structure

### 4.1. Market
**Source**: `botConfig.{exchange, pair, marketType, timeframe}`

**Examples**:
- "BTC/USDC perpetual futures on Binance, 5-minute candles."
- "ETH/USDC spot on Binance, 1-hour candles."
- "Pair not set yet" (when empty)

### 4.2. Risk
**Source**: `botConfig.{tradingMode, stakeAmount, stakeCurrency, leverage, marginMode, dryRunWallet, maxOpenTrades}`

**Examples**:
- "Dry-run mode with a $1,000 simulated wallet. $100 stake per trade. Up to 10 concurrent positions. Leverage 20× cross-margin."
- "Live trading. $250 stake per trade. Max 3 positions. No leverage (1×)."
- "Live trading on spot — no leverage, no liquidation risk."

Tone: leverage > 10× → soft warning. Live mode → bearish red emphasis.

### 4.3. Entry
**Source**: `strategy.{candlestick, indicators, entryConditions}` + `directionForm.direction`

**Examples**:
- "Buys long when RSI(14) drops below 30 (oversold)."
- "Buys long when **all** of these are true: RSI(14) is above 60, AND price closes above the 50-period moving average."
- "Buys long when **any** of these is true: candle.close crosses above BB upper band, OR MACD line crosses above signal line."
- "Sells short when RSI(14) goes above 70 (overbought)."
- "No entry conditions defined yet — bot won't enter trades."

### 4.4. Action
**Source**: `directionForm.{direction, orderType, limitOffsetPct, slippageTolerance}`

**Examples**:
- "Goes Long with Market orders (fills immediately at best ask)."
- "Goes Short with Limit orders, placed 0.05% below market. Slippage tolerance 0.5%."

### 4.5. Exit
**Source**: `closeMethod.{type, tpEnabled, tpLevels, slEnabled, slValue, trailingEnabled, trailingPositive, trailingOffset, roiSteps, exitConditions}`

**Examples**:
- "Take profit: closes 50% of position at +5%, another 25% at +10%. Stop loss at −3%."
- "Time-based ROI exit: 0.5% target immediately, drops to 0.3% after 30 min, 0.1% after 1 hour, break-even after 2 hours."
- "Exits when MACD line crosses below signal line OR RSI(14) goes above 70."
- "Manual exit only — bot keeps trades open until you close them."
- "Trailing stop active: kicks in after +1% profit, follows 1.5% behind highest price."

### 4.6. Notifications
**Source**: derived from default Telegram in serializer (currently always disabled until user form drives it)

**Examples**:
- "Telegram notifications disabled."
- "Telegram enabled — notifies on entry, exit, and stop loss." (future)

→ MVP: 1 line, "Telegram notifications disabled." Always.

---

## 5 · Plain-English translation rules

### 5.1. Condition operators

| op | When right_type=number | When right_type=indicator |
|---|---|---|
| `<` | "is below {N}" | "is below {indicator-id}" |
| `>` | "is above {N}" | "is above {indicator-id}" |
| `<=` | "is at or below {N}" | "is at or below {indicator-id}" |
| `>=` | "is at or above {N}" | "is at or above {indicator-id}" |
| `==` | "equals {N}" | "equals {indicator-id}" |
| `crosses_above` / `crossed_above` | "crosses above {N}" | "crosses above {indicator-id}" |
| `crosses_below` / `crossed_below` | "crosses below {N}" | "crosses below {indicator-id}" |
| `is_going_up` (unary, +percentage) | "is rising at least {percentage}%" | — |
| `is_going_down` (unary, +percentage) | "is falling at least {percentage}%" | — |

### 5.2. Indicator ID → friendly name

| FE id | Friendly |
|---|---|
| `RSI-14` | "RSI(14)" |
| `MA-50` | "the 50-period moving average" |
| `MA-200` | "the 200-period moving average" |
| `MACD-12-26-9` | "MACD line" |
| `BB-20` | "Bollinger Bands" |
| `ATR-14` | "ATR(14)" |
| `Stoch-14-3-3` | "Stochastic %K" |
| `candle.close` | "the candle close" |
| `candle.volume` | "candle volume" |
| `candle.open` / `high` / `low` | "candle open / high / low" |

### 5.3. Multi-condition grouping

```
group.logic.type === 'AND' && conditions.length === 1
  → "Buys long when {single condition translated}."

group.logic.type === 'AND' && conditions.length > 1
  → "Buys long when **all** of these are true: {C1}, AND {C2}, AND {C3}."

group.logic.type === 'OR' && conditions.length > 1
  → "Buys long when **any** of these is true: {C1}, OR {C2}."

(Note: current FE BE convention has `operator` field on conditions[1..]
indicating the join op. We respect that — treats group-level type as a
default but condition.operator overrides.)
```

### 5.4. Tone tagging

Inline `<span>` wrappers theo `card_yellow_stages_plan.md` exception:
- "long" / "buys" / "TP +5%" → `text-bullish` (green)
- "short" / "sells" / "SL −3%" → `text-bearish` (red)
- "Live trading" → `text-bearish font-medium` (warning)
- All else → default fg

→ KHÔNG dùng yellow ở đây vì đây là **trading semantics**, không phải
status. Document inline trong code.

---

## 6 · Implementation

### 6.1. Module structure

```
src/features/bot-summary/
├── types.ts                       # SummaryBlock, SummaryInline, types
├── summarize.ts                   # summarizeBot(state) → SummaryBlock[]
├── summarize.test.ts              # unit tests + snapshot tests on 8 templates
├── translators/
│   ├── market.ts                  # botConfig → market line
│   ├── risk.ts                    # botConfig → risk lines
│   ├── condition.ts               # ConditionGroup → english
│   ├── indicator-name.ts          # FE id → friendly + INDICATOR_FRIENDLY map
│   ├── close-method.ts            # closeMethod → exit lines
│   └── direction.ts               # directionForm → action lines
└── BotSummaryCard.tsx             # React widget rendered by BotBuilderCanvas
```

### 6.2. Type model

```ts
// types.ts
export type SummaryTone = 'default' | 'bullish' | 'bearish' | 'warning';

/** A piece of inline text with optional tone for color emphasis. */
export interface SummaryInline {
  text: string;
  tone?: SummaryTone;
}

/** A line is a sequence of inlines (most have just one). React renders
 * each inline as a span with the matching color class. */
export type SummaryLine = SummaryInline[];

export interface SummaryBlock {
  /** Stable id used as React key + i18n anchor. */
  id: 'market' | 'risk' | 'entry' | 'action' | 'exit' | 'notifications';
  /** lucide-react icon name (kept stringly — resolved to component in card). */
  icon: 'MapPin' | 'Shield' | 'TrendingUp' | 'Target' | 'LogOut' | 'Bell';
  title: string;
  /** Empty means "block doesn't apply yet" — card hides it. */
  lines: SummaryLine[];
  /** Soft warning surfaced on the block header (e.g. high leverage). */
  warning?: string;
}
```

### 6.3. Public API

```ts
export function summarizeBot(state: BuilderState): SummaryBlock[];
```

Pure function. No side effects. Returns 1-6 blocks (skips blocks with
no useful data). Memoise in the React component.

### 6.4. React component

```tsx
// BotSummaryCard.tsx
export function BotSummaryCard() {
  const state = useBuilderStore();
  const blocks = useMemo(() => summarizeBot(state), [state]);

  // If the user hasn't started anything, show a brief stub instead of
  // an empty card — feedback "this is where the explainer will be".
  if (blocks.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle ...">
        <p>Setup not complete yet — finish Phase 1 + Phase 2 above to see
        what this bot will do.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-brand/15 bg-surface ...">
      <header>
        <BookOpenIcon />
        <h3>What this bot does</h3>
      </header>
      <div className="space-y-3">
        {blocks.map(block => (
          <SummarySection key={block.id} block={block} />
        ))}
      </div>
    </section>
  );
}
```

### 6.5. Wire into canvas

`BotBuilderCanvas.tsx` — render `<BotSummaryCard />` after `<AddStrategyButton />`.

```tsx
<ol>
  <BotBasicsCard />
  <PhaseConnector />
  <StrategyCard />
  <AddStrategyButton />
</ol>
<BotSummaryCard />   {/* new */}
```

---

## 7 · Edge cases

| Tình huống | Behavior |
|---|---|
| Pair empty | Market block: "Pair not set yet." Other blocks still render. |
| Indicators empty + candlestick empty | Entry block: "No indicators or candle channels — bot won't generate signals." |
| Conditions empty | Entry block: "No entry conditions defined." |
| Mixed AND/OR ops trong 1 group | Respect each `condition.operator`; group with parentheses for clarity in 3+ rules. |
| `is_going_up` without percentage | Default to "is rising" (no percentage). |
| `right_indicator` complex format (BBANDS upper band - 2.0, 2.0, 14) | Fallback: print the id as-is. Plan §10 Q to BE on canonical formatter. |
| Close method 'manual' | "Manual exit only — bot keeps trades open until you close them." |
| Close method 'tp_sl' but tpEnabled=false + slEnabled=false | "No automated exits configured." Soft warning. |
| Trailing stop enabled but trailingPositive=0 | Skip the trailing line (defensive). |
| ROI roi_steps unsorted | Validator catches; summary still sorts before rendering. |
| Live mode + leverage > 10× | Risk block warning: "High leverage on live capital — monitor closely." |
| Cypheus pinned mode | Summary card stays mounted; updates live as Cypheus fills fields. |
| Reduce-motion | Card render normally — no fade animations to skip. |

---

## 8 · Files affected

### New
- `src/features/bot-summary/types.ts`
- `src/features/bot-summary/summarize.ts`
- `src/features/bot-summary/summarize.test.ts`
- `src/features/bot-summary/translators/{market,risk,condition,indicator-name,close-method,direction}.ts`
- `src/features/bot-summary/BotSummaryCard.tsx`

### Modified
- `src/features/bot-builder/BotBuilderCanvas.tsx` — mount card
- `src/i18n/en.ts` — `strings.botSummary.*` (block titles, fallback messages, warnings)

### Unchanged
- All store / validator / serializer / schemas / templates

---

## 9 · PR breakdown

### PR-S1 · Translator core (foundation, no UI)
- types.ts + translators/ + summarize.ts
- summarize.test.ts với 8 built-in templates → snapshot tests
- **Effort**: 4-5h. Translation rules + edge cases take time.

### PR-S2 · Card UI + canvas mount
- BotSummaryCard.tsx
- Wire into BotBuilderCanvas
- i18n strings
- Visual smoke
- **Effort**: 2-3h.

### PR-S3 (optional) · Polish
- Smooth fade-in when block content changes
- Collapsible "show full reasoning" for power users
- Cypheus "explain this bot" button → narrate summary in chat
- **Effort**: 2h.

**Tổng**: ~6-10h, ~1 ngày focused.

---

## 10 · Decisions cần USER confirm

### D1. UX placement: Option A (canvas card always visible)?
- **Đề xuất: A**. Đã argue ở §3.

### D2. Khi state pristine (all pending), card render hay ẩn?
- **Đề xuất: render với stub message** ("Setup not complete yet — …"). User biết vị trí widget này, tâm lý "đang chờ tôi setup".
- Alternative: ẩn hoàn toàn cho đến khi config-count > 0. Đỡ visual clutter.

### D3. Tone color cho "Live trading"?
- **Đề xuất: bearish red** (warning). Beginner sẽ thấy đỏ → biết đây là chế độ thật, đang xài tiền thật.
- Alternative: just bold without color (less alarming).

### D4. High-leverage warning threshold?
- **Đề xuất: > 10×** (hiển thị warning chip). 1-10× considered "normal", 11× trở lên có cảnh báo "monitor closely".
- Hoặc threshold cao hơn (>20)? Hoặc theshold tùy thuộc tradingMode (live cảnh báo sớm hơn dry-run)?

### Optional D5. Test snapshot strategy?
- **Đề xuất: snapshot test với 8 built-in templates** (PR-S1) — assert summary text khớp expected. Khi sau này thêm template, chỉ cần update snapshot. Catches regressions trong translator nếu template ship-pass-CI nhưng summary vô nghĩa.

---

## 11 · Out of scope

- **Editable summary** (click-to-edit từ summary back vào form): không. Read-only.
- **Multi-language i18n** (Vietnamese, etc.): MVP English only. i18n-ready architecture nhưng chỉ ship en.ts.
- **Backtest preview**: "If RSI<30 in last 30 days, would have triggered N times" — defer Phase 2.
- **Risk score / strategy classification** (e.g. "This is a mean-reversion strategy"): defer.
- **Cypheus voice mode** ("explain this bot to me out loud"): defer Phase 3 (text-to-speech).
- **Comparison view** ("how does this differ from template?"): defer.
- **Export summary as PDF/markdown**: defer.
- **Inline editable token highlighting** (click "RSI-14" to jump to the indicator config): defer Phase 2.

---

## 12 · Risk + mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| Translator covers 90% but fails on unusual config → user reads "RSI-14 < null" | Medium | Defensive fallbacks in every translator. Print raw token if no rule matches. Validator already catches malformed conditions before they reach summary. |
| Summary text re-renders aggressively on every keystroke | Low | useMemo on full state ref; translators are pure string ops, ~1ms per recompute. |
| `right_indicator` format from BE is "BBANDS (Upper Band) - 2.0, 2.0, 14" not `BB-20` | Medium | Indicator-name translator has an alias map; fallback prints raw if not matched. Plan §10 Q to BE on canonical formatter (open from Step 3 already). |
| Long summary blocks user above-fold canvas | Low | Section collapse pattern — first 2 blocks open, rest collapse. Or fixed max height with overflow scroll. |
| Localised number formatting (1,000 vs 1.000) | Low | MVP uses `n.toLocaleString('en-US')`. i18n future. |
| Card dilutes the "what to do next" focus when user is mid-build | Low | Render small / muted while pending; emphasise (border-brand) only when fully configured. |

---

## 13 · Architecture: rule-based + gap warning system

### 13.1. Why rule-based, not AI

Decided 2026-04-30 after discussion:

| Aspect | Rule-based ✅ | AI |
|---|---|---|
| Accuracy | 100% known shapes | 90-95%, hallucination risk on financial data |
| Latency | <1ms sync | 500ms-3s network |
| Cost | $0 | $0.001-0.01 × N user × M edits |
| Privacy | Local only | State sent to external API |
| Testability | Snapshot tests deterministic | Hard to verify rigorously |
| Realtime update | Trivial | Roundtrip per keystroke = bad UX |

→ Data shape is **bounded** (6 indicators × 9 ops × 4 close methods ≈ hundreds of permutations). Rule-based handles ~98% deterministically. AI is the wrong tool for financial-precision text.

### 13.2. Composable translator pattern

```
src/features/bot-summary/
├── types.ts                         # SummaryBlock, SummaryLine, SummaryInline, TranslationGap
├── summarize.ts                     # orchestrator: pure function
├── translators/
│   ├── indicator-name.ts            # FE id → friendly: 'RSI-14' → 'RSI(14)'
│   ├── condition.ts                 # ConditionGroup → SummaryLine[] (recursive)
│   ├── market.ts                    # botConfig → market line
│   ├── risk.ts                      # botConfig → risk lines + warning
│   ├── direction.ts                 # directionForm → action line
│   └── close-method.ts              # closeMethod → exit lines + warning
└── __tests__/
    ├── translators/
    │   └── condition.test.ts        # ~30 op×right_type combos
    ├── snapshots/                   # auto-managed by vitest
    └── summarize.test.ts            # 8-template snapshots + edge cases
```

Each translator: pure function, takes a slice of state + a shared `gaps[]` accumulator. Pushes to `gaps` whenever a shape doesn't match a rule. Caller decides what to do with gaps.

### 13.3. TS exhaustive switch — compile-time safety

Operators / right_types / close-method types are all union types. Translators use `switch` with `default: never` so adding a new operator (or removing one) breaks the build:

```ts
function translateOp(op: ConditionOp): string {
  switch (op) {
    case '<': return 'is below';
    case '>': return 'is above';
    // ... all 11 ops
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      return op; // fallback safety
    }
  }
}
```

→ When BE adds a new operator, validator + serializer + translator all surface as compile errors in the same PR.

### 13.4. Gap warning system

```ts
interface TranslationGap {
  section: SummaryBlockId;       // which block the gap belongs to
  field: string;                 // raw field name
  rawValue: string;              // raw value the translator couldn't decode
  reason: string;                // human-readable why
}

interface SummarizeResult {
  blocks: SummaryBlock[];
  gaps: TranslationGap[];
}
```

When translator encounters unknown shape (e.g. `right_indicator: "BBANDS (Upper Band) - 2.0, 2.0, 14"`):
1. Push `{ section: 'entry', field: 'right_indicator', rawValue: '...', reason: 'Unknown indicator output format' }`
2. Render the raw token in-place with `tone: 'warning'` so user sees something
3. Component aggregates gaps and renders footer:
   ```
   ⚠️ Couldn't fully translate (1 field):
     • Entry condition references "BBANDS..." (unknown indicator format)
   See JSON tab for full configuration.
   ```

→ User KNOWS what's missing. No silent guessing, no misleading prose.

### 13.5. Coverage estimate

| Field | Coverage | Strategy |
|---|---|---|
| 6 indicators × 9 ops × 3 right_types | 100% | exhaustive rules |
| AND/OR groups (flat, current FE limit) | 100% | recursive translator |
| All 4 close methods + sub-fields | 100% | dispatch on `type` |
| Trailing stop, ROI steps, partial TP | 100% | inline rules |
| Direction + order + limit offset | 100% | trivial |
| Market + risk + telegram | 100% | string substitution |
| Future indicator (post-MVP) | 0% → fallback + gap | print raw + warning |
| BE `right_indicator` complex format | fallback + gap | print raw + warning |
| Custom indicator items (future) | 0% → fallback + gap | print raw + warning |

**~98% of MVP feature set deterministic. Remaining 2% surface as explicit gaps.**

### 13.6. Future: opt-in AI assist (Phase 2+)

If user wants more conversational tone / strategy classification / risk advice:
- Add a single **"AI Explain"** button to summary card
- On click: serialize current state → call Claude API → render response in chat with disclaimer "AI-generated, may have errors"
- Base summary stays rule-based (always-on, accurate)
- AI is purely opt-in, value-add, never load-bearing

→ Defer to Phase 2 after MVP ships.

---

## 14 · Cross-link với plan khác

- **2-phase UI redesign** (`two_phase_ui_plan.md`): ✅ merged. Summary card mounts dưới Phase 2.
- **Bot templates** (`bot_templates_plan.md`): ✅ merged. Summary works seamlessly cho cả manual + template-applied bots. Snapshot tests cho 8 built-in templates đảm bảo translator không break khi template thay đổi.
- **Card yellow stages** (`card_yellow_stages_plan.md`): exception explicit — summary KHÔNG dùng yellow palette cho trading semantics (long=bullish-green, short=bearish-red, live=bearish-warning). Đây là content tone, không phải status surface.
- **API spec integration** (`Data/IMPLEMENTATION_PLAN.md` Step 3): independent. Summary derive từ BuilderState, không qua serializer hay schema — pure UI side.
- **Drawer sequential progression**: independent.

---

## 14 · Sau khi confirm

Tôi sẽ:
1. **Mở branch** `feat/bot-summary` từ `feat/2-phase-ui` (đã có templates merged).
2. **PR-S1 đầu tiên**: translators + summarize + tests. Risk thấp nhất, core logic. KHÔNG UI.
3. **PR-S2 thứ hai**: card UI + canvas mount + i18n. Visual smoke trên 8 templates.
4. (PR-S3 polish — tùy nhu cầu, không bắt buộc).

---

*End of plan.*

> **Action item**: bạn confirm D1–D4 (+ optional D5) ở §10. Sau khi confirm, tôi mở branch + bắt đầu PR-S1 (~4-5h, ship được trong session sau).
