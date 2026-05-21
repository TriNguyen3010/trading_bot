# Phase 2 · Bot Monitoring Page — Design Spec

> **Status**: Design (2026-05-05)
> **Branch**: `feat/bot-monitoring` (off from `main`)
> **Audience**: internal demo cho sếp first; hardened to production sau
> **Mockup ref**: `.superpowers/brainstorm/29556-1777968579/content/mockup-final.html` (active state) + `empty-state.html` (Day 1)

---

## 1 · Context & Goal

Strategy Builder hiện chỉ cover phần **setup** bot. Sau khi user Deploy, không có nơi
nào theo dõi bot đang chạy thế nào. Phase 2 fill khoảng trống đó.

User flow:
```
Builder (Deploy)  →  /bots/:id (Monitoring detail)  ←  /bots (List, mở từ nav)
```

**Constraint chủ đạo**: Demo cho sếp trong 1–2 sprint. Mọi thứ chưa có BE → mock ở FE
với service interface match shape thật của BE → swap 1-line khi BE sẵn sàng.

**Success criteria cho demo**:
- Sếp mở `/bots/:id`, thấy 1 page sống động với 9 sections, không có chỗ nào trông broken
- Hyperliquid market data là real (bubble chart, live spot feed, order book L2)
- Bot data deterministic mock — không random mỗi reload, sếp xem 2 lần thấy giống
- Empty state (bot vừa deploy) **không** trông trống; vẫn alive nhờ HL data + Cypheus tip

---

## 2 · Decisions chốt (từ brainstorm 2026-05-05)

| Topic | Decision |
|---|---|
| Routing | `/bots` (list) → `/bots/:id` (detail). Detail là focus của v1; list là entry tối giản. |
| MUST sections trên detail | **10**: **CypheusRail** · Identity · Hero+WinStreak · ActivityHeatmap · EquityCurve · LiveSpotFeed · ExecutionPipeline · RecentFills · OrderBookL2 · GainersLosersBubble |
| Layout | v3 — **3-column shell**: Cypheus rail trái (240px collapsible · reuse Builder's pattern) · Main center 1fr · Bubble sidebar phải 280px. Trong main: Hero zone trên + Heatmap + grid (PnLCurve → OrderBookL2 → LiveSpotFeed → Pipeline) + Recent Fills bottom. OrderBook + LiveSpotFeed group lại vì cùng market data của bot's pair. |
| Cypheus role | **Persistent narrator** — reuse từ `src/features/cypheus/`. Monitoring page drive Cypheus với event-based script (entry/exit/streak/anomaly). Empty state Day 0–1 = special tip card variant. |
| Aesthetic | "Calmer Cypheus" overall + hero zone allowed bolder (Press Start 2P pixel font, đỏ-glow) |
| Bubble scope | **Option B**: bubble chỉ render top 15 by magnitude/volume; footer stats (Winners/Losers/Best/Worst) reflect ALL ~100 HL pairs |
| Mock data | Bot perf + execution pipeline = mock FE; HL market data = **real public API** |
| Branch | `feat/bot-monitoring` riêng, **không** đụng `feat/2-phase-ui` |
| Empty state | 3 phases: just-deployed (<24h hoặc 0 trade) · collecting (<14d) · mature (≥14d) |

---

## 3 · Architecture

### 3.1 Routes

Extend `src/routes.tsx` (hiện chỉ có `/builder`):

```ts
{ path: '/bots',     element: <BotsListPage /> },
{ path: '/bots/:id', element: <BotMonitoringPage /> },
```

Sau Deploy trong builder → `navigate('/bots/${botId}')`.

### 3.2 File structure — single-file approach (demo-first)

**Decision**: gom toàn bộ 10 sections (9 + CypheusRail wrapper) vào **1 page file duy nhất** cho v1 demo. Không split component files. Lý do:

- Mục đích chính = demo cho sếp, không phải production code reuse
- Iteration nhanh hơn — đổi visual không phải nhảy giữa 10+ file
- Tránh premature abstraction — chưa biết section nào cần reuse
- Refactor split sau khi sếp approve + biết section nào dùng lại

```
src/features/bot-monitoring/
├── BotMonitoringPage.tsx              # /bots/:id — 10 sections inline (Cypheus rail wraps via reuse)
├── BotsListPage.tsx                   # /bots — minimal list (M5)
├── hyperliquid.service.ts             # real HL API
├── mockBotData.ts                     # seeded RNG mock fills/equity/daily/cycles
├── cypheusEvents.ts                   # event → message script cho monitoring narrative
├── types.ts                           # shared types (Fill, BotMeta, ...)
└── __tests__/
    ├── mockBotData.test.ts            # test seeded RNG determinism
    └── cypheusEvents.test.ts          # event mapping logic

REUSE (không tạo mới):
src/features/cypheus/                  # DÙNG NGUYÊN — Dock, store, typewriter, avatar
src/features/layout-prefs/             # DÙNG NGUYÊN — leftPanelCollapsed persist
```

**Inside `BotMonitoringPage.tsx`** (~700–1000 lines OK cho demo):

```tsx
import { CypheusDock } from '@/features/cypheus/components/CypheusDock';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/...';
import { generateEventNarrations } from './cypheusEvents';

// hooks inline
function useBotPerformance(id) { ... }
function useHyperliquidMarkets() { ... }
function useHyperliquidCandles(pair) { ... }
function useHyperliquidOrderBook(pair) { ... }
function useBotMaturity(deployedAt, totalTrades) { ... }
function useCypheusMonitoringNarrative(fills, snapshot, phase) {
  // watches data changes → push messages to useCypheusStore
  // events: just-deployed, position-opened, tp-hit, sl-hit, streak-milestone, anomaly
}

// inline section sub-components
function IdentityBar({ bot }) { ... }
function HeroPnL({ snapshot, phase }) { ... }
function WinStreakGauge({ streak, phase }) { ... }
function ActivityHeatmap({ dailyPnL, phase }) { ... }
function EquityCurve({ data, phase }) { ... }
function OrderBookL2({ book }) { ... }
function LiveSpotFeed({ candles, fills, condition }) { ... }
function ExecutionPipeline({ cycle, phase }) { ... }
function RecentFills({ fills, phase }) { ... }
function GainersLosersBubble({ markets, timeframe }) { ... }
function EmptyStateCard({ icon, title, body }) { ... }

// main page — 3-column shell với Cypheus rail
export function BotMonitoringPage() {
  const collapsed = useLayoutPrefsStore(s => s.leftPanelCollapsed);
  // ... orchestrate, drive Cypheus narrative
  return (
    <div className="grid grid-cols-[auto_1fr_280px]">
      <CypheusDock collapsed={collapsed} mode="monitoring" />
      <main>{/* identity, hero, heatmap, charts grid, fills */}</main>
      <aside>{/* GainersLosersBubble */}</aside>
    </div>
  );
}
```

→ Khi demo OK, refactor split: mỗi `function FooSection(...)` extract sang
`components/FooSection.tsx` thuần cơ học. Không thay đổi logic, không reorg.

**File limits** (sanity check):
- BotMonitoringPage.tsx: ~600–900 lines. Nếu vượt 1000 → consider split.
- mockBotData.ts: <300 lines (chủ yếu là generator + fixtures).

### 3.3 Data flow

```
BotMonitoringPage.tsx (single file, all hooks + sections inline)
  ├── useBotPerformance(botId)     → mockBotData (will swap to real BE service later)
  ├── useHyperliquidMarkets()      → hyperliquid.service (real, cached 5–10s)
  ├── useHyperliquidCandles(pair)  → hyperliquid.service (real, cached 30s)
  ├── useHyperliquidOrderBook(pair)→ hyperliquid.service (real, poll 1s)
  └── useBotMaturity(deployedAt, totalTrades)  → 'just-deployed' | 'collecting' | 'mature'
       ↓
  Inline section sub-components nhận props { ...data, phase } và render accordingly
```

### 3.4 Service interfaces

```ts
// mockBotData.ts — exports cùng API surface cho real BE swap sau
export interface BotMonitoringApi {
  getBotMeta(id: string): Promise<BotMeta>;
  getPerformanceSnapshot(id: string): Promise<PerformanceSnapshot>;
  getEquityCurve(id: string, range: TimeRange): Promise<EquityPoint[]>;
  getRecentFills(id: string, limit?: number): Promise<Fill[]>;
  getDailyPnL(id: string, days: number): Promise<DailyPnL[]>;
  getExecutionCycle(id: string): Promise<ExecutionCycle>;     // mock-only initially
}

export const botApi: BotMonitoringApi = { /* mock impl, seeded RNG */ };

// hyperliquid.service.ts
export interface HyperliquidApi {
  getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs>;
  getCandleSnapshot(coin: string, interval: HLInterval, startTime: number, endTime: number): Promise<HLCandle[]>;
  getL2Book(coin: string): Promise<L2Book>;        // { levels: [asks[], bids[]] }
}

export const hlApi: HyperliquidApi = { /* real fetch impl */ };
```

Real-vs-mock swap khi BE ready: extract `mockBotData.ts`'s `botApi` thành `botApi.ts`
import từ `botApi.real.ts` hoặc `botApi.mock.ts`. Inline hooks reference `botApi` —
chỉ thay 1 import path. Không scattered conditionals trong sections.

### 3.5 Empty state phases

```ts
type BotPhase = 'just-deployed' | 'collecting' | 'mature';

function computeBotPhase(deployedAt: Date, totalTrades: number): BotPhase {
  const hours = (Date.now() - deployedAt.getTime()) / 3_600_000;
  if (hours < 24 || totalTrades === 0) return 'just-deployed';
  if (hours < 24 * 14) return 'collecting';
  return 'mature';
}
```

**Behavior matrix**:

| Section | just-deployed | collecting | mature |
|---|---|---|---|
| **CypheusRail** | "Scanning markets... est. signal 1–3h" + scan animation | "Just opened LONG · TP1 hit · ..." event narrative | Same + milestone celebrations + anomaly alerts |
| IdentityBar | Status = SCANNING | Status = LIVE | Status = LIVE |
| HeroPnL | $0 muted, scanner anim | Real, smaller magnitude | Full |
| WinStreakGauge | "—" muted opacity 0.4 | Growing | Full ring |
| ActivityHeatmap | **Onboarding strip** (mini preview, no 47 empty cells) | Strip + partial color | Full 47-cell |
| EquityCurve | Empty state card | Sparse line | Full |
| LiveSpotFeed | Always full (HL data) — footer "Watching for [conditions]" | Same + entry markers | Same |
| ExecutionPipeline | Stage 01 "Scan" active blue | Cycling normally | Cycling normally |
| RecentFills | Empty state card "Waiting for first signal" | Partial list | Full |
| OrderBookL2 | Always full (HL data) | Same | Same |
| GainersLosersBubble | Always full (HL data) | Same | Same |

→ **Cypheus rail + 3 sections HL-driven** (LiveSpotFeed + OrderBookL2 + Bubble) khiến
trang **không bao giờ trống** ngay cả Day 0. Cypheus đảm nhận vai trò narrator across
tất cả phases — không phải tip card riêng cho empty state nữa.

---

## 4 · Section detail

### 4.1 IdentityBar
Bot name, mode badge (LIVE/DRY-RUN/SCANNING), pair, timeframe, exchange, uptime ("Running 12d 4h" hoặc "Just deployed · 12m ago"). Actions: Pause / Stop / Edit. Edit → navigate back to builder pre-filled bằng existing serializer (`deserializeUnifiedPayload`).

### 4.2 HeroPnL + WinStreakGauge
- Hero number: Today realized PnL, Press Start 2P, ~64px, color theo sign
- Stats line: `▲ N trades · 24h · X% win · Y/hour · Z open`
- Win streak gauge: SVG circle progress, glow đỏ, big "12" số streak hiện tại; muted khi 0
- Empty state: $0.00 màu muted (#475569) + scanner progress bar + "Est. first signal in 1–3h"

### 4.3 ActivityHeatmap
- **Full mode** (mature): 47 cells × 1 row, height 32px. Color theo daily PnL bucket (6 levels). Hover = tooltip $ amount. Today cell glow.
- **Onboarding strip** (just-deployed): no 47 cells; replace với mini preview row + icon + copy "Will populate as bot accumulates trades · 47-day window". Today cell pulse blue.
- Footer: `Total $X · Best $Y · Worst $Z` (compute từ daily aggregation)
- Compute: `groupBy(fills, startOfDay).sum(pnl).takeLast(47)`

### 4.4 EquityCurve
- Line chart with gradient fill. Timeframe tabs 1D / 7D / 30D / All.
- Annotation marker for best day.
- Live endpoint dot pulses (last value).
- Lib: `lightweight-charts` line series.

### 4.5 LiveSpotFeed
- Candlestick của bot's pair + timeframe (vd. BTC-USDC 5m)
- Bollinger Band overlay (vì template default = BB Breakout)
- Entry/exit markers từ bot's fill history
- Top right: pair price + 24h % from HL
- Footer: dynamic copy based on bot's strategy condition. Vd. RSI strategy → "Watching for RSI < 30 · Next check in 12s"
- Lib: `lightweight-charts` candlestick + line + markers

### 4.6 ExecutionPipeline
- 6 stages horizontal: Scan → Detect → Validate → Size → Fill → Settle + 1 budget card cuối
- Active stage: glow teal pulse (mature) hoặc blue (just-deployed scanning)
- Mock cycles every ~2s through stages. Counter `Cycle #1,354`.
- Header: `Budget 2.7s · Elapsed 1.56s` real-time tick
- 100% mock — BE chưa instrument. Service trả static cycle data + FE animates.

### 4.7 RecentFills
- Compact table 5–10 rows, scroll for more
- Columns: time-ago · pill (LONG/SHORT) · pair · entry→exit · PnL · status pill (TP/SL/OPEN)
- Top row "PENDING" với border đỏ + LIVE badge **khi mock data có fill với `status === 'OPEN'`**
- Empty state: card "Waiting for first signal · Trades will stream here as they execute"
- Footer link "View all N trades →" (open drawer/dialog với full list)
- **Note v1**: "live" effect = CSS animation trên row đầu, không phải real WS push. Khi swap real BE → cân nhắc WS subscribe (out of scope v1).

### 4.8 OrderBookL2
- **Left column, ngay trên LiveSpotFeed** (group cùng vì cùng market data của bot's pair)
- Width = full left column (~700–900px tùy viewport), height ~220–260px
- **Layout 2-column trong card**: asks (đỏ) trái · bids (xanh) phải, side-by-side để compact theo chiều cao
  - Mỗi cột ~10 levels, mỗi row: `price` · `size` · `cumulative size bar` (gradient bar tỷ lệ cumulative)
  - Asks giá tăng từ trên xuống (best ask trên cùng); Bids giá giảm từ trên xuống (best bid trên cùng)
- **Center strip giữa 2 cột**: `Spread $0.03 (0.02%) · Mid 67,518.5` highlighted
- Header: `ORDER BOOK · BTC · L2` + LIVE pulse dot (xanh teal) bên phải
- Update: poll `getL2Book(coin)` every **1s** (REST). UI throttle render 4 fps để tránh jank.
- Empty state: not applicable — HL data luôn có. Nếu API down → giữ last snapshot + "Stale Xs ago" indicator.
- **Note v1**: REST polling, không WebSocket. Đủ smooth cho demo. WS subscribe = future iteration nếu cần real-time tick (out of scope v1).

### 4.9 GainersLosersBubble
- Sidebar **full height**, 280px width, ~750–800px height (chiếm toàn bộ chiều cao left column tương ứng)
- Tabs: 24H / 7D / 30D / 90D
- Bubble visualization — top 15 pairs by `abs(pctChange) × log(volume)` magnitude
- Bubble size proportional to `dayNtlVlm` (volume USD), color by sign
- Bubble label: `TICKER` + `±X%`
- Hover: scale 1.12x, tooltip với full stats
- Footer stats: 4 cells từ **HL universe filtered** (`dayNtlVlm ≥ $100k` để loại pair dead/illiquid, kết quả ~50–80 pair):
  - Winners count (pctChange > 0)
  - Losers count
  - Best (single max gainer)
  - Worst (single max loser)
- Layout algorithm: precomputed positions cho 15 bubbles, sized by magnitude rank. Không dùng d3-force để giữ deterministic + fast.

### 4.10 CypheusRail (left rail · wraps the page)
- **Reuse từ `src/features/cypheus/`** — CypheusDock component, useCypheusStore, typewriter
animation. **Không tạo mới.**
- Layout: 240px expanded · 48px collapsed (icon-only). Persist via `useLayoutPrefsStore.leftPanelCollapsed`
(shared với Builder — user collapse trong Builder thì sang monitoring vẫn collapsed).
- Cypheus avatar trên cùng + scrollable narrative log dưới với typewriter cho message mới nhất.
- **Mode prop**: `<CypheusDock mode="monitoring" />` — phân biệt với `mode="builder"` để load đúng
event-to-message script. Nếu Cypheus component hiện chưa hỗ trợ mode → cần tiny extension (small task in M2).
- Driven bởi `useCypheusMonitoringNarrative()` — watch data changes (fills, snapshot, phase, market)
và push messages vào useCypheusStore.
- **Event types** (xem §6 dưới cho chi tiết script):
  - `bot.scanning` — when phase = just-deployed
  - `position.opened` — new fill với status = OPEN
  - `position.tp_hit`, `position.sl_hit` — close events
  - `streak.milestone` — win streak hit new high
  - `anomaly.consecutive_losses` — 3+ SL trong 5 trade gần nhất
  - `milestone.pnl_threshold` — total PnL qua mốc tròn ($1k, $5k, $10k...)
  - `idle.long_no_signal` — > 6 candles không có signal
  - `market.context_shift` — vol drop/spike notable trên HL pair của bot
- Message tone: friendly, concise, occasional emoji (🎯 cho streak), data-aware (kèm exact $/% số).
- Mỗi message có timestamp + icon theo type. Click message → highlight section tương ứng (vd. click TP message → flash RecentFills row liên quan).

**Sample messages** (tone: friendly, concise, data-aware):

```
[just-deployed] "Scanning markets · est. first signal in 1–3h"
[just-deployed] "I'll watch BB upper band cross + RSI <70 for you."
[position.opened] "Just opened LONG @ 67,201 · stop at 67,180"
[position.tp_hit] "TP1 hit! +$184.20 · 5/5 entry conditions met cleanly."
[position.sl_hit] "SL hit · -$42.18. RSI was at 68 when entry triggered."
[streak.milestone] "Win streak 12 · personal best! 🎯"
[anomaly.consecutive_losses] "3 SL hits in last 5 trades · maybe revisit your stop level?"
[milestone.pnl_threshold] "30-day PnL crossed +$2,800 · best month yet."
[idle.long_no_signal] "Quiet for 6 candles · BB stayed mid-range."
[market.context_shift] "BTC vol dropped 40% today · expect fewer signals."
```

Logic ở `cypheusEvents.ts` — function `generateEventNarrations(prevState, nextState, marketCtx)`
trả về array messages mới phát sinh. Page component đẩy vào useCypheusStore qua `useCypheusMonitoringNarrative` hook.

### 5.1 Endpoints

```
POST https://api.hyperliquid.xyz/info
  Body: {"type":"metaAndAssetCtxs"}
  → 1 call → all pairs với markPx, prevDayPx, dayNtlVlm, openInterest, funding

POST https://api.hyperliquid.xyz/info
  Body: {"type":"candleSnapshot","req":{"coin":"BTC","interval":"5m","startTime":...,"endTime":...}}
  → OHLCV array

POST https://api.hyperliquid.xyz/info
  Body: {"type":"l2Book","coin":"BTC"}
  → { coin, time, levels: [asks: [{px, sz, n}, …], bids: [{px, sz, n}, …]] }
```

### 5.2 Caching

- `metaAndAssetCtxs`: TTL 5s, single in-flight dedup
- `candleSnapshot` per (coin, interval): TTL 30s khi tab visible; pause refresh khi `document.hidden`
- `l2Book` per coin: poll mỗi 1s khi tab visible, pause khi hidden. Không cache (luôn fetch fresh). Throttle UI render 4 fps để tránh jank với rapid updates.

### 5.3 CORS

HL public API thường có CORS open. **Verify ngay trong M1** bằng `fetch` từ console
trên `localhost:5173`. Nếu blocked → thin Vercel edge function proxy
(`/api/hl?type=...`) với 1 ngày impl.

### 5.4 Fallback

API down → giữ last cached values + label "Last updated Xm ago" + warning icon. Không
blank section.

### 5.5 7D/30D/90D tab — gainers/losers compute

24H trả thẳng từ `prevDayPx` (1 call).
7D/30D/90D không có direct field → compute:
- 7D: `candleSnapshot(coin, '1d', now-7d, now)` → first.open vs last.close → pct change
- Need ~100 candleSnapshot calls (1 per pair) parallel. Batch: `Promise.all` với rate limit
  10 concurrent. Cache 60s.

→ Trade-off: tab switch 7D có 1–2s loading lần đầu (acceptable). Cache làm subsequent
switch instant.

---

## 6 · Mock data strategy

### 6.1 Seeded RNG

```ts
import { mulberry32 } from './utils/seeded-rng';
const seed = stringHash(botId + Math.floor(Date.now() / 86400000));  // changes daily
const rng = mulberry32(seed);
```

→ Reload trong cùng ngày = same data. Sang ngày mới = new seed → fresh data → bot cảm
giác "đã có thêm activity hôm nay".

### 6.2 Mocked entities

| Entity | Approach |
|---|---|
| BotMeta | Hardcoded từ existing `BuilderState` (đọc từ Zustand) |
| Fills (200 mock) | Generate over 47 days với realistic distribution: 60% TP, 30% SL, 10% breakeven; clusters trong market hours |
| PerformanceSnapshot | Aggregate từ Fills |
| EquityCurve | `cumsum(fills.pnl)` + small noise |
| DailyPnL | `groupBy(fills, day).sum(pnl)` |
| ExecutionCycle | Static stage durations + FE animates timing |

### 6.3 Demo controls (dev-only)

`?dev=1` query param exposes floating panel:
- "Reset to Day 0" — set deployedAt = now
- "Skip to Day 14" — set deployedAt = 14 ngày trước
- "Skip to Day 47" — set deployedAt = 47 ngày trước
- "Toggle SCANNING" — force just-deployed state regardless of trades

Dùng để rehearsal demo: set lên Day 14 để show full state, hoặc Day 0 để show empty state.

---

## 7 · Tech choices

| Area | Choice | Reason |
|---|---|---|
| Charts | `lightweight-charts@4.x` | TradingView's lib, ~40KB gzipped, candle + line + markers built-in |
| Bubble layout | Static precomputed positions | Deterministic, no d3-force dep |
| Hero font | `Press Start 2P` Google Fonts | Pixelated trader vibe; fallback `monospace` |
| State | Zustand 5 (existing) | Match app pattern |
| Routing | React Router 7 (existing) | Match app pattern |
| Styling | Tailwind + shadcn (existing) | Match app pattern |
| Data fetching | Custom hooks + Zustand cache | Đơn giản, đủ cho v1; có thể migrate sang TanStack Query sau nếu phức tạp hơn |

### 7.1 Bundle budget

- New deps: `lightweight-charts` (~40KB) + Press Start 2P woff2 (~10KB) ≈ +50KB gzipped
- Lazy-load `BotMonitoringPage` qua route-level `React.lazy()` → không impact builder bundle

---

## 8 · Milestones

5 PR, mỗi cái deployable + demoable.

### M1 · Skeleton + 3-col shell + Cypheus visible (PR-M1)
- Routes wired, **single-file `BotMonitoringPage.tsx`** skeleton tạo ra
- 3-column layout shell: `<CypheusDock />` rail trái (reuse existing) · main center · sidebar phải (placeholder)
- `mockBotData.ts` + `hyperliquid.service.ts` + `cypheusEvents.ts` skeletons
- Cypheus dock rendered với 1 hardcoded message ("Welcome to monitor view") để verify reuse work
- IdentityBar + HeroPnL inline trong main với mock data
- Verify `useLayoutPrefsStore.leftPanelCollapsed` còn work (collapse/expand từ Builder carry-over)
- **Verify HL CORS** bằng manual fetch (1 dòng JS console)
- Acceptance: navigate `/bots/:id` → thấy 3-col shell + Cypheus rail (collapsed/expanded chuẩn) + IdentityBar + Hero, no error

### M2 · Charts (PR-M2)
- Integrate `lightweight-charts`
- EquityCurve với mock data + timeframe tabs
- LiveSpotFeed với **real HL kline** (BTC 5m)
- BB band overlay
- `useBotMaturity` hook
- Acceptance: 2 chart render, HL candle update real (refresh tab → giá mới)

### M3 · Heatmap + Pipeline + RecentFills + Cypheus narrative (PR-M3)
- ActivityHeatmap full-mode
- ExecutionPipeline với cycle animation (mock)
- RecentFills table với mock fills
- **Cypheus narrative wired**: `useCypheusMonitoringNarrative` hook + `generateEventNarrations` script — push events to useCypheusStore khi mock data generates fills (tp/sl/open/streak)
- Acceptance: 3 sections render; Cypheus rail typewriter messages flow as fills "happen" trong mock timeline

### M4 · OrderBook + Bubble + Empty States + Cypheus polish (PR-M4)
- **OrderBookL2** ngay trên LiveSpotFeed với real HL `l2Book` polling 1s
- GainersLosersBubble (right sidebar full height) với real HL `metaAndAssetCtxs`
- Tabs 24H/7D/30D/90D (24H instant, 7D+ batched candleSnapshot)
- Footer stats from full universe (volume-filtered)
- Empty state mode cho mọi section: ActivityHeatmap → onboarding strip, EquityCurve → empty card, RecentFills → empty card, HeroPnL → muted, Pipeline → scanning mode
- **Cypheus polish**: anomaly events (consecutive losses), milestone celebrations (PnL thresholds, streak high), market context shifts. Message timestamp + click-to-highlight section.
- Demo dev controls (`?dev=1`)
- Acceptance: switch Day 0/14/47 → page graceful, no broken sections; OrderBook smooth không jank; Cypheus messages có context-aware tone đúng phase

### M5 · BotsListPage + Builder integration (PR-M5)
- `BotsListPage.tsx` riêng (file thứ 2 — vẫn single-file per page principle): list bot cards với mini stats (name, pair, status, today PnL)
- Builder Deploy CTA → navigate to `/bots/:newId`
- Left nav (nếu có): bot list section
- Acceptance: full flow Builder → Deploy → Monitor → switch bot via list

---

## 9 · Out of scope (v1)

Giữ scope hẹp để demo trong 1–2 sprint:

- Real BE integration (separate PR series sau khi BE ready)
- Real WebSocket fills stream (mock cycles only)
- Pause/Stop/Edit thực hiện hành động thật (visual only initially — clicked → toast "Coming soon" hoặc redirect to Builder cho Edit)
- Multi-bot portfolio aggregation
- Advanced analytics: drawdown, Sharpe, per-pair, indicator state inspector
- Real execution latency measurement (BE work)
- Mobile responsive (defer; design assumes ≥1280px)
- Notifications / alerts / Telegram integration
- Backtest button (đã có stub elsewhere)
- Order Book L2 / Funding rate strip / Live tape ticker (SHOULD-tier sau)

---

## 10 · Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| HL API CORS blocks browser | Low | High | Verify M1; nếu blocks → Vercel edge proxy 1 ngày |
| Mock data feels "too perfect" | Medium | Medium | Inject realistic variance: losing days, sideways periods, occasional 0-trade days |
| Bubble layout kém khi >15 pairs có magnitude tương đương | Low | Low | Cap at 15 + "+N more" indicator dưới |
| `lightweight-charts` style conflict với Tailwind | Low | Low | Manual CSS override; lib khá self-contained |
| HL rate limit khi compute 7D/30D batch | Medium | Medium | Concurrent cap (10 parallel) + cache 60s + show partial data progressively |
| OrderBook polling 1s × multiple bots → rate limit | Low | Medium | Chỉ poll bot đang view (1 instance); pause khi tab hidden; backoff khi 429 |
| OrderBook UI jank với rapid render | Medium | Medium | Throttle render 4 fps (`useDeferredValue` hoặc `requestAnimationFrame` debounce); diff-render thay full re-render |
| Cypheus dock chưa hỗ trợ `mode="monitoring"` | Medium | Low | Tiny extension trong Cypheus store: thêm `mode` field. Backward-compatible với Builder existing usage. M1 task. |
| Cypheus narrative messages overflow / spam khi nhiều fills | Medium | Low | Throttle: max 1 message / 3s; group consecutive same-type events ("3 LONG opened") thay 3 message riêng |
| Service interface design sai → khi swap real BE phải refactor | Medium | High | M1 design interface match `BE/openapi.json` shape; review với BE owner trước khi M2 |
| Press Start 2P font chậm load → FOUT | Low | Low | `font-display: swap` + monospace fallback |

---

## 11 · Acceptance criteria (full v1)

- [ ] Navigate `/bots/:id` renders 10 sections (9 main + Cypheus rail), 0 errors
- [ ] 3-column shell layout đúng: Cypheus 240px (collapsible to 48px) · main 1fr · bubble 280px
- [ ] Cypheus rail reuse từ `src/features/cypheus/` (no duplicate components)
- [ ] Cypheus rail collapse/expand state shared với Builder via `useLayoutPrefsStore`
- [ ] Cypheus narrative messages flow đúng theo phase (just-deployed / collecting / mature)
- [ ] Empty state mode (Day 0–1) renders cleanly, không broken section
- [ ] HL bubble chart hiển thị real Hyperliquid pair data
- [ ] HL live spot feed hiển thị real candles cho bot's pair
- [ ] HL order book L2 hiển thị real depth, update mỗi 1s, smooth không jank
- [ ] Tabs 24H/7D/30D/90D ở bubble work, footer stats update
- [ ] All bot data deterministic (reload → same view trong cùng ngày)
- [ ] Page LCP <2s on dev machine, no layout shift
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` clean
- [ ] Press Start 2P loaded với swap fallback
- [ ] Demo dev controls (`?dev=1`) work — toggle Day 0 / 14 / 47
- [ ] Looks good 1440×900 (sếp's screen ratio assumed)

---

## 12 · Future iteration (post-demo)

Sau sếp approve demo:

1. **BE integration sprint** — replace mỗi mock service từng cái:
   - botMonitoring.real.ts → POST `/bot/:id/snapshot`, `/bot/:id/fills`, etc
   - WebSocket cho live fills stream
2. **Add SHOULD-tier sections**:
   - Funding rate / OI strip
   - Live tape ticker (top movers HL)
   - Upgrade OrderBookL2: REST polling → WebSocket subscribe (`l2Book` channel) cho real tick
3. **Tab navigation** nếu scope grow >10 sections: Overview / Performance / Market / Health
4. **Advanced analytics** tab (Sharpe, drawdown, per-pair)
5. **Multi-bot portfolio aggregation** trên `/bots` list
6. **Mobile responsive** — collapse 2-col → vertical
7. **Real Execution Pipeline** (BE instrumentation)
