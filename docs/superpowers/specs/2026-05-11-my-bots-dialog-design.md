# My Bots Dialog — Design Spec

**Status:** Approved by Tri 2026-05-11
**Owner:** FE (Tri Nguyen)
**Tracking:** scope v1 (this doc); v2/v3 listed under "Out of scope".

---

## 1. Goal

Replace the "Monitor" header button (currently hard-coded to `/bots/bot-1`) and the standalone `/bots` page with a **My Bots dialog**. The dialog is triggered from a new "My Bots" button in the builder header, lists the logged-in user's real bots from BE, and lets the user click any bot card to navigate to the existing `/bots/:id` monitor page.

The card layout from the current `BotsListPage` is preserved 1:1. Fields that BE doesn't yet expose are rendered as `—` (em-dash placeholder) so that when BE ships them, FE only needs a data wiring change — no layout change.

## 2. Non-goals

- **Monitor page (`/bots/:id`) stays on mock data.** Wiring `BotMonitoringPage` to real BE (charts, fills, cycles, WebSocket) is a separate effort.
- **No Start/Stop button** in this iteration.
- **No `GET /bot/{id}/performance` / `/open_trades` calls.** Those fields render as placeholders.
- **No realtime updates.** Dialog fetches once on open.

## 3. User flow

1. User is on `/builder`. In the header toolbar there's a new button **My Bots** (replaces the old Monitor button).
2. Click → dialog opens, shows a loading skeleton (3 card placeholders).
3. FE calls `GET /bot/list` then `GET /bot/{id}/config` for each bot in parallel.
4. Once data is ready, cards render. Each card shows: name, pair · timeframe, mode badge, status badge, and placeholder stats.
5. Click a card → dialog closes, navigates to `/bots/<id>` (existing monitor page, unchanged).
6. Empty state: "No bots yet" + CTA button "Build your first strategy →" → closes dialog and navigates to `/builder`.
7. Error state (list fetch fails): error message + retry button.

## 4. Component design

### 4.1 Files added

| File | Purpose |
|---|---|
| `src/features/bot-monitoring/my-bots-dialog.store.ts` | Zustand store `{ open: boolean, setOpen(v): void }`. Mirrors `export-dialog.store.ts` exactly. |
| `src/features/bot-monitoring/MyBotsDialog.tsx` | Radix Dialog wrapper rendering grid of bot cards. Owns fetch logic via `useEffect` triggered on `open === true`. |
| `src/features/bot-monitoring/bot.api.ts` | `botApi.list()` → `http<BotOut[]>('GET', '/bot/list')`. `botApi.getConfig(id)` → `http<BotConfigResponse>('GET', '/bot/'+id+'/config')`. Types from `src/types/api-helpers.ts`. |
| `src/lib/format-error.ts` | Extract `formatBackendError(err: unknown): string` (currently inlined in `ExportDialog.tsx`). Re-used by `MyBotsDialog` and `ExportDialog`. Pure function, easy to unit-test. |

### 4.2 Files modified

| File | Change |
|---|---|
| `src/features/bot-builder/components/HeaderToolbar.tsx` | Remove the existing Monitor button at line 276 (the one with `onClick={() => navigate('/bots/bot-1')}`). Add a new "My Bots" button (icon: `List` or `Bot` from lucide-react) that calls `useMyBotsDialogStore.getState().setOpen(true)`. Mount `<MyBotsDialog />` inside the toolbar component alongside the existing `<ExportDialog />` mount. |
| `src/routes.tsx` | Remove the `/bots` route (it's now a dialog). Keep `/bots/:id` route. Also remove the `BotsListPage` import. |
| `src/features/bot-monitoring/BotsListPage.tsx` | Delete the file. It is no longer reachable. |
| `src/features/export-import/ExportDialog.tsx` | Replace inline `formatBackendError` with `import { formatBackendError } from '@/lib/format-error'`. Behavior unchanged. |
| `src/lib/http.ts` | Add `/bot/` to `SILENT_TOAST_PREFIXES` (so list/config failures are not double-toasted). |

### 4.3 Card content rules

| Field | Source | Render rule |
|---|---|---|
| `bot_name` | `/bot/list` → `bot_name` | Show as title. Falls back to `Bot #<id>` if null. |
| pair | `/bot/{id}/config` → `pair_whitelist[0]` | Run through `jsonPairToUi()` (already in `src/lib/pair-format.ts`) to convert `BTC/USDC:USDC` → `BTC-USDC`. While config is loading, show a small inline skeleton. |
| timeframe | `/bot/{id}/config` → `timeframe` | Verbatim (e.g. `5m`). |
| mode badge | `/bot/{id}/config` → `dry_run` | `dry_run === true` → `DRY-RUN` (brand color). `dry_run === false` → `LIVE` (bullish color). |
| status badge | `/bot/list` → `status` | `running` = bullish green, `stopped` = muted gray, anything else (e.g. `error`) = bearish red. If `error_message` is non-null, show error variant regardless of status string. |
| today $ | _BE not available yet_ | `—` in `text-fg-muted`. No color class applied. |
| win % | _BE not available yet_ | `—` |
| trades | _BE not available yet_ | `—` |
| running uptime | _BE not available yet_ | `—` |

**Placeholder discipline:** placeholders must use `text-fg-muted` to look visually distinct from real data. Do NOT apply bullish/bearish color classes to placeholder values. This prevents false signal when scanning.

### 4.4 Data flow

```
Click My Bots button
  → setOpen(true)
  → MyBotsDialog useEffect fires
  → botApi.list() → [{id, bot_name, status, ...}]
  → setRows(seeded with meta only)
  → Promise.all(bots.map(b => botApi.getConfig(b.id)))
  → enrich each row with {pair, timeframe, dry_run}
  → setRows(enriched)
```

Skeleton is shown while `rows === null`. Cards render with status/name visible and pair/timeframe inline-skeletons while configs are loading. Once all configs land, full card data is visible.

### 4.5 Reused primitives

- Dialog: `src/components/ui/dialog.tsx` (Radix wrapper used by Templates and Export dialogs).
- Button: `src/components/ui/button.tsx`.
- Card layout & badge styles: re-use the same Tailwind classes from `BotsListPage.tsx` (extract into `MyBotsDialog.tsx` directly — not worth a shared component yet).
- `cn` helper: `@/lib/utils`.

## 5. API integration

### 5.1 New endpoints used

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/bot/list` | `BotOut[]` | Per user, filtered by JWT. Already returns 200 in BE. |
| GET | `/bot/{id}/config` | Full Freqtrade config | Used to extract `pair`, `timeframe`, `dry_run`. Heavier than list. |

### 5.2 Error handling

All calls go through `src/lib/http.ts`.

**Add `/bot/` to `SILENT_TOAST_PREFIXES`** in `http.ts` so http.ts does NOT fire a global toast for `/bot/list` or `/bot/{id}/config` failures. The dialog renders error UX locally — single source of truth, no double display. (Same pattern as `/bot-strategy/` + ExportDialog.)

401 handling is unchanged (still redirects globally — applies to all non-login paths).

**List fetch error**: dialog shows an inline error region above the (empty) grid with `<status>: <BE detail or fallback text>`. Use a helper analogous to ExportDialog's `formatBackendError(err)` (extract into `src/lib/format-error.ts` so both consumers can reuse it — this is a small useful refactor while we're here). Retry button refetches.

**Per-bot config failure**: do NOT block the whole list. Show the card with pair/timeframe as `?` (small text, gray). Log to console for debugging. The user can still navigate to the monitor page.

### 5.3 N+1 acceptability

A typical user has < 20 bots. Even at 20, parallel fetches are < 200 KB total and resolve in ~1 second. We accept this for v1. If real users have hundreds, BE should add an enriched list endpoint (see §6).

## 6. Backend dependencies (request from Tuấn after this ships)

Track these as separate BE tickets:

1. **Enrich `/bot/list` response** with `pair`, `timeframe`, `dry_run`, `created_at` so FE doesn't need N+1.
2. **`GET /bot/{id}/performance`** returning `{ today_pnl, total_pnl, total_trades, wins, losses, win_rate }`. Used for the TODAY / WIN / TRADES stats.
3. **`created_at` on `BotOut`** so FE can compute "Running 12d 4h" uptime.

When (1) lands: FE drops the N+1 config calls.
When (2) lands: FE plugs the values into the card; remove `—` placeholders.

## 7. Testing

| Layer | Test |
|---|---|
| Store | `my-bots-dialog.store.test.ts` — open/close toggle, initial state. |
| Api | Covered indirectly by `http.test.ts` (already tests `http()` behavior). No new tests for `bot.api.ts` shape — it's a thin wrapper. |
| Format-error | `src/lib/format-error.test.ts` — ValidationError → `field.path: msg` lines, HttpError with JSON body → `<status>: <detail>`, HttpError with text body → `<status>: <body>`, Network error → custom message, unknown error → `String(err)`. |
| http.ts | Extend `http.test.ts` with a test asserting `/bot/list` does NOT toast on 5xx (parallel to existing `/user/login` / `/bot-strategy/` tests). |
| Component | `MyBotsDialog.test.tsx` — render skeleton when fetching, render cards with mocked api response, click card calls navigate, empty state, error state + retry. |

Use `@testing-library/react` (already in use per `JsonLiveView.test.tsx` and `SetupProgress.test.tsx`). Mock `botApi` with `vi.mock`.

## 8. Out of scope (future iterations)

- **B**: monitor page header shows real bot meta; start/stop buttons wired.
- **C**: full monitor page real-time (performance/open_trades/logs/WebSocket).
- "My Bots" deep-link via URL hash (e.g. `/builder#my-bots`) — not requested.
- Bot delete (`DELETE /bot/{id}`) from the dialog — not requested.

## 9. Open questions

None at design time. Decisions baked in:
- Placeholder over hide (preserves layout for future BE values).
- N+1 config fetch acceptable for v1 (< 20 bots per user).
- Monitor page stays mock (not in scope).
- Delete `BotsListPage.tsx` rather than keep-as-fallback.
