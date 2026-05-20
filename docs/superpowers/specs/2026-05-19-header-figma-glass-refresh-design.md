# Design — HeaderToolbar Figma Glass Refresh

> **Mục tiêu:** Refresh visual chrome của `HeaderToolbar` (component duy nhất ở `BuilderPage`) sang glassmorphism style theo Figma. Giữ nguyên content + structure bên trong + interaction.
>
> **Created:** 2026-05-19
> **Owner:** Tri Nguyen
> **Status:** Design — pending implementation plan
> **Scope:** 1 component, ~1 line diff (className của outer wrapper)

---

## 0. Bối cảnh

Figma export CSS mới cho header:

```css
display: flex;
max-width: 1200px;
padding: var(--l-spacing-12, 12px) var(--spacing-12, 12px) var(--l-spacing-12, 12px) var(--spacing-16, 16px);
justify-content: space-between;
align-items: center;
flex: 1 0 0;

border-radius: var(--radius-circle, 98px);
border: 1px solid var(--gradient-border, rgba(255, 255, 255, 0.08));
background: var(--alias-background-alpha, rgba(255, 255, 255, 0.05));
box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.15);
backdrop-filter: blur(calc(var(--blur-bold, 200px) / 2));
```

Hiện tại `HeaderToolbar.tsx` dùng class `card-coin98` (gradient dark đặc) — **không phải glass**. Class này dùng ở 8 file khác (Cypheus, MessageBubble, MonitoringPage) → **không được sửa global**, chỉ thay ở HeaderToolbar.

---

## 1. Quyết định chốt

| Hạng mục | Lựa chọn |
|----------|----------|
| Scope | **Chỉ HeaderToolbar.tsx** outer wrapper. Không động content/children. |
| Implementation style | **Inline Tailwind arbitrary values** (Approach A). Không tạo utility class mới, không sửa `tailwind.config.ts`. |
| `card-coin98` global | **Giữ nguyên** — chỉ remove khỏi HeaderToolbar. 8 chỗ khác giữ gradient dark cũ. |
| Tokens semantic | **Inline values**, không thêm CSS var. Lý do: 1 component dùng, premature abstraction. Future redesign → cân nhắc B/C. |
| Tương tác wallet-auth (Task 10.5) | **Không conflict** — Task 10.5 sửa content (avatar/logout), task này sửa chrome. Có thể merge song song. |
| max-width | 1200px (theo Figma) — giảm từ 1400px hiện tại |
| Backdrop blur strength | 100px (Figma's `calc(--blur-bold / 2)`) |

---

## 2. Architecture overview

**1 file modify**: `src/features/bot-builder/components/HeaderToolbar.tsx`.

Cụ thể: outer `<div>` (dòng 96 hiện tại) đổi `className`. Component structure, props, hooks, children all unchanged.

**0 file create.** **0 file delete.**

---

## 3. Diff

### Before (dòng 96)

```tsx
<div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 rounded-full card-coin98 px-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
```

### After

```tsx
<div className="
  mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3
  rounded-full
  border border-white/[0.08]
  bg-white/[0.05]
  py-3 pr-3 pl-4
  shadow-[0_8px_24px_rgba(0,0,0,0.15)]
  backdrop-blur-[100px]
">
```

(Single line trong code thực, multi-line ở spec để dễ đọc.)

### Mapping Figma → Tailwind

| Figma property | Figma value | Tailwind | Ghi chú |
|---|---|---|---|
| `max-width` | 1200px | `max-w-[1200px]` | Giảm từ 1400 hiện tại |
| `padding` | `12px 12px 12px 16px` | `py-3 pr-3 pl-4` | T/B = 12px (`py-3`), R = 12px (`pr-3`), L = 16px (`pl-4`) |
| `border-radius` | 98px (token `--radius-circle`) | `rounded-full` | `rounded-full` (= 9999px) tương đương về visual cho element này (height ~40-48px < 98px*2) |
| `border` | `1px solid rgba(255,255,255,0.08)` | `border border-white/[0.08]` | |
| `background` | `rgba(255,255,255,0.05)` | `bg-white/[0.05]` | |
| `box-shadow` | `0 8px 24px rgba(0,0,0,0.15)` | `shadow-[0_8px_24px_rgba(0,0,0,0.15)]` | Nhẹ hơn shadow cũ (0.15 vs 0.45) |
| `backdrop-filter` | `blur(100px)` (calc 200/2) | `backdrop-blur-[100px]` | Tailwind max preset `backdrop-blur-3xl` = 64px → phải dùng arbitrary |

### Removed
- `card-coin98` — không phù hợp (gradient dark đặc, không phải glass).
- `px-3 py-1.5` — thay bằng `py-3 pr-3 pl-4` (Figma asymmetric padding).
- `shadow-[0_4px_24px_rgba(0,0,0,0.45)]` — thay bằng Figma's nhẹ hơn.
- `max-w-[1400px]` → `max-w-[1200px]`.

### Unchanged
- `mx-auto flex items-center justify-between gap-3 w-full` — layout primitives.
- `rounded-full` — pill shape vẫn được giữ.
- Children: Logo, saved time, User popover, CreateNewBotButton, MyBotsButton, Backtest button, Import button, Export button.

---

## 4. Visual concerns & trade-offs

### 4.1. Glass vs solid background

Header hiện tại có background đặc (gradient dark) → user thấy header "tách biệt" rõ với canvas behind. Glass version sẽ "blend" hơn → có thể trông lighter hoặc less prominent.

**Mitigation cần verify lúc preview:**
- Border `rgba(255,255,255,0.08)` đủ contrast để delineate header khỏi canvas không?
- Backdrop-blur 100px có "blur" được dot grid pattern (`DotGridSpotlight`) bên dưới đủ mượt không?
- Shadow `0 8px 24px rgba(0,0,0,0.15)` đủ nâng header lên khỏi background không?

→ **Decision**: implement xong → preview trực tiếp → nếu cần tinh chỉnh thì làm 1 follow-up PR. Không over-engineer ngay.

### 4.2. Backdrop-blur performance

`backdrop-filter: blur(100px)` là **GPU heavy** trên mobile/low-end devices. Đặc biệt khi user scroll content phía sau (canvas có animations).

**Mitigation:**
- Header là sticky/fixed → không cần blur khi user không scroll. Modern browsers optimize sẵn.
- 100px blur strength rất cao — hầu hết design dùng 8-24px. Nếu thấy lag, giảm xuống `backdrop-blur-2xl` (40px) hoặc `backdrop-blur-3xl` (64px).

→ **Verify lúc smoke test trên Chrome DevTools "CPU throttle 4x"**.

### 4.3. Tương tác với wallet-auth migration (Task 10.5)

Task 10.5 trong plan wallet-auth (commit `b3d8b2f` trên main) sẽ:
- Đổi `useAuthStore` → `useWalletStore` trong HeaderToolbar.tsx
- Đổi `authUser?.email` → `shortenAddress(user?.wallet_address)`
- Đổi logout handler navigate `/login` → `/connect` + thêm `await disconnect()`

→ Task này chỉ sửa **outer `<div>` className**, không động content. **Không conflict** với Task 10.5. Có thể merge song song hoặc theo thứ tự bất kỳ.

### 4.4. Test impact

`HeaderToolbar.test.tsx` test behavior (button click, tooltip render). Không assert className/style. → Test pass nguyên.

---

## 5. Testing strategy

| Layer | Type | Tool | Coverage |
|---|---|---|---|
| Visual | Manual | Browser ở `/builder` | Header có frosted glass effect, blend với canvas/dot-grid bên dưới |
| Performance | Manual | Chrome DevTools CPU throttle 4x | Backdrop-blur không gây lag khi scroll/interact |
| Regression | Automated | `pnpm test` | `HeaderToolbar.test.tsx` vẫn pass (behavior unchanged) |
| Static | Automated | `pnpm typecheck` + `pnpm lint` | No type/lint errors |

---

## 6. Migration steps (tóm tắt — chi tiết ở implementation plan)

1. Edit `HeaderToolbar.tsx` outer `<div>` className.
2. Run `pnpm typecheck` + `pnpm lint` + `pnpm test`.
3. `pnpm dev` → mở `/builder` → visual smoke test.
4. Throttle CPU 4x → scroll/interact → confirm no jank.
5. Commit + push.

---

## 7. Future considerations (KHÔNG làm ở phase này)

- **Extract `.glass-pill` utility class** vào `tokens.css` — chỉ làm khi có component thứ 2 (vd: `BotMonitoringPage` header line 519) cần style giống.
- **Sync Figma design tokens** vào `tokens.css` — `--spacing-12`, `--radius-circle`, `--blur-bold`, `--gradient-border`, `--alias-background-alpha`. Chỉ làm khi design team đẩy đầy đủ token map.
- **Theme variants** — Figma có thể có light theme sau này. Hiện app dark-only → bỏ qua.

---

## 8. Definition of Done

- [ ] `HeaderToolbar.tsx` outer `<div>` đã có className mới theo §3
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS
- [ ] `pnpm test` PASS (`HeaderToolbar.test.tsx` không break)
- [ ] `pnpm dev` → mở `/builder` → header hiện thị đúng glass effect, không vỡ layout
- [ ] CPU throttle 4x → scroll/click các button trong header → smooth, không jank đáng kể
- [ ] Commit message theo convention: `style(header): apply Figma glass refresh per spec`

---

## 9. Out of scope

- ❌ Sửa `card-coin98` global (8 file khác giữ nguyên)
- ❌ Sửa `BotMonitoringPage` header (line 519) dù layout pattern giống
- ❌ Thêm CSS variable / utility class mới
- ❌ Đổi `tailwind.config.ts`
- ❌ Đổi content/structure HeaderToolbar (children unchanged)
- ❌ Wallet-auth migration content changes (đã có Task 10.5 riêng)
