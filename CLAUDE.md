# CLAUDE.md — Onboarding cho người mới (hoặc AI agent)

> **Audience:** Dev mới join project HOẶC AI agent (Claude/Copilot) cần context để code.
> **Đọc xong file này:** nắm được app làm gì, code ở đâu, quy ước gì, chạy như nào.
> **Last updated:** 2026-05-11

---

## 1. Project trong 30 giây

**Tên:** `trading-bot-builder` — Strategy Builder Tool cho nền tảng Trading Bot của Coin98.

**Làm gì:** Web app cho user **không biết code Python** vẫn tạo được trading bot.
1. User mở UI → fill form (chọn sàn, cặp coin, indicator, điều kiện vào/ra lệnh, risk).
2. FE build payload JSON đúng schema BE.
3. FE submit → BE auto-generate file Python (theo framework Freqtrade) → start process → bot chạy 24/7.

**Sàn target:** Hyperliquid (perpetual DEX) — sau sẽ support thêm Binance/Bybit.

**Trạng thái hiện tại:**
- ✅ Wizard 4 step (BotConfig / EntryStrategy / Direction / CloseMethod) — DONE
- ✅ Cypheus AI panel (scripted demo) — DONE
- ✅ Export JSON ra file — DONE
- 🚧 **Login bằng email** — đang làm (xem `PLAN_LOGIN_SUBMIT.md`)
- 🚧 **Submit lên BE thật** (hiện chỉ download file) — đang làm
- ⏳ Wallet auth (Web3) — future work

---

## 2. Stack & versions

| Layer | Tool | Version |
|-------|------|---------|
| Package manager | pnpm | 10.28.2 |
| Build | Vite | 6 |
| Runtime | React | 18 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3 |
| UI primitives | Radix UI (via shadcn/ui pattern) | - |
| State | Zustand (with `persist`) | 5 |
| Forms | React Hook Form | 7 |
| Validation | Zod | 3 |
| Routing | React Router | 7 |
| Motion | Framer Motion | 11 |
| Toast | Sonner | 1 |
| Icons | Lucide React | - |
| JSON view | prism-react-renderer | - |
| Test | Vitest + jsdom + @testing-library/react | 2 |
| API types | openapi-typescript (gen từ `Data/openapi.json`) | - |

**Không dùng:**
- Axios (dùng native `fetch` + wrapper trong `src/lib/http.ts` khi feature auth merged).
- Redux / MobX.
- CSS-in-JS (chỉ Tailwind).

---

## 3. Quick start

```bash
# Clone & install
pnpm install

# Setup env (KHÔNG cần làm gì — `.env.development` và `.env.production` đã commit sẵn)
# Chỉ tạo `.env.local` nếu cần override (vd test với BE local khác):
#   echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local

# Run dev (http://127.0.0.1:5173)
# Vite tự load `.env.development` → VITE_API_BASE_URL=/api → proxy sang BE thật
pnpm dev

# Trước khi commit
pnpm typecheck   # tsc no-emit
pnpm lint        # eslint
pnpm format      # prettier write
pnpm test        # vitest run
```

**Account test:**
- Email: `trinm@coin98.finance`
- Password: `Coin98@123`

**BE Base URL (dev):** `https://tradingbot.ne.com:8502`

**API docs:** Mở `http://localhost:8088/redoc` khi BE chạy local, hoặc check file `Data/openapi.json` local.

---

## 4. Cấu trúc thư mục

```
trading_bot/
├── src/
│   ├── components/ui/          # shadcn primitives (Button, Input, Dialog, ...)
│   ├── features/               # Domain features
│   │   ├── auth/               # ← Login, ProtectedRoute (đang làm)
│   │   ├── bot-builder/        # Wizard 4 step + canvas
│   │   ├── bot-monitoring/     # Trang xem bot đang chạy
│   │   ├── bot-summary/        # Recap config trước khi export
│   │   ├── cypheus/            # AI assistant panel (left dock)
│   │   ├── conditions/         # Entry/Exit condition tree
│   │   ├── indicators/         # Indicator picker + registry
│   │   ├── export-import/      # ← Submit dialog (đang sửa)
│   │   ├── templates/          # Preset bot templates
│   │   ├── close-method/       # TP/SL/Trailing UI
│   │   ├── fx/                 # Visual effects (DotGrid background)
│   │   └── layout-prefs/       # Sidebar collapse state
│   ├── pages/                  # Route-level pages (BuilderPage)
│   ├── lib/                    # serializer, validator, utils, http (đang làm)
│   ├── schemas/                # Zod schemas khớp BE payload
│   ├── hooks/                  # Custom hooks
│   ├── i18n/en.ts              # Locale strings
│   ├── styles/                 # tokens.css (CSS vars), fonts.css
│   ├── types/
│   │   ├── api.d.ts            # AUTO-GEN từ openapi.json — đừng sửa tay
│   │   ├── api-helpers.ts      # Re-export shortcuts
│   │   └── builder.types.ts    # UI form types
│   ├── templates/              # Bot template catalog
│   ├── test/setup.ts           # Vitest setup
│   ├── routes.tsx              # Router config
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind layers
├── Data/                       # JSON schemas + sample payloads
│   ├── openapi.json            # BE OpenAPI spec (source of truth)
│   ├── API_SPEC.md             # ★ Tài liệu BE chi tiết, READ TRƯỚC khi gọi API
│   ├── IMPLEMENTATION_PLAN.md  # Plan migrate sang UnifiedBotStrategyCreate
│   └── payload_*.json          # Sample payload để test
├── Spec/                       # Specs nội bộ
│   ├── PROJECT_OVERVIEW.md     # ★ Tour kiến trúc + history
│   └── Phase 1/                # Specs từng feature
├── Ref_screen/                 # Screenshots design tham khảo
├── public/                     # Static assets
├── tradingbot_doc.md           # Tech design doc gốc (Tuấn Nguyễn Anh, 2 Mar 2026)
├── PLAN_LOGIN_SUBMIT.md        # ★ Plan code đang triển khai
├── CLAUDE.md                   # ← bạn đang đọc
├── vite.config.ts
├── tsconfig.*.json
├── tailwind.config.ts
├── eslint.config.js
└── package.json
```

---

## 5. Quy ước code

### 5.1. Import alias
```ts
import { Button } from '@/components/ui/button';      // ← dùng '@/'
// KHÔNG dùng relative '../../components/ui/button'
```

### 5.2. State management

- **Mỗi feature có store riêng** trong folder của feature đó, đặt tên `<feature>.store.ts`.
  - Ví dụ: `features/bot-builder/store/builder.store.ts`, `features/auth/auth.store.ts`.
- Dùng Zustand với `persist` middleware **nếu cần survive reload** (vd builder, auth).
- **Đừng** tạo global store khổng lồ — tách theo domain.

### 5.3. Form validation

- Dùng React Hook Form + Zod schema:
  ```ts
  const schema = z.object({ email: z.string().email() });
  const form = useForm({ resolver: zodResolver(schema) });
  ```
- Schema cho **API payload** đặt ở `src/schemas/`.
- Schema cho **UI form** đặt cùng component.

### 5.4. API calls

- **CHƯA có khi merged `feat/auth`** — sau khi merge, tất cả API call qua `src/lib/http.ts`.
- Tách function gọi API ra file `<feature>.api.ts`, **không gọi trực tiếp trong component**.
  ```
  features/auth/auth.api.ts          ← authApi.login()
  features/bot-builder/bot-strategy.api.ts ← botStrategyApi.create()
  ```
- Types lấy từ `src/types/api-helpers.ts` (re-export từ auto-gen).

### 5.5. UI components

- **Primitives reusable** (Button, Input, Dialog, …) → `src/components/ui/`.
- **Component domain-specific** → trong feature folder của nó.
- Class tailwind sort tự động qua `prettier-plugin-tailwindcss` — chạy `pnpm format` trước commit.
- Dùng `cn()` helper từ `@/lib/utils` khi merge class:
  ```tsx
  <div className={cn('p-4', active && 'bg-brand')} />
  ```

### 5.6. Naming

- Files: `kebab-case.ts` cho non-component, `PascalCase.tsx` cho component.
- Component: `PascalCase`.
- Hooks: `useXxx`.
- Stores: `useXxxStore`.
- Constants: `SCREAMING_SNAKE_CASE`.
- Type/Interface: `PascalCase`, không prefix `I`.

### 5.7. Testing

- Test file đặt cùng folder: `Foo.tsx` → `Foo.test.tsx` HOẶC `__tests__/Foo.test.tsx`.
- Dùng Testing Library, **không** dùng Enzyme.
- Mock fetch/API bằng `vi.fn()`, KHÔNG mock cả module trừ trường hợp đặc biệt.

### 5.8. Commit

- Format: `<type>: <description>` — types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`.
- Body có thể có PR tag: `PR-J1`, `PR-W3`, ... (xem `PROJECT_OVERVIEW.md` §3).
- 1 commit = 1 logical change. Không gộp 5 thứ vào 1 commit.

### 5.9. Branching

- Off từ `main`.
- Đặt tên: `feat/<topic>` hoặc `fix/<topic>`.
- Merge bằng `--ff-only` (no merge commit).

---

## 6. Files đặc biệt — KHÔNG TỰ SỬA

| File | Lý do |
|------|-------|
| `src/types/api.d.ts` | Auto-gen từ `Data/openapi.json`. Sửa file thì regen `pnpm gen:api` đè mất. |
| `Data/openapi.json` | BE owns — copy từ BE, đừng sửa local. |
| `pnpm-lock.yaml` | Pinned versions — chỉ thay đổi qua `pnpm add/remove/update`. |
| `.claude/worktrees/*` | Auto-managed bởi Claude Code worktrees. Đừng commit. |

---

## 7. Backend integration

### 7.1. Endpoints chính (FE phải dùng)

| Method | Path | Mục đích | Status |
|--------|------|----------|--------|
| `POST` | `/user/login` | Đăng nhập, lấy JWT | 🚧 đang code |
| `GET` | `/user/status` | Lấy info user hiện tại | 🚧 đang code |
| `POST` | `/bot-strategy/create` | Tạo bot + strategy (atomic) | 🚧 đang code |
| `PATCH` | `/bot-strategy/{bot_id}` | Update bot (atomic) | ⏳ future |
| `GET` | `/bot/list` | Liệt kê bot của user | ⏳ future |
| `POST` | `/bot/{id}/start` | Khởi động bot | ⏳ future |
| `POST` | `/bot/{id}/stop` | Dừng bot | ⏳ future |
| `GET` | `/bot/{id}/status` | Trạng thái real-time | ⏳ future |
| `POST` | `/backtest/start` | Chạy backtest | ⏳ future |

**Endpoints legacy** (`/bot/create`, `/strategy/create`) — **đừng dùng**, BE đã chuyển sang `/bot-strategy/*` atomic.

### 7.2. Authentication

- Tất cả endpoint trừ `/user/login` và `/user/create` cần header: `Authorization: Bearer <access_token>`.
- Token lấy từ response `POST /user/login` → field `access_token`.
- **Không có refresh token** ở phase này → 401 = force logout + redirect `/login`.

### 7.3. CORS ở dev

FE dev dùng Vite proxy → bypass CORS:
- FE gọi `/api/user/login` → Vite forward sang `https://tradingbot.ne.com:8502/user/login`.
- `VITE_API_BASE_URL` ở dev phải là `/api` (không phải URL đầy đủ) — nếu không sẽ bypass proxy → lỗi CORS.
- Cấu hình env theo mode đã commit sẵn: `.env.development` (= `/api`) và `.env.production` (= URL thật).
- Production: BE phải config CORS allow origin của Vercel domain.

### 7.4. Tài liệu BE phải đọc

1. **`Data/API_SPEC.md`** — version migrated từ OpenAPI. Đọc trước khi gọi bất kỳ endpoint nào.
2. **`Data/openapi.json`** — source of truth, dùng để gen types.
3. **`tradingbot_doc.md`** — tech design doc gốc, mô tả ý đồ thiết kế.

---

## 8. UI conventions

### 8.1. Theme

- **Dark mode only.** `<html class="dark">` luôn được set ở `index.html`.
- **Brand color:** vàng Coin98 (`#F0B90B`). Định nghĩa qua CSS vars trong `src/styles/tokens.css`.
- **Font heading:** "Press Start 2P" (pixel font) cho title đặc biệt; còn lại Inter/system sans.

### 8.2. Toast (Sonner)

```ts
import { toast } from 'sonner';

toast.success('Bot #5 đã tạo thành công');
toast.error('Lỗi kết nối server');
toast.warning('Phiên đăng nhập hết hạn');
```

Toast position: top-right (mặc định Sonner). `<Toaster />` mount ở `BuilderPage`.

### 8.3. Dialog (Radix Dialog wrapper)

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

Ví dụ tham khảo: `src/features/export-import/ExportDialog.tsx`.

### 8.4. Forms

Pattern chuẩn:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

const form = useForm<FormValues>({ resolver: zodResolver(schema) });

<form onSubmit={form.handleSubmit(onSubmit)}>
  <Input {...form.register('email')} />
  {form.formState.errors.email && <span>{form.formState.errors.email.message}</span>}
</form>
```

---

## 9. Workflow recommended cho task mới

1. **Đọc spec trước:**
   - Có file plan riêng (vd `PLAN_LOGIN_SUBMIT.md`)? → đọc trước
   - Không có? → đọc `Spec/Phase X/` liên quan
   - Vẫn không có? → hỏi Tri
2. **Branch off main:** `git checkout main && git pull && git checkout -b feat/<topic>`
3. **Code theo phase trong plan:** mỗi phase 1 commit hoặc gộp khi nhỏ
4. **Trước khi push:**
   - `pnpm typecheck` ✓
   - `pnpm lint` ✓
   - `pnpm test` ✓
   - `pnpm format` ✓
5. **Test thủ công** với account thật trên local
6. **Push & open PR** với template:
   - Mô tả thay đổi (what & why)
   - Screenshot/GIF nếu có UI thay đổi
   - Checklist DoD từ plan
7. **Sau merge:** delete branch, pull main

---

## 10. Troubleshooting

### "Workspace still starting" khi bash
Vite/dev server boot chậm. Đợi 5-10s rồi retry.

### `pnpm dev` cảnh báo proxy SSL
BE đang dùng self-signed cert. Trong `vite.config.ts` proxy có `secure: false`. OK ở dev.

### Lỗi `CORS` khi gọi BE
Bạn đang gọi thẳng `https://tradingbot.ne.com:8502/...` thay vì qua `/api/...`. Sửa lại request path.

### Type error sau khi BE update spec
```bash
# Copy openapi.json mới từ BE vào Data/
pnpm gen:api
```

### Builder state bị "kẹt" sau code mới
LocalStorage có state cũ. DevTools → Application → Local Storage → xoá key `trading-bot-builder`.

### Token tự logout liên tục
Check `localStorage` → key auth store có `token` không. Có thể BE đổi format response → check `auth.api.ts`.

---

## 11. Tham khảo thêm

| File | Mục đích |
|------|----------|
| `README.md` | Quick start chính thức (ngắn) |
| `Spec/PROJECT_OVERVIEW.md` | Tour đầy đủ kiến trúc + history + branches |
| `Spec/Phase 1/` | Specs từng UI feature (đọc khi sửa feature đó) |
| `Data/API_SPEC.md` | API reference đầy đủ với worked example |
| `Data/IMPLEMENTATION_PLAN.md` | Plan migrate sang Unified payload |
| `tradingbot_doc.md` | Tech design doc gốc (Vietnamese) |
| `PLAN_LOGIN_SUBMIT.md` | Plan đang implement (login + submit) |

---

## 12. Liên hệ

- **Tech design owner:** Tuấn Nguyễn Anh (BE)
- **FE owner (project này):** Tri Nguyen (`trinm@coin98.finance`)
- **BE base URL dev:** `https://tradingbot.ne.com:8502`
- **BE OpenAPI:** `http://localhost:8088/redoc` (khi BE chạy local) hoặc `Data/openapi.json`

---

**Quy tắc vàng:** trước khi đổi gì lớn (refactor folder, đổi state management, thay UI lib) → discuss với Tri trước. Trước khi thêm dependency mới (`pnpm add`) → cân nhắc xem có thật cần không, ưu tiên reuse cái đã có.
