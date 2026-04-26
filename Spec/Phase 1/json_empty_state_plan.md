# JSON LIVE VIEW — EMPTY STATE PLAN — Phase 1 MVP

> Plan cho **Phương án 1**: tab JSON ở left panel chỉ hiển thị nội dung khi user
> đã bắt đầu setup. Khi 0/4 step `configured` → hiện placeholder thay vì JSON
> đầy defaults gây nhiễu.
>
> Tham chiếu:
> - `src/features/cypheus/JsonLiveView.tsx` (component hiện tại — luôn serialize full state)
> - `src/lib/serializer.ts` (serializer luôn render shape đầy đủ + hằng số)
> - `src/features/bot-builder/store/builder.store.ts` (defaults seed của BuilderState)
> - `Spec/Phase 1/setup_progress_plan.md` (cùng dùng khái niệm `configuredCount` / "empty mode")

---

## 1 · Vấn đề ngắn

`JsonLiveView` hiện tại luôn gọi `JSON.stringify(buildBotPayload(state))` và
`buildStrategyPayload(state)` ngay lúc render đầu tiên. Vì:

1. **Store seed defaults**: `timeframe='5m'`, `leverage=1`, `exchange='binance'`,
   `stakeCurrency='USDT'`, `stakeAmount=100`, `tradingMode='dry-run'`, `marketType='futures'`,
   `marginMode='cross'`, `maxOpenTrades=10`, `dryRunWallet=1000` — đã có sẵn dù user
   chưa chạm.
2. **Serializer hằng số / boilerplate**: `liquidation_buffer`, `process_throttle_secs`,
   `cancel_open_orders_on_exit`, full block `telegram`, full `risk`, full `custom_exit`,
   4 group `signals.entry_long / exit_long / entry_short / exit_short` (kể cả khi
   chưa có condition).

→ Tab JSON xuất hiện ~50–80 dòng "noise" trước khi user kịp gõ gì với Cypheus
hay click card. UX lúng túng: "đây là cái gì? tôi đã làm gì chưa?".

---

## 2 · Mục tiêu (acceptance criteria)

| # | Yêu cầu |
|---|---|
| G1 | Khi 0/4 step `configured` → JSON tab render **empty placeholder**, không hiện JSON code |
| G2 | Khi ≥ 1 step `configured` → JSON tab hoạt động đúng như hiện tại (live preview, copy, download, flash diff) |
| G3 | Chuyển từ empty → có JSON: smooth, không nhảy layout đột ngột; hiệu ứng flash diff không bùng cháy "tất cả dòng đỏ rực" |
| G4 | Empty placeholder có CTA gợi ý hành động (mở Bot Config drawer hoặc nhờ Cypheus) |
| G5 | Copy / Download disable khi empty |
| G6 | Tab vẫn click được (không disable cả tab); chuyển sang JSON khi rỗng vẫn thấy placeholder thân thiện |

---

## 3 · Định nghĩa "đã bắt đầu setup"

```ts
const stepStatus = useBuilderStore((s) => s.stepStatus);
const hasAnyConfigured = (Object.values(stepStatus) as StepStatus[]).some(
  (s) => s === 'configured',
);
```

Lý do dùng `some(... === 'configured')` thay vì `every(... !== 'pending')`:

- `editing` (drawer mở nhưng chưa save) → vẫn coi là chưa bắt đầu thực sự, JSON
  giữ empty cho tới khi user nhấn Save lần đầu. Đỡ chớp tắt khi user mở drawer
  thử rồi đóng.
- `error` chỉ xuất hiện khi `configured` + validator báo lỗi → step đã save một
  lần → có data → tự khắc bị `some(=== 'configured')` cover.

> Ngược lại nếu user **import bundle** (load preset từ file) → các step được set
> `configured` đồng loạt → JSON hiện tự nhiên. Không cần case riêng.

### 3.1 Edge case — magic build đang chạy

Cypheus magic-build script set status từng step thành `configured` lần lượt.
Mỗi lần một step chuyển sang `configured`, `hasAnyConfigured` từ `false` → `true`
ngay khi step đầu tiên được fill xong. Trải nghiệm: empty state → JSON xuất hiện
khi step 1 hoàn thành, sau đó các dòng còn lại update với flash diff bình thường.

**Tránh "first-render flash everything"**: hôm nay `JsonPane` đã có guard
`if (changed.size > 0 && prev.length > 0)` → không flash khi `prev` chưa có. Khi
chuyển từ empty placeholder sang JSON thực, `previousLines.current` vẫn là
`null` (vì `JsonPane` chưa được mount) → lần render đầu của JSON sẽ không flash.
Đảm bảo behavior này không bị thay đổi khi refactor.

---

## 4 · UX placeholder design

### 4.1 Layout proposal

```
┌──── tab: bot.json | strategy.json ────┐
│                                        │
│            [Braces icon dim]           │
│                                        │
│      Your bot's JSON will live here    │
│   Configure a step to see it appear.   │
│                                        │
│   [Open Bot Config]  [Ask Cypheus]     │
│                                        │
│  ─────────  Live preview  ─────────    │
│  Updated nothing yet · Copy · Download │  ← footer disabled
└────────────────────────────────────────┘
```

- Centered placeholder, vertical fill, padding generous.
- Icon: `<Braces>` lucide (cùng icon đang dùng ở tab trigger), dim 30% opacity.
- Heading: `text-sm font-medium text-fg-secondary`
  - i18n key: `cypheus.json.emptyTitle = "Your bot's JSON will live here"`
- Subline: `text-xs text-fg-muted`
  - `cypheus.json.emptySubtitle = "Configure any step to see the live preview."`
- 2 CTA dạng `<Button variant="ghost" size="sm">`:
  1. **Open Bot Config** → `setOpenStep('bot-config')` (nhanh nhất để user bắt đầu)
  2. **Ask Cypheus** → `setPanelTab('cypheus')` (chuyển tab về chat, focus input)
- Footer (Copy / Download / "Updated …"): vẫn render structure giữ chiều cao
  ổn định, nhưng **disabled** Copy + Download và đổi label thành `Live preview`
  (giống hiện tại khi `updatedAt === null`).

### 4.2 Visual consistency với rest của app

- Bg: `bg-canvas` (cùng panel, không nổi bật).
- Border / divider: không đổi.
- Spacing: `py-12 px-6 gap-3 flex-col items-center justify-center`.
- Tabs `bot.json | strategy.json` vẫn render nhưng cả 2 sub-tab cho thấy cùng
  placeholder (khỏi rẽ hai nhánh placeholder gây phân mảnh).

### 4.3 Sub-tab label dim

Khi empty: TabsList vẫn render `bot.json` / `strategy.json` (giữ orientation),
nhưng giảm opacity (e.g. `opacity-60`) để hint "chưa hoạt động". Click vẫn được
— giúp user khám phá. Không disable hoàn toàn để tránh feel "broken".

---

## 5 · Implementation steps

### S1. Refactor `JsonLiveView.tsx` — gate render theo `hasAnyConfigured` (~10 min)

```tsx
export function JsonLiveView() {
  const [tab, setTab] = useState<SubTab>('bot');
  const stepStatus = useBuilderStore((s) => s.stepStatus);
  const hasAnyConfigured = useMemo(
    () => Object.values(stepStatus).some((s) => s === 'configured'),
    [stepStatus],
  );

  if (!hasAnyConfigured) {
    return <JsonEmptyState />;
  }

  // Existing render (Tabs + JsonPane × 2) unchanged.
  …
}
```

Quan trọng:

- **Không** gọi `useBuilderStore()` (whole state) ở root nữa khi đang empty —
  hôm nay nó đăng ký toàn bộ slice, cause re-render mọi update kể cả mode empty.
- Tách phần "có data" thành component con `JsonLiveViewActive` để khi rỗng
  không phải tính `botJson` / `strategyJson` (tiết kiệm CPU + tránh build payload
  với pair='' gây malformed JSON nội bộ — hiện tại không crash nhưng vô ích).

### S2. Tạo `JsonEmptyState.tsx` (~10 min)

File mới: `src/features/cypheus/JsonEmptyState.tsx`

```tsx
import { Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from './store/cypheus.store';
import { strings } from '@/i18n/en';

export function JsonEmptyState() {
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setPanelTab = useCypheusStore((s) => s.setPanelTab);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Braces className="h-10 w-10 text-fg-muted opacity-40" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg-secondary">
          {strings.cypheus.json.emptyTitle}
        </p>
        <p className="text-xs text-fg-muted">
          {strings.cypheus.json.emptySubtitle}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpenStep('bot-config')}
        >
          {strings.cypheus.json.emptyCtaConfig}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPanelTab('cypheus')}
        >
          {strings.cypheus.json.emptyCtaAsk}
        </Button>
      </div>
    </div>
  );
}
```

### S3. Refactor `JsonLiveViewActive` (~10 min)

Tách phần render hiện tại ra component riêng, chỉ mount khi đã có data. Phần
useMemo `botJson` / `strategyJson` chuyển vào trong component này → khi empty
không tính.

```tsx
function JsonLiveViewActive() {
  const [tab, setTab] = useState<SubTab>('bot');
  const state = useBuilderStore();
  const botJson = useMemo(() => JSON.stringify(buildBotPayload(state), null, 2), [state]);
  const strategyJson = useMemo(() => JSON.stringify(buildStrategyPayload(state), null, 2), [state]);
  …
}
```

> Lưu ý: hôm nay `JsonLiveView` subscribe full store qua `useBuilderStore()` —
> kéo theo re-render mỗi khi bất kỳ slice nào đổi (kể cả `openStep`,
> `drawerWidth`). Lúc refactor, có thể tách thêm: chỉ subscribe slices mà serializer
> đọc (`botName, botConfig, strategy, directionForm, closeMethod`). **Optional**, ngoài
> phạm vi plan này nhưng note để tránh regression hiệu năng.

### S4. i18n strings (~3 min)

`src/i18n/en.ts`:

```ts
cypheus: {
  …
  json: {
    emptyTitle: "Your bot's JSON will live here",
    emptySubtitle: 'Configure any step to see the live preview.',
    emptyCtaConfig: 'Open Bot Config',
    emptyCtaAsk: 'Ask Cypheus',
  },
}
```

### S5. Test (~10 min)

File mới: `src/features/cypheus/JsonLiveView.test.tsx`

- **Initial render** (fresh store) → empty state visible, không có `<pre>`
  highlight, không có Copy/Download buttons.
- **After Save một step** (call `setStepStatus('bot-config', 'configured')`) →
  empty state biến mất, JSON pane render với `bot.json` content có
  `bot_name: "Untitled bot"`.
- **Reset** (`resetAll()`) → quay lại empty state.
- **Click "Open Bot Config"** → `openStep === 'bot-config'`.
- **Click "Ask Cypheus"** → `panelTab === 'cypheus'`.

### S6. Manual smoke (~5 min)

1. Refresh app: tab JSON click vào → empty placeholder hiện.
2. Click "Open Bot Config" → drawer mở step Bot Config.
3. Đóng drawer (chưa Save) → JSON tab vẫn empty (vì `editing → pending` trên
   close-without-save).
4. Save 1 step → quay lại JSON tab → JSON xuất hiện với data thực.
5. Cypheus magic build → JSON tab xuất hiện ngay sau step 1, các step kế tiếp
   update với flash xanh bình thường.
6. Click "Create new bot" (reset) → JSON quay lại empty.

### Tổng effort: ~50 min (đủ buffer cho test + cleanup).

---

## 6 · Files affected

**New:**

- `src/features/cypheus/JsonEmptyState.tsx`
- `src/features/cypheus/JsonLiveView.test.tsx`

**Modified:**

- `src/features/cypheus/JsonLiveView.tsx` — gate empty/active, tách `JsonLiveViewActive`.
- `src/i18n/en.ts` — thêm `cypheus.json.empty*` strings.

**Optional (out-of-scope nhưng nên ghi nhận):**

- Refactor `JsonLiveViewActive` để subscribe slice cụ thể thay vì full store.

---

## 7 · Edge cases & polish details

### 7.1 Persisted store có data cũ
Zustand `persist` middleware lưu `stepStatus` xuống localStorage. Reload trang:

- Nếu user phiên trước đã Save ≥ 1 step → `stepStatus` rehydrate có
  `'configured'` → JSON hiển thị data ngay (đúng UX, không cần empty state).
- Nếu phiên cũ chưa save gì → toàn pending → empty state. ✓

### 7.2 Import bundle
`deserializeBundle` (qua ImportDialog) set tất cả slice + `setStepStatus(..., 'configured')` cho mỗi step (cần verify implementation hiện tại). JSON sẽ tự xuất hiện.

> ✅ TODO khi implement: search trong codebase `deserializeBundle` usage để chắc
> chắn import flow có set `stepStatus = 'configured'`. Nếu chưa thì đã là bug
> độc lập với plan này — flag để fix riêng.

### 7.3 Reset bot
`resetAll()` set tất cả `stepStatus` về `'pending'` → empty state hiện trở lại,
không còn flash dữ liệu cũ. ✓

### 7.4 User chỉ ở tab Cypheus, chưa chuyển sang tab JSON
Empty state chỉ tốn render khi user xem JSON tab (nhờ `Tabs` lazy render với
`data-[state=active]:flex`). Nếu user chưa click vào tab JSON, không component
nào của JSON view mount → cost = 0.

### 7.5 Reduced motion
Empty state không có animation, không ảnh hưởng. Khi chuyển từ empty → active,
toàn bộ JSON render lần đầu sẽ KHÔNG flash (xem §3.1) → respect reduce-motion
mặc định.

### 7.6 Theme
Empty state dùng tokens semantic (`text-fg-secondary`, `text-fg-muted`,
`bg-canvas`) → tự động đúng dark theme; nếu sau này có light theme thì cũng
adapt.

---

## 8 · Out of scope (defer)

- **Phương án 2 (progressive serialize)**: render từng phần JSON theo step
  status. Phức tạp hơn nhiều, dễ cho ra JSON không khớp với output cuối khi
  export → confused.
- **Phương án 3 (strip defaults)**: yêu cầu track per-field `isDirty`, refactor
  store. Lợi ích nhỏ với chi phí lớn.
- **Animated transition** (fade từ empty → JSON): nice-to-have, không cần MVP.
- **Tooltip giải thích "Live preview là gì"**: đã có copy đủ rõ; nếu muốn thêm
  thì tạo task riêng.

---

## 9 · Test checklist tổng

- [ ] Fresh load (no persisted data): JSON tab → empty placeholder visible
- [ ] Empty: không có `<pre>`, không có Copy / Download button
- [ ] Empty: 2 CTA "Open Bot Config" + "Ask Cypheus" hoạt động đúng
- [ ] Save 1 step → JSON tab tự render JSON, không flash đỏ "all lines"
- [ ] Reset → empty quay lại
- [ ] Cypheus magic build: empty → active sau step 1, không layout shift đột ngột
- [ ] Import bundle: JSON hiện ngay (không kẹt empty)
- [ ] Persisted state có ≥1 step configured: reload → JSON hiển thị, không empty
- [ ] Reduce-motion: chuyển empty → active không jitter
- [ ] Tab switch trong active mode (`bot.json` ↔ `strategy.json`): vẫn không flash
      everything (giữ guard `previousTab.current` hiện có)

---

## 10 · Commit chia nhỏ đề xuất

```
feat(json): empty state placeholder when no step configured
chore(json): split JsonLiveView into Active + Empty subcomponents
test(json): empty state + transition coverage
i18n: add cypheus.json.empty* strings
```

---

*Plan tuân thủ design system hiện tại, không sửa serializer / store, chỉ thêm
gating layer ở `JsonLiveView`. Khả năng tái sử dụng pattern empty-state này cho
các view khác (live diff khi multi-strategy chưa active, etc.).*
