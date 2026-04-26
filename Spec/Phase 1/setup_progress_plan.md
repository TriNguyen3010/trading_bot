# SETUP PROGRESS INDICATOR — Phase 1 MVP

> Plan cho việc **hiển thị tiến độ setup bot** ngay trên thanh "Send a message…"
> trong left panel (CypheusPanel), để user biết khi nào bot **đã đủ điều kiện
> export / chạy** và còn thiếu bước nào.
>
> Tham chiếu liên quan:
> - `Spec/Phase 1/card_redesign_plan.md` (vừa hoàn tất — cards giờ đã hiển thị
>   inline summary, nhưng user vẫn không biết "khi nào là xong").
> - `src/lib/validator.ts` (`validateBuilder()` cho ra danh sách issue per step).
> - `src/features/cypheus/CypheusPanel.tsx` + `CypheusInput.tsx`.

---

## 1 · Vấn đề

User flow hiện tại:

1. Cypheus chào → user gõ prompt → magic build fill data hoặc user tự click cards.
2. Cards mở drawer, user Save → status `configured` → card border bullish.
3. Nhưng **không có overview**: user phải tự đếm 4 cards xanh hay đỏ, không biết:
   - "Còn step nào pending?"
   - "Có step nào configured nhưng vẫn lỗi (validator complain)?"
   - "Đủ để bấm Export chưa?"
4. HeaderToolbar có nút Export nhưng disable im lặng — user click không phản hồi.

→ Cần một **progress indicator** cho thấy 4 step status realtime + thông báo
"Ready to export" / "Còn N issue" ngay sát chỗ user thao tác Cypheus.

User-supplied placement: **đặt trên text "Send a message…"** trong left panel.
Lý do hợp lý: đây là vùng user nhìn nhất khi đang nhờ Cypheus, và Cypheus chính
là người guide họ qua build flow.

---

## 2 · Mục tiêu (acceptance criteria)

| # | Yêu cầu |
|---|---|
| G1 | Mọi lúc, user thấy "X / 4 steps configured" + visual progress |
| G2 | Khi `validateBuilder()` báo issue → progress widget surface count + cho phép click vào step lỗi để mở drawer |
| G3 | Khi 0 issue và 4/4 configured → state "Ready to export" với CTA primary |
| G4 | Click vào step indicator (pill / dot) → mở drawer đúng step đó (giống click card) |
| G5 | Reactive: chỉnh data trong drawer / Cypheus magic-fill → progress cập nhật instant |
| G6 | Không che chat history (CypheusChat scrollable area vẫn đủ chỗ) |
| G7 | Reduce-motion friendly, không animate vô tội vạ |

---

## 3 · Anatomy widget — `<SetupProgress />`

### 3.1 Vị trí trong DOM

```
CypheusPanel
└── Tabs[value=cypheus]
    ├── CypheusChat                      ← scrollable
    └── footer (border-t, bg-canvas)
        ├── 🆕 SetupProgress             ← MỚI, đặt trên input
        ├── CypheusInput ("Send a message…")
        └── CreateNewBotButton
```

Lý do đặt **trên** `CypheusInput`, **không** trong CypheusChat:
- Luôn visible, không scroll out of view khi chat dài.
- Sticky tự nhiên vì đã ở footer area.
- Liền mạch hành động: "Tôi sắp nói với Cypheus điều gì để hoàn thành nốt
  X bước còn lại".

### 3.2 Visual states

Widget có 4 trạng thái chính, render theo `progress = configured/4` và `issues`:

#### A. State `empty` (0/4 configured, no data)
```
┌────────────────────────────────────────────────────┐
│ ◯ ◯ ◯ ◯    Set up your bot to get started   │  collapse
└────────────────────────────────────────────────────┘
```
- 4 dot pending (CircleDashed).
- Microcopy nhẹ nhàng, không "đỏ"/cảnh báo gì.

#### B. State `in_progress` (1–3/4 configured, hoặc đang có issue)
```
┌────────────────────────────────────────────────────┐
│ ● ● ◯ ◯    2 / 4 steps configured · 1 issue       │
│ [Bot config] [Entry] [Direction] [Close]           │  ← clickable pills
└────────────────────────────────────────────────────┘
```
- 4 dot nhỏ (đã configured = bullish, editing = brand pulse, error = danger, pending = muted).
- Counter "X / 4 steps configured".
- Nếu issues > 0: thêm "· N issue(s)" với danger color.
- Optional row 2: 4 step pill names compact, click mở drawer.

#### C. State `ready` (4/4 configured, 0 issue)
```
┌────────────────────────────────────────────────────┐
│ ● ● ● ●    Ready to export      [Export bot →]    │  bullish accent
└────────────────────────────────────────────────────┘
```
- 4 dot bullish full.
- CTA "Export bot →" primary brand button → trigger export dialog (cùng action với HeaderToolbar Export).
- Subtle bullish glow border (giống cards configured).

#### D. State `error` (4/4 configured but validator vẫn còn issue)
```
┌────────────────────────────────────────────────────┐
│ ● ! ● ●    1 issue blocks export                   │
│ → Entry: Add at least one entry condition          │  ← truncate, click to fix
└────────────────────────────────────────────────────┘
```
- Step có lỗi: dot icon `AlertTriangle` danger.
- Hiện text first issue (truncate), full text trong tooltip.
- CTA secondary "Fix" → setOpenStep(stepId of first issue).

### 3.3 Layout chi tiết (1 row main + 1 row sub)

```tsx
<div className="border-t border-border-subtle bg-canvas px-4 py-2.5">
  {/* Row 1: dots + counter + CTA */}
  <div className="flex items-center gap-3">
    <DotsRow status={statusByStep} />          // 4 dot tròn nhỏ
    <span className="flex-1 text-xs text-fg-secondary">
      {labelText}                              // copy theo state
    </span>
    {ctaSlot}                                  // Export | Fix | null
  </div>

  {/* Row 2: optional — only when in_progress hoặc error */}
  {showStepPills && (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {STEPS.map(step => (
        <StepProgressPill stepId={step.id} … />
      ))}
    </div>
  )}
</div>
```

### 3.4 Visual tokens (tuân theo `tokens.css`)

| Element | Token / class |
|---|---|
| Container bg | `bg-canvas` (cùng với CypheusInput area) |
| Top border | `border-t border-border-subtle` |
| Dot pending | `bg-surface-active text-fg-muted` |
| Dot configured | `bg-bullish/15 text-bullish` |
| Dot editing | `bg-brand-subtle text-brand animate-pulse` (respect reduced motion) |
| Dot error | `bg-bearish-subtle text-bearish` |
| Counter text | `text-xs text-fg-secondary` |
| Issue text | `text-xs text-bearish truncate` |
| Ready text | `text-xs text-bullish font-medium` |
| CTA Export | `<Button variant="primary" size="sm">` |
| CTA Fix | `<Button variant="ghost" size="sm" tone="bearish">` |

---

## 4 · State / data wiring

### 4.1 Inputs

```ts
const stepStatus = useBuilderStore((s) => s.stepStatus);
const openStep   = useBuilderStore((s) => s.openStep);
const state      = useBuilderStore();             // for validateBuilder
const issues     = useMemo(() => validateBuilder(state), [state]);
```

### 4.2 Derived

```ts
const configuredCount = (Object.values(stepStatus) as StepStatus[])
  .filter((s) => s === 'configured').length;

const issueByStep = groupBy(issues, (i) => i.stepId);

// Visual status per step (cùng logic StepCard):
const visualStatusOf = (id: StepId): StepStatus => {
  if (stepStatus[id] === 'configured' && issueByStep[id]?.length) return 'error';
  if (openStep === id && stepStatus[id] === 'pending') return 'editing';
  return stepStatus[id];
};

// Top-level state machine:
let mode: 'empty' | 'in_progress' | 'error' | 'ready';
if (configuredCount === 0 && issues.length === 0) mode = 'empty';
else if (configuredCount === 4 && issues.length === 0) mode = 'ready';
else if (issues.length > 0)                        mode = 'error';
else                                                mode = 'in_progress';
```

### 4.3 Actions

```ts
const setOpenStep = useBuilderStore((s) => s.setOpenStep);

const handlePillClick = (id: StepId) => setOpenStep(id);

// Export action — share với HeaderToolbar (refactor nếu cần):
const handleExport = () => useExportFlow().open();   // dialog đã có
```

> Nếu Export action chưa được hoist ra hook reuse được, mở 1 task con: refactor
> `HeaderToolbar` Export trigger thành `useExportDialog()` shared store flag.

---

## 5 · Implementation steps

### S1. Tạo component skeleton (~10 min)
File mới: `src/features/cypheus/SetupProgress.tsx`
- Props: none (đọc store).
- Render: 1 row dots + counter + CTA, 1 row pills (conditional).

### S2. Component con (~15 min)

```
src/features/cypheus/setup-progress/
├── SetupProgress.tsx         (root, state machine, layout)
├── ProgressDots.tsx          (4 colored dots, status driven)
├── StepProgressPill.tsx      (clickable pill, status colors)
└── progress.types.ts         (ProgressMode, helpers groupBy if needed)
```

`ProgressDots`: render 4 `<span>` size 8x8 rounded-full với background theo status.
`StepProgressPill`: button h-6 px-2 text-xs, mở drawer khi click. Show step short
name (Bot, Entry, Direction, Close) + status icon ở leading.

### S3. Wire vào CypheusPanel (~5 min)
File: `src/features/cypheus/CypheusPanel.tsx`
- Import `SetupProgress`.
- Render trong cypheus tab footer, **trước** `CypheusInput`:
```tsx
<div className="border-t border-border-subtle bg-canvas">
  <SetupProgress />
  <CypheusInput onSubmit={handleUserSubmit} disabled={inputDisabled} />
  <div className="px-4 pb-3">
    <CreateNewBotButton />
  </div>
</div>
```
- Bỏ border-t khỏi `CypheusInput` outer wrapper (nay đã có ở SetupProgress).

### S4. Export CTA wiring (~10 min)
- Tách `useExportDialog` hook (hoặc đơn giản: lift `exportOpen` state lên store).
- Import vào cả `HeaderToolbar` và `SetupProgress`.

### S5. i18n strings (~5 min)
File: `src/i18n/en.ts`
```ts
cypheus: {
  ...
  progress: {
    empty: 'Set up your bot to get started',
    inProgress: '{configured} / 4 steps configured',
    issues: '{count, plural, one {# issue} other {# issues}}',
    ready: 'Ready to export',
    fix: 'Fix',
    export: 'Export bot',
  },
}
```
Format helper đơn giản template literal — chưa cần i18next.

### S6. Reduce-motion (~5 min)
- Brand pulse dot: bọc bằng `motion-safe:animate-pulse` (Tailwind built-in).
- Width / opacity transitions: 150ms `ease-out-quick`, skip nếu `prefers-reduced-motion`.

### S7. Tests (~15 min)
File: `src/features/cypheus/setup-progress/SetupProgress.test.tsx`
- Test state matrix: empty / partial / partial+issue / all-configured+issue / ready.
- Test click pill → setOpenStep called với đúng id.
- Test Export CTA chỉ hiện ở `ready` mode.

### Tổng effort: ~65 min.

---

## 6 · Files affected (summary)

**New:**
- `src/features/cypheus/setup-progress/SetupProgress.tsx`
- `src/features/cypheus/setup-progress/ProgressDots.tsx`
- `src/features/cypheus/setup-progress/StepProgressPill.tsx`
- `src/features/cypheus/setup-progress/progress.types.ts`
- `src/features/cypheus/setup-progress/SetupProgress.test.tsx`

**Modified:**
- `src/features/cypheus/CypheusPanel.tsx` — mount `<SetupProgress />` trên `<CypheusInput />`.
- `src/features/cypheus/CypheusInput.tsx` — bỏ `border-t` khỏi top (bây giờ ở SetupProgress).
- `src/i18n/en.ts` — thêm progress strings.
- `src/features/bot-builder/components/HeaderToolbar.tsx` — refactor export trigger để share (nếu chọn approach lift state).

---

## 7 · Edge cases & UX details

### 7.1 Empty cards nhưng `botName` đã đặt
- Vẫn coi là `empty` (chưa step nào configured). Tương lai có thể check `botName !== 'Untitled bot'` để hint.

### 7.2 Magic build đang chạy (`state === 'building'`)
- SetupProgress render bình thường nhưng disable click (pointer-events-none) tránh user race với script.
- Có thể overlay subtle text "Cypheus is building…" thay vì counter, hiển thị shimmer effect.

### 7.3 User mở drawer nhưng chưa Save
- Step status = `pending` (vì Save mới set `configured`).
- Visual: pill cho step đó animate brand (editing).
- Khi đóng drawer mà chưa Save: status quay về `pending` → progress giảm lại.

### 7.4 Long issue text
- Truncate 1 dòng, full text trong tooltip (`title=` hoặc Radix Tooltip).
- Click toàn dòng → mở drawer step lỗi.

### 7.5 Drawer mở (left panel layout)
- SetupProgress nằm trong **left panel** (cố định 400px), drawer mở/đóng không ảnh hưởng layout này.
- Đây là điểm cộng so với đặt nó trong canvas: luôn visible bất kể drawer state.

### 7.6 Cypheus chat đang scroll
- SetupProgress là footer non-scroll → không che chat history mà cũng không bị che.

### 7.7 Mobile / narrow panel (Phase 2)
- Currently fixed 400px panel — không cần lo. Nếu sau này có narrow mode: row 2 pills wrap; counter rút xuống "X/4".

---

## 8 · Test checklist

- [ ] Initial render (no data): "Set up your bot to get started", 4 dim dots
- [ ] Sau khi save Bot Config: "1 / 4 steps configured", dot 1 bullish, pill row hiện
- [ ] Save tất cả 4: counter "Ready to export" + Export CTA primary visible
- [ ] Cố tình bỏ trống TP levels khi type=tp_sl & save: dot Close → error, "1 issue blocks export"
- [ ] Click pill "Entry" → drawer mở step entry
- [ ] Magic build chạy: thấy progress tăng dần 1→4, không nhấp nháy lung tung
- [ ] Mở drawer 1 step → pill đó pulse brand
- [ ] Đóng drawer chưa save → pill quay về pending
- [ ] Reduce-motion ON: pulse dot không animate, không jitter
- [ ] Click Export CTA: mở Export dialog (cùng dialog của HeaderToolbar)
- [ ] CreateNewBotButton vẫn render đúng vị trí dưới CypheusInput
- [ ] CypheusChat scroll vẫn ổn, không bị SetupProgress che

---

## 9 · Out of scope (defer)

- **Per-step health bar** (e.g. "Bot Config 80% complete") — phức tạp, MVP đủ với 4 trạng thái rời rạc.
- **Animated checkmark khi 4/4 đạt** (confetti / sweep) — nice-to-have, để Phase 2.
- **Inline tip "Cypheus có thể giúp bạn fix"** với gợi ý prompt — Phase 2, gắn vào script-runner.
- **Multi-strategy progress** (khi có Entry Strategy 2, 3…) — defer, MVP single strategy.

---

## 10 · Đề xuất commit chia nhỏ

```
feat(progress): add SetupProgress widget skeleton + dots
feat(progress): wire validator + step status derivation
feat(progress): clickable step pills open drawer
feat(progress): Ready state with Export CTA
chore(cypheus): mount SetupProgress above CypheusInput
test(progress): state matrix + interaction tests
```

---

*Plan này không phá vỡ flow hiện có (cards canvas, drawer, Cypheus chat). Chỉ
thêm 1 layer thông tin tổng quan, render trong vùng user đã quen nhìn (sát input
Cypheus).*
