# Drawer Sequential Progression – Setup → Configure

> Plan: trong right drawer của mỗi step (Bot Config / Entry Strategy / Direction & Order / Close Method), 2 tab **Setup** và **Configure** phải đi **lần lượt**. User thấy tiến trình rõ ràng. **Setup chưa xong → không cho save, không cho qua step kế.**

- **Ngày:** 2026-04-26
- **Liên quan:** `ux_design_spec.md` mục 6.3 (Setup vs Configure phân chia)
- **Status:** Plan, áp dụng cho cả 4 drawer step

---

## 1. Concept

Drawer hiện tại có 2 tab tự do switch (Setup / Configure). Đổi thành **wizard tuần tự**:

```
Setup (required)  →  Configure (optional)  →  Save
   GATE                advanced               final
```

**Quy tắc:**
1. **Setup là cổng** – tất cả field bắt buộc phải xong mới unlock tiếp.
2. **Configure tab khoá** cho tới khi Setup pass validation.
3. **Save / Save & Next disabled** khi Setup chưa xong.
4. User vẫn có thể **save sớm** sau khi xong Setup, không bắt buộc làm Configure (vì Configure là advanced).

---

## 2. Progress indicator – visualize tiến trình

### 2.1 Sub-step indicator ở header drawer

Đặt ngay dưới drawer title, trên 2 tab:

```
┌────────────────────────────────────────────────┐
│  STEP 1: Bot Config                    [×]     │
├────────────────────────────────────────────────┤
│                                                │
│  ●━━━━━━━━━━━○                                 │
│  Setup       Configure                         │
│  active      locked                            │
│                                                │
│  ┌─ Setup ──┐ ┌─ Configure 🔒 ─┐              │
│  │ active   │ │   disabled     │              │
│  └──────────┘ └────────────────┘              │
│                                                │
│  [form fields cho tab active]                  │
│                                                │
│  ──────────────────────────────                │
│  [Cancel]            [Continue →]              │
└────────────────────────────────────────────────┘
```

**Sau khi Setup pass validation:**

```
│  ●━━━━━━━━━━━●                                 │
│  Setup ✓     Configure                         │
│  done        active                            │
│                                                │
│  ┌─ Setup ✓ ┐ ┌─ Configure ──┐                │
│  │ done     │ │   active     │                │
│  └──────────┘ └──────────────┘                │
```

### 2.2 Spec progress indicator

| Element | State pending | State active | State done |
|---|---|---|---|
| **Dot trái (Setup)** | `○` xám | `●` vàng pulse | `●` xanh ✓ |
| **Connector line** | xám đứt nét | xám đứt nét | xanh liền nét |
| **Dot phải (Configure)** | `○` xám | `●` vàng pulse | `●` xanh ✓ |
| **Label** | gray-400 | brand-primary | success-500 |

---

## 3. Tab lock behavior

### 3.1 Setup tab – luôn accessible

Click bất cứ lúc nào → switch sang Setup, không có lock.

### 3.2 Configure tab – locked default

| State Setup | Configure tab |
|---|---|
| Chưa fill | Disabled, icon 🔒 cạnh label, hover tooltip "Complete Setup first" |
| Đang fill (chưa pass) | Disabled, tooltip "Complete required fields in Setup" |
| Pass validation ✓ | **Unlock** với animation glow vàng 600ms (gợi user click sang) |
| Đã từng pass nhưng user quay lại Setup và làm hỏng (vd. xoá field required) | **Lock lại**, Configure data vẫn giữ nhưng tab disabled cho tới khi Setup OK lại |

### 3.3 Click Configure khi locked

→ **Toast nhẹ** ở góc: *"Complete Setup first to unlock Configure"*. Hoặc inline message phía dưới tab.

---

## 4. Footer button states – 4 phase

### Phase 1: Setup chưa fill / fill chưa xong

```
┌──────────────────────────────────────────┐
│  [Cancel]                  [Continue →]  │
│                            ↑ DISABLED    │
│                            tooltip:      │
│                            "Complete the │
│                            required      │
│                            fields"       │
└──────────────────────────────────────────┘
```

- `Cancel`: enabled
- `Continue →`: disabled, tooltip giải thích lý do
- **Không có** Save / Save & Next ở phase này

### Phase 2: Setup pass validation, đang ở Setup tab

```
┌──────────────────────────────────────────┐
│  [Cancel]   [Skip & Save]  [Continue →] │
│             gray secondary  primary CTA  │
└──────────────────────────────────────────┘
```

- `Cancel`: enabled
- **`Skip & Save`** (gray): cho phép user lưu chỉ với Setup, bỏ qua Configure
- **`Continue →`** (primary CTA): chuyển sang Configure tab

### Phase 3: Đang ở Configure tab (sau khi Setup ✓)

```
┌──────────────────────────────────────────┐
│  [← Back]   [Save]    [Save & Next →]   │
│  go Setup   gray      primary CTA        │
└──────────────────────────────────────────┘
```

- `← Back`: quay lại Setup tab
- `Save`: lưu step này, đóng drawer
- `Save & Next →`: lưu step này + auto mở drawer step kế tiếp

### Phase 4: Step cuối (Close Method)

Phase 3 nhưng `Save & Next →` đổi thành `Save & Finish` (đóng drawer, không có step kế).

---

## 5. Validation rules cho Setup

### 5.1 Khi nào Setup được coi là "pass"?

**Tất cả field marked `*` (required) phải:**
- Có giá trị (không empty/null).
- Pass Zod schema validation.

Vd. Bot Config Setup:
- Pair *: chọn từ dropdown (không empty).
- Timeframe *: chọn từ dropdown.
- Trading mode *: 1 option đã chọn.
- Leverage *: số trong range 1-125.

→ Khi tất cả OK → trigger `setupComplete = true` → unlock Configure + enable button.

### 5.2 Validation timing

- **On blur** từng field: hiện lỗi inline nếu invalid.
- **Live re-check** khi user gõ tiếp: nếu trước đó báo lỗi, user sửa thành valid → dấu lỗi biến mất.
- **Aggregate check** sau mỗi field change: cập nhật `setupComplete` để trigger unlock UI.

### 5.3 Visual feedback live

- Khi 3/4 field xong, 1/4 còn thiếu → indicator "1 field remaining" dưới progress bar.
- Khi 4/4 xong → indicator chuyển "Setup complete ✓" + Configure unlock animation.

---

## 6. Apply cho cả 4 step

Logic giống nhau, chỉ khác field nào là required:

| Step | Setup required fields | Configure (optional) |
|---|---|---|
| **1. Bot Config** | Pair, Timeframe, Trading mode, Leverage | Exchange, Spot/Futures, Margin mode, Max open trades, API key, Telegram |
| **2. Entry Strategy** | Candlestick chips ≥1, Indicator ≥1, Condition ≥1 | Custom indicator timeframe, Lookback default |
| **3. Direction & Order** | Direction, Order type | Limit offset (chỉ khi Limit), Slippage |
| **4. Close Method** | Method type chọn (Manual/TP-SL/Indicator/ROI), basic params | ROI steps, Trailing options, Exit profit only |

### Special case: Manual close method
Nếu user chọn Method type = Manual → không cần fill thêm gì. Setup pass ngay lập tức.

---

## 7. Tác động lên Step List bên ngoài

Step card phía bên trái cũng nên phản ánh tiến trình:

| Step state | Card visual |
|---|---|
| Chưa mở | `⚪ Step N` xám |
| Đang ở Setup phase | `◐ Step N` half-fill vàng (showing in-progress) |
| Setup ✓ chưa save | `◑ Step N` 3/4-fill |
| Đã save (Setup hoặc Setup+Configure) | `✓ Step N` xanh full |
| Có lỗi (vd. user save xong rồi quay lại đổi pair → invalid) | `! Step N` đỏ |

→ Tạo sense **liên kết** giữa drawer progress và step list progress.

---

## 8. Edge cases

| Tình huống | Behavior |
|---|---|
| User fill Setup xong → click Cancel | Drawer đóng, state KHÔNG save. Step card về `⚪`. |
| User fill Setup xong → switch sang Configure → fill 1 field → Cancel | Drawer đóng, step card về `⚪`. |
| User Save sau Setup (Phase 2 Skip & Save) | Step ✓, Configure data = default. User mở lại có thể fill Configure sau. |
| User mở step đã save → Setup vẫn pass → Configure tab unlock ngay (không cần fill lại) | OK, vì state đã save. |
| User mở step đã save → đổi 1 field Setup thành invalid | Configure tab **lock lại**, button đổi về "Continue →" disabled. Configure data giữ trong store nhưng không cho qua tab. |
| Magic build (Cypheus) | Cypheus auto-fill cả Setup + Configure → both tabs ✓ instant. Drawer summary view khi xong. (Không qua wizard flow này, chỉ áp dụng cho manual edit.) |
| User keyboard `Tab` từ Setup field cuối | Focus next focusable: nếu Configure locked → focus Continue button. |
| Mobile / viewport hẹp | Progress indicator stack vertical. Tabs vẫn 2 cột nhỏ. |

---

## 9. Implementation

### 9.1 Component structure

```tsx
// StepDrawer.tsx
function StepDrawer({ stepId }: Props) {
  const [activeTab, setActiveTab] = useState<'setup' | 'configure'>('setup')
  const [setupComplete, setSetupComplete] = useState(false)

  // Validate setup fields whenever form values change
  useEffect(() => {
    const valid = validateSetup(stepId, formValues)
    setSetupComplete(valid)
    // Auto-relock configure if user broke setup
    if (!valid && activeTab === 'configure') setActiveTab('setup')
  }, [formValues, stepId])

  return (
    <Sheet>
      <SheetHeader>
        <SheetTitle>STEP {stepId}: {stepName}</SheetTitle>
        <ProgressIndicator
          activeTab={activeTab}
          setupComplete={setupComplete}
        />
      </SheetHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger
            value="configure"
            disabled={!setupComplete}
            title={!setupComplete ? 'Complete Setup first' : ''}
          >
            Configure {!setupComplete && <Lock size={14} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <SetupForm stepId={stepId} />
        </TabsContent>

        <TabsContent value="configure">
          <ConfigureForm stepId={stepId} />
        </TabsContent>
      </Tabs>

      <SheetFooter>
        <DrawerFooter
          activeTab={activeTab}
          setupComplete={setupComplete}
          onCancel={...}
          onContinue={() => setActiveTab('configure')}
          onBack={() => setActiveTab('setup')}
          onSkipSave={...}
          onSave={...}
          onSaveAndNext={...}
        />
      </SheetFooter>
    </Sheet>
  )
}
```

### 9.2 Progress indicator component

```tsx
function ProgressIndicator({ activeTab, setupComplete }: Props) {
  return (
    <div className="progress-indicator">
      {/* Dot 1 - Setup */}
      <div className={cn('dot', setupComplete ? 'done' : activeTab === 'setup' ? 'active' : 'pending')}>
        {setupComplete ? <Check size={10} /> : null}
      </div>

      {/* Connector */}
      <div className={cn('connector', setupComplete && 'done')} />

      {/* Dot 2 - Configure */}
      <div className={cn('dot', activeTab === 'configure' ? 'active' : 'pending')} />

      <div className="labels">
        <span className={setupComplete ? 'done' : 'active'}>Setup</span>
        <span className={setupComplete ? 'active' : 'locked'}>Configure</span>
      </div>
    </div>
  )
}
```

### 9.3 Validation helper

```ts
// lib/validator.ts
export function validateSetup(stepId: number, values: any): boolean {
  switch (stepId) {
    case 1: return botConfigSetupSchema.safeParse(values).success
    case 2: return entryStrategySetupSchema.safeParse(values).success
    case 3: return directionSetupSchema.safeParse(values).success
    case 4: return closeMethodSetupSchema.safeParse(values).success
  }
}
```

Tách Zod schema thành `*SetupSchema` (required) và `*FullSchema` (Setup + Configure).

---

## 10. Tooltip & micro-copy

**Tooltip cho Configure tab khi locked:**
> Complete Setup first

**Tooltip cho Continue button khi disabled:**
> Fill all required fields in Setup

**Tooltip cho Skip & Save:**
> Save with default Configure values. You can edit later.

**Toast khi user click Configure tab locked:**
> Complete Setup to unlock Configure

**Inline message dưới progress indicator (Phase 1):**
> 1 of 4 fields completed in Setup

---

## 11. Acceptance criteria

- [ ] Drawer header có progress indicator 2 dot + connector + label.
- [ ] Setup tab luôn accessible.
- [ ] Configure tab disabled (icon 🔒) khi Setup chưa pass.
- [ ] Configure unlock với animation glow vàng 600ms khi Setup pass.
- [ ] Setup pass = tất cả required field valid theo Zod schema.
- [ ] Footer button đúng theo 4 phase (xem mục 4).
- [ ] Click Configure khi locked → toast "Complete Setup first".
- [ ] Skip & Save chỉ hiện khi Setup pass, đang ở Setup tab.
- [ ] User break Setup sau khi pass → Configure relock + button quay về phase 1.
- [ ] Step card bên trái phản ánh state đúng (pending / in-progress / done).
- [ ] Magic build Cypheus không qua flow này (auto-fill cả 2 tab).
- [ ] Keyboard navigation: Tab từ field cuối Setup → focus Continue button khi enable.
- [ ] Reduced motion: bỏ glow unlock animation, chỉ đổi style state.

---

*End of plan.*
