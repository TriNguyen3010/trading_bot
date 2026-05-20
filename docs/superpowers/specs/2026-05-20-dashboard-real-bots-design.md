# Design — Dashboard wire to real bot list

> **Mục tiêu:** Replace MOCK_BOTS trong DashboardPage bằng data thật từ `GET /bot/list`. Verify end-to-end loop **Submit ở Builder → Dashboard list ra bot vừa tạo**. Read-only ở phase này — start/stop/delete để phase sau.
>
> **Created:** 2026-05-20
> **Owner:** Tri Nguyen
> **Status:** Approved — ready for implementation plan
> **Depends on:** `feat/wallet-auth` (merged vào main)

---

## 0. Bối cảnh

Sau khi merge wallet-auth, app đã có:

- ✅ Auth qua `X-Wallet-*` headers (FE + BE đồng bộ)
- ✅ `botStrategyApi.create` (POST /bot-strategy/create) — wired
- ✅ `botApi.list()` (GET /bot/list) — wired
- ✅ `botApi.getConfig(id)` (GET /bot/{id}/config) — wired
- ✅ ExportDialog có nút "Submit to Backend" → tạo bot xong navigate `/bots/{id}`
- ✅ MyBotsDialog (trong Builder header) đã list bot từ BE thật

Nhưng **DashboardPage** (tạo ở demo branch, route `/dashboard` + `/`) vẫn hardcode `MOCK_BOTS`. Hệ quả:

1. User connect wallet → vào Dashboard → thấy 3 bot demo không phải của mình → confusing.
2. User submit bot mới ở Builder → success toast → navigate `/bots/{newId}` → quay lại Dashboard → bot vừa tạo **không xuất hiện** vì list đang là static array. → broken loop.

Phase này đóng cái loop đó: Dashboard list trở thành nguồn truth duy nhất, MOCK_BOTS chỉ dùng làm visual fallback khi list rỗng (để Dashboard không trống trải lần đầu user vào).

**Không trong scope phase này** (sẽ là phase sau):
- Bot start/stop/delete controls — cần `POST /bot/{id}/start|stop` + `DELETE /bot/{id}` + confirm dialogs
- BotMonitoringPage thay mock — cần wire `/bot/{id}/performance`, `/open_trades`, …
- Update bot từ Dashboard — link sang Builder với `?bot_id=X` query
- Sort / filter bot list ngoài search text
- Inline rename / drag-reorder bots

---

## 1. Quyết định chốt

| # | Hạng mục | Lựa chọn | Lý do |
|---|---|---|---|
| 1 | **Fetch strategy** | `useEffect` 1 lần on mount + nút "Refresh" thủ công cạnh search input. **Không** auto-refresh trên window focus. **Không** tự refetch sau submit (re-mount sẽ refetch tự nhiên qua route nav). | Đơn giản, predictable. Refresh button là escape hatch cho rare case user ở yên Dashboard sau khi tạo bot ở tab khác. |
| 2 | **State management** | Local `useState` trong DashboardPage, **không** tạo `bot.store.ts` | Bot list chỉ Dashboard cần. Tránh global state thừa. |
| 3 | **Schema typing** | Dùng `BotOut`, `BotConfigOut` từ `bot-monitoring/bot.api.ts` (đã có) — không tạo type riêng | Reuse, single source of truth từ openapi. |
| 4 | **Per-bot config fetch** | `Promise.allSettled` parallel sau khi list về (mirror MyBotsDialog pattern). 1 bot config fail không kéo theo cả grid. | UI partial-success > all-or-nothing |
| 5 | **Rate limit / batching** | KHÔNG batch ở phase này. 50 bots = 50 requests song song. Sang phase polish nếu BE rate-limit hay user > 50 bots. | Premature optimization. MyBotsDialog đã làm vậy, chưa thấy issue. |
| 6 | **MOCK_BOTS** | Giữ lại, hiện khi real bots = 0, với banner "You haven't built any bots yet". 3 samples với DEMO pill như hiện tại. | Empty state có visual preview UI sẽ trông thế nào. |
| 7 | **Race condition** | `cancelled` flag trong useEffect cleanup. Stale fetch không setState. | Đơn giản hơn AbortController, đủ cho use case |
| 8 | **Loading state** | 3 skeleton cards (animate-pulse, `card-coin98-flat`). Search + Refresh button **ẩn** trong loading. | Match số bots thường + brand consistency |
| 9 | **Error state** | Card duy nhất ở giữa với nút Retry. Search + Refresh button **ẩn**. | Đơn giản, không spam toast |
| 10 | **Empty state** | Banner inline + 3 MOCK_BOTS với DEMO pill. Search **ẩn** (no data to search). Refresh button **hiện**. | User vẫn refresh được khi vừa tạo bot ở tab khác |
| 11 | **Loaded state** | Real bots, search + Refresh đều hiện. MOCK_BOTS ẩn hoàn toàn. | Standard list UX |
| 12 | **Hero portfolio P&L** | Compute từ real bots: `activeBots`, `totalBots`, `pausedBots` count. Số tiền P&L → "—" với tooltip "Available once monitoring phase ships" | Honest data. Không bịa số. |
| 13 | **Hero DEMO pill** | Hiện chỉ khi `realBots !== null && realBots.length === 0` (empty state). | Marker nhất quán với bot cards |
| 14 | **MyBotsDialog (Builder header)** | Giữ nguyên, **không** remove. Dashboard = home overview, MyBotsDialog = quick switch trong Builder workflow. | Context khác, không phải duplicate đúng nghĩa |
| 15 | **Bot status mapping** | ERROR overrides tất cả; `running` + `dry_run=true` = DRY-RUN; `running` + `dry_run=false` = LIVE; **mọi status khác** (stopped/idle/starting/stopping/syncing/...) = PAUSED. | Defensive: BE có thể thêm status mới, mình không cần exhaustive enum |
| 16 | **Pair format** | Reuse `jsonPairToUi` từ `lib/pair-format.ts` (đã dùng ở MyBotsDialog) | DRY |

---

## 2. Architecture

### 2.1. Files changed

```
src/pages/DashboardPage.tsx        ← rewrite data layer (UI grid giữ nguyên)
src/features/bot-monitoring/
├── bot.api.ts                     ← (đã có sẵn) — không đổi
└── bot-list.helpers.ts            ← NEW — derive DashboardBot từ BotOut + config
src/pages/__tests__/
└── DashboardPage.test.tsx         ← NEW — component tests
```

### 2.2. Files NEW

- `src/features/bot-monitoring/bot-list.helpers.ts` — pure functions (`deriveMode`, `derivePair`, `deriveTimeframe`, `zipBotsAndConfigs`). Pure để unit-testable.
- `src/features/bot-monitoring/bot-list.helpers.test.ts` — unit tests.
- `src/pages/__tests__/DashboardPage.test.tsx` — integration tests.

### 2.3. Files KHÔNG đổi

- `botStrategyApi.create`, `botApi.list/getConfig` — đã ổn
- ExportDialog submit flow — đã ổn
- BotCard sub-component trong DashboardPage — đã handle nullable fields
- MyBotsDialog — vẫn dùng song song trong Builder header

---

## 3. Data flow

### 3.1. Happy path

```
DashboardPage mount
   ↓
useEffect (cancelled=false)
   ↓
setLoading(true)
   ↓
botApi.list()                            (GET /bot/list)
   ↓
got BotOut[]
   ↓
list.length === 0
   ├─ Yes → setRealBots([]), setLoading(false), unmount cleanup safe
   └─ No  ↓
        Promise.allSettled(list.map(b => botApi.getConfig(b.id)))
           ↓
        unwrap: result.value.config       (BotConfigOut → inner ConfigShape)
                — getConfig returns { config: { dry_run, timeframe, exchange, … } }
                — same unwrap MyBotsDialog does at MyBotsDialog.tsx:217
           ↓
        cancelled check — if cleanup ran, drop result
           ↓
        zip(bot, config) → DashboardBot[]    (via bot-list.helpers.ts)
           ↓
        setRealBots(...) + setLoading(false)
           ↓
        render grid
```

### 3.2. Race condition handling

```ts
useEffect(() => {
  let cancelled = false;
  const fetchBots = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const list = await botApi.list();
      if (cancelled) return;                  // ← cleanup ran during fetch
      // ... allSettled, zip, etc ...
      if (cancelled) return;
      setRealBots(zipped);
    } catch (err) {
      if (cancelled) return;
      setFetchError(formatBackendError(err));
    } finally {
      if (!cancelled) setLoading(false);
    }
  };
  fetchBots();
  return () => { cancelled = true; };
}, [refreshKey]);                              // ← bump key to refetch
```

`refreshKey` là `useState(0)` — nút "Refresh" gọi `setRefreshKey(k => k + 1)` để trigger re-run.

### 3.3. Error paths

| Tầng | Lỗi | Hành vi |
|---|---|---|
| `botApi.list()` 401 | Token mất hiệu lực | http.ts đã handle: clear + redirect `/`. UI không cần xử lý thêm. |
| `botApi.list()` 403 | BE từ chối | http.ts toast warning (silent prefix `/bot/` đã add). UI hiện error state với retry. |
| `botApi.list()` 5xx / network | Server down hoặc offline | UI error state với retry button. |
| Per-bot `getConfig` fail | Single bot config lỗi | Card đó hiện `?` cho pair/timeframe, vẫn render với name + status từ BotOut. **Không** fail toàn list. |
| Mount + unmount nhanh | User vào → out → in lại trong khi fetch chưa xong | `cancelled` flag chặn stale setState. Fresh fetch sẽ chạy lại. |

### 3.4. DashboardBot shape

```ts
interface DashboardBot {
  id: number;
  name: string;             // bot_name ?? `Bot #${id}`
  pair: string;             // jsonPairToUi(config.exchange.pair_whitelist[0]) ?? '?'
  timeframe: string;        // config.timeframe ?? '?'
  mode: 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';
                            //   ERROR overrides all
                            //   LIVE = running && !dry_run
                            //   DRY-RUN = running && dry_run
                            //   PAUSED = otherwise (stopped/idle/syncing/...)
  errorMsg: string | null;  // bot.error_message
  uptime: null;             // phase này: null (defer monitoring phase)
  pnl: null;
  pnlPct: null;
  pnlDirection: 'flat';     // default — no data yet
  trades: null;
  winRate: null;
  sharpe: null;
  sparkline: null;
  isDemo: false;            // chỉ MOCK_BOTS = true
}
```

BotCard component **đã handle** nullable fields (`bot.trades != null` etc.) — không cần thay đổi BotCard.

---

## 4. UI states

### 4.1. Loading
3 skeleton cards giả lập grid:
```
┌─────────┐ ┌─────────┐ ┌─────────┐
│ ▓▓▓▓▓░░ │ │ ▓▓▓▓▓░░ │ │ ▓▓▓▓▓░░ │
│ ▓▓▓░░░░ │ │ ▓▓▓░░░░ │ │ ▓▓▓░░░░ │
│ ▓▓▓▓▓░░ │ │ ▓▓▓▓▓░░ │ │ ▓▓▓▓▓░░ │
└─────────┘ └─────────┘ └─────────┘
```
- Pulse animation (`animate-pulse` + `card-coin98-flat`)
- Search input: **hidden**
- Refresh button: **hidden** (đang fetch rồi)
- Hero portfolio: shows skeleton số counts

### 4.2. Empty (real bots = 0)
```
┌──────────────────────────────────────────────┐
│ ℹ You haven't built any bots yet.            │
│   Below is a sample — try New bot to start.  │
└──────────────────────────────────────────────┘

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
│ Mock1   │ │ Mock2   │ │ Mock3   │ │ + New bot│
│ DEMO    │ │ DEMO    │ │ DEMO    │ │          │
└─────────┘ └─────────┘ └─────────┘ └──────────┘
```
- 3 MOCK_BOTS với DEMO pill
- Search input: **hidden** (no data to search)
- Refresh button: **visible** (user có thể vừa tạo bot ở tab khác)
- Hero portfolio: counts = 0, DEMO pill on hero label

### 4.3. Loaded (real bots > 0)
- Real bots cards. MOCK_BOTS hoàn toàn ẩn.
- Search input: **visible** + functional
- Refresh button: **visible**
- Hero portfolio: counts from real bots, DEMO pill ẩn
- Title: "My bots · N total" với N = real count

### 4.4. Error
```
┌──────────────────────────────────────────────┐
│      ⚠ Couldn't load your bots               │
│      <formatBackendError(err)>                │
│              [ Retry ]                        │
└──────────────────────────────────────────────┘
```
- Search input: **hidden**
- Refresh button: **hidden** (retry button thay thế)
- Hero portfolio: counts = "—", DEMO pill ẩn (chưa biết user có bot không)

### 4.5. Search input behavior
- Visible chỉ trong loaded state
- Filter realtime trên `bot.name` + `bot.pair`
- Search miss → "No bots match 'xxx'" + Clear button
- Clear không trigger refetch

### 4.6. Refresh button
- Icon-only button (RefreshCw lucide), `variant="ghost"`, `size="sm"`
- Vị trí: giữa search input và Import/New bot buttons
- Click → `setRefreshKey(k => k + 1)` → useEffect re-runs → loading state, refetch
- Disabled khi `loading === true`

---

## 5. Test plan

### 5.1. Unit (`bot-list.helpers.test.ts`)
- `deriveMode(bot, config)`:
  - bot.error_message present → 'ERROR' (highest priority)
  - bot.status === 'running' && !config.dry_run → 'LIVE'
  - bot.status === 'running' && config.dry_run → 'DRY-RUN'
  - bot.status === 'stopped' → 'PAUSED'
  - bot.status === 'idle'/'syncing'/'starting' → 'PAUSED' (defensive)
  - config === null + bot.status === 'running' → 'PAUSED' (dry_run unknown, safest)
- `derivePair(config)`: extract first pair_whitelist, format via jsonPairToUi, fallback '?'
- `deriveTimeframe(config)`: read config.timeframe, fallback '?'
- `zipBotsAndConfigs(bots, configs)`: handle null config gracefully, preserves order

### 5.2. Integration (`DashboardPage.test.tsx`)
- Renders skeletons while loading (search + refresh ẩn)
- Renders bot cards when list succeeds (search + refresh visible)
- Renders empty banner + MOCK_BOTS when list returns `[]` (refresh visible, search ẩn)
- Renders error state + retry button when list rejects (search + refresh ẩn)
- Retry button refetches and recovers
- Refresh button bumps refreshKey → triggers refetch
- Per-bot config failure: card still renders with name + status
- Unmount during fetch: no setState warning (cancelled flag works)

### 5.3. Manual smoke
1. Login bằng C98 ví thật → vào Dashboard → loading skeleton → real bots show up (hoặc empty banner nếu chưa có bot nào)
2. Click "New bot" → Builder wizard → Submit → toast success → navigate `/bots/{id}`
3. Click logo → quay về Dashboard → bot mới appear trong list
4. Check hero "active count" + "total count" khớp số bots show
5. Click Refresh button → loading skeleton → bots refresh
6. Throttle network "Slow 3G" + click Refresh → skeleton hiện đủ lâu để thấy

---

## 6. Definition of Done

- [ ] DashboardPage không còn ref tới `MOCK_BOTS` ở loaded state. MOCK_BOTS giữ lại làm empty fallback only.
- [ ] `botApi.list()` được gọi 1 lần trên mount. Refresh button trigger fetch lại.
- [ ] 5 trạng thái (loading / empty / loaded / error / search-empty) render đúng theo §4.
- [ ] Hero portfolio counts khớp real bots (active / total / paused).
- [ ] DEMO pill hiện ↔ empty state, ẩn ↔ loaded.
- [ ] Race condition test pass (mount + unmount giữa lúc fetch không gây "setState on unmounted" warning).
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm lint --max-warnings=0` clean (ignore pre-existing react-refresh warnings).
- [ ] `pnpm test` — all new tests pass (~10 unit + integration); no regression.
- [ ] Manual smoke (§5.3) all green với ví C98 thật + BE up.
- [ ] PR opened với link tới spec + plan.

---

## 7. Diff với current MOCK_BOTS UI

UI shell giữ nguyên ~95%:
- Hero portfolio card → values change source, layout same. Hero gain DEMO pill chỉ khi empty.
- Bot card grid → render từ `DashboardBot[]` thay vì `MockBot[]`, cùng component `BotCard`.
- "New bot" tile cuối grid → giữ.
- Search input → conditional visible per §4.5.
- Import button → unchanged.
- **NEW**: Refresh button (icon-only, ghost, sm) cạnh search.
- **NEW**: Empty banner inline phía trên grid khi `realBots.length === 0`.

Visually: user chỉ thấy **(a)** data đổi từ mock sang real, **(b)** thêm nút Refresh nhỏ, **(c)** banner trong empty state.

---

## 8. Out of scope (next phase)

- `POST /bot/{id}/start`, `POST /bot/{id}/stop`, `DELETE /bot/{id}` — controls on cards
- `GET /bot/{id}/performance` aggregate → real P&L / sharpe / win rate
- Auto-refresh on window focus (window focus event re-triggers fetch)
- `MyBotsDialog` cleanup (decided: keep both — see §1 row 14)
- `BotMonitoringPage` real data wiring (still uses `mockBotData.ts`)
- Update bot từ Dashboard (link to `/builder?bot_id=X`)
- Pagination (assumes < 50 bots per user — defer until BE adds `offset/limit`)
- Sort / filter / inline-rename / drag-reorder
- Batching getConfig requests when N is large
