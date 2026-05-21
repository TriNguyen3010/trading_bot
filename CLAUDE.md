# CLAUDE.md — Onboarding cho người mới (hoặc AI agent)

> **Audience:** Dev mới join project HOẶC AI agent (Claude/Copilot) cần context để code.
> **Đọc xong file này:** nắm được app làm gì, code ở đâu, quy ước gì, chạy như nào.
> **Last updated:** 2026-05-21

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
- ✅ **Coin98 wallet auth** — DONE (`src/features/wallet-auth/`, spec `docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md`)
- 🚧 **Submit lên BE thật** (hiện chỉ download file) — đang làm
- ⏳ Bot lifecycle (start/stop/monitoring) — future work
- ⏳ Email/password login (`PLAN_LOGIN_SUBMIT.md`) — **superseded** bởi wallet auth, plan giữ làm reference

---

## 2. Stack & versions

| Layer           | Tool                                          | Version |
| --------------- | --------------------------------------------- | ------- |
| Package manager | pnpm                                          | 10.28.2 |
| Build           | Vite                                          | 6       |
| Runtime         | React                                         | 18      |
| Language        | TypeScript                                    | 5.7     |
| Styling         | Tailwind CSS                                  | 3       |
| UI primitives   | Radix UI (via shadcn/ui pattern)              | -       |
| State           | Zustand (with `persist`)                      | 5       |
| Forms           | React Hook Form                               | 7       |
| Validation      | Zod                                           | 3       |
| Routing         | React Router                                  | 7       |
| Motion          | Framer Motion                                 | 11      |
| Toast           | Sonner                                        | 1       |
| Icons           | Lucide React                                  | -       |
| JSON view       | prism-react-renderer                          | -       |
| Test            | Vitest + jsdom + @testing-library/react       | 2       |
| API types       | openapi-typescript (gen từ `BE/openapi.json`) | -       |

**Không dùng:**

- Axios (dùng native `fetch` + wrapper trong `src/lib/http.ts`).
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

**BE Base URL (dev):** `http://tradingbot.ne.com:8088` (HTTP only — BE chưa support HTTPS)

**API docs:** Mở `http://localhost:8088/redoc` khi BE chạy local, hoặc check file `BE/openapi.json` local.

---

## 4. Cấu trúc thư mục

```
trading_bot/
├── src/
│   ├── components/ui/          # shadcn primitives (Button, Input, Dialog, ...)
│   ├── features/               # Domain features
│   │   ├── wallet-auth/        # Coin98 wallet connect + EIP-191 sign + session storage
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
├── BE/                         # ★ TẤT CẢ tài liệu + fixture từ BE
│   ├── openapi.json            # BE OpenAPI spec (source of truth, gen types)
│   ├── API_SPEC.md             # ★ Tài liệu BE chi tiết bot-strategy, READ TRƯỚC khi gọi API
│   ├── auth-architecture.md    # Kiến trúc 3-layer auth (wallet/agent/trading)
│   ├── tradingbot_doc.md       # Tech design doc gốc (Tuấn Nguyễn Anh, 2 Mar 2026)
│   ├── IMPLEMENTATION_PLAN.md  # Plan migrate sang UnifiedBotStrategyCreate
│   ├── indicators_*.json       # Catalog indicators (talib + pandas-ta)
│   ├── *Documentation*.md      # Reference docs cho TA-Lib + Pandas-TA
│   └── payload_*.json          # Sample payload BE để test/validate
├── Data/                       # FE-side reference (mockup, screenshots, market data)
│   ├── Ref_bot/                # UI mockup PNGs cho designer
│   ├── API docs by Redocly/    # Screenshots Redoc UI
│   └── hyperliquid_top100*.csv # Market data tham khảo
├── Spec/                       # Specs nội bộ (FE design specs)
│   ├── PROJECT_OVERVIEW.md     # ★ Tour kiến trúc + history
│   └── Phase 1/                # Specs từng feature
├── Ref_screen/                 # Screenshots design tham khảo
├── public/                     # Static assets
├── PLAN_LOGIN_SUBMIT.md        # Plan email login (superseded by wallet auth)
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
import { Button } from '@/components/ui/button'; // ← dùng '@/'
// KHÔNG dùng relative '../../components/ui/button'
```

### 5.2. State management

- **Mỗi feature có store riêng** trong folder của feature đó, đặt tên `<feature>.store.ts`.
  - Ví dụ: `features/bot-builder/store/builder.store.ts`, `features/wallet-auth/wallet.store.ts`.
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

- Tất cả API call qua wrapper `src/lib/http.ts` — tự attach `X-Wallet-*` headers, handle 401 (clear + redirect `/`), public-path whitelist.
- Tách function gọi API ra file `<feature>.api.ts`, **không gọi trực tiếp trong component**.
  ```
  features/wallet-auth/wallet.api.ts        ← walletApi.getNonce(), getStatus(), disconnect()
  features/bot-builder/bot-strategy.api.ts  ← botStrategyApi.create()
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

| File                  | Lý do                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `src/types/api.d.ts`  | Auto-gen từ `BE/openapi.json`. Sửa file thì regen `pnpm gen:api` đè mất. |
| `BE/openapi.json`     | BE owns — copy từ BE, đừng sửa local.                                    |
| `pnpm-lock.yaml`      | Pinned versions — chỉ thay đổi qua `pnpm add/remove/update`.             |
| `.claude/worktrees/*` | Auto-managed bởi Claude Code worktrees. Đừng commit.                     |

---

## 7. Backend integration

### 7.1. Endpoints chính (FE phải dùng)

| Method  | Path                          | Mục đích                                                                                 | Status       |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| `GET`   | `/wallet/nonce?address=0x...` | Lấy nonce + message để ký (PUBLIC, không cần auth)                                       | ✅ DONE      |
| `GET`   | `/user/status`                | Lấy info user hiện tại (verify credentials)                                              | ✅ DONE      |
| `POST`  | `/wallet/disconnect`          | Invalidate nonce trên BE (best-effort)                                                   | ✅ DONE      |
| `POST`  | `/bot-strategy/create`        | Tạo bot + strategy (atomic)                                                              | 🚧 đang code |
| `PATCH` | `/bot-strategy/{bot_id}`      | Update bot (atomic)                                                                      | ⏳ future    |
| `GET`   | `/bot/list`                   | Liệt kê bot của user                                                                     | ⏳ future    |
| `POST`  | `/bot/{id}/start`             | Khởi động bot (BE spawn process Freqtrade)                                               | ⏳ future    |
| `POST`  | `/bot/{id}/stop`              | Dừng bot                                                                                 | ⏳ future    |
| `GET`   | `/bot/{id}/status`            | Trạng thái real-time (`status`, `desired_status`, `is_process_running`, `error_message`) | ⏳ future    |
| `POST`  | `/backtest/start`             | Chạy backtest                                                                            | ⏳ future    |

**Endpoints legacy** (`/bot/create`, `/strategy/create`) — **đừng dùng**, BE đã chuyển sang `/bot-strategy/*` atomic.
**Endpoints deprecated** (`/user/login`, `/user/token`, `/user/create`) — email/password flow, FE đã chuyển sang wallet auth.

### 7.2. Authentication

- Cơ chế: **Coin98 wallet** + EIP-191 personal_sign. Không dùng email/password.
- Headers mỗi request (do `src/lib/http.ts` tự attach): `X-Wallet-Address`, `X-Wallet-Nonce`, `X-Wallet-Signature`.
- Public paths (không attach header): `/wallet/nonce`, `/internal/`, `/webhook/`, `/docs`, `/openapi`, `/health` — xem `PUBLIC_PATHS` trong `src/lib/http.ts`.
- Credentials lưu ở `sessionStorage['trading_bot_wallet_auth']` — survives reload, expires khi đóng tab.
- 401 từ BE → http.ts tự clear sessionStorage + redirect về `/` (landing public).
- **Offline dev:** set `VITE_BYPASS_AUTH=true` trong `.env.local` để skip auth (header chip hiện `DEV bypass` để rõ).
- Chi tiết kiến trúc auth (BE-side): `BE/auth-architecture.md`.

### 7.3. CORS ở dev

FE dev dùng Vite proxy → bypass CORS:

- FE gọi `/api/wallet/nonce?address=0x...` → Vite forward sang `http://tradingbot.ne.com:8088/wallet/nonce?address=0x...`.
- `VITE_API_BASE_URL` ở dev phải là `/api` (không phải URL đầy đủ) — nếu không sẽ bypass proxy → lỗi CORS.
- Cấu hình env theo mode đã commit sẵn: `.env.development` (= `/api`) và `.env.production` (= URL thật).
- Production: BE phải config CORS allow origin của Vercel domain.
- ⚠️ **Mixed-content**: BE chỉ serve HTTP. FE prod thường HTTPS → browser block request HTTP. Cần BE bật HTTPS, hoặc Vercel rewrite/proxy, hoặc deploy FE qua HTTP. Đang chờ BE bật HTTPS.

### 7.4. Tài liệu BE phải đọc

1. **`BE/API_SPEC.md`** — version migrated từ OpenAPI. Đọc trước khi gọi bất kỳ endpoint nào.
2. **`BE/openapi.json`** — source of truth cho schema, dùng để gen types. ⚠️ Chưa có `/wallet/*` routes — đợi BE regen spec.
3. **`BE/auth-architecture.md`** — kiến trúc 3-layer auth (Wallet session / Agent / Trading execution). Đọc khi đụng wallet-auth / sau này là Hyperliquid agent.
4. **`BE/tradingbot_doc.md`** — tech design doc gốc, mô tả ý đồ thiết kế.

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
  {form.formState.errors.email && (
    <span>{form.formState.errors.email.message}</span>
  )}
</form>;
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

### Lỗi `CORS` khi gọi BE

Bạn đang gọi thẳng `http://tradingbot.ne.com:8088/...` thay vì qua `/api/...`. Sửa lại request path.

### Type error sau khi BE update spec

```bash
# Copy openapi.json mới từ BE vào BE/
pnpm gen:api
```

### Builder state bị "kẹt" sau code mới

LocalStorage có state cũ. DevTools → Application → Local Storage → xoá key `trading-bot-builder`.

### Wallet auth tự logout liên tục

Check DevTools → Application → Session Storage → key `trading_bot_wallet_auth` có đủ 3 field (`address`, `nonce`, `signature`) không. Nếu nonce trên BE Redis hết TTL (24h) → 401 → http.ts clear creds + redirect `/`. Reconnect wallet để lấy nonce mới.

---

## 11. Tham khảo thêm

| File                                                          | Mục đích                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `README.md`                                                   | Quick start chính thức (ngắn)                                   |
| `Spec/PROJECT_OVERVIEW.md`                                    | Tour đầy đủ kiến trúc + history + branches                      |
| `Spec/Phase 1/`                                               | Specs từng UI feature (đọc khi sửa feature đó)                  |
| `BE/API_SPEC.md`                                              | API reference đầy đủ với worked example                         |
| `BE/IMPLEMENTATION_PLAN.md`                                   | Plan migrate sang Unified payload                               |
| `BE/tradingbot_doc.md`                                        | Tech design doc gốc (Vietnamese)                                |
| `BE/auth-architecture.md`                                     | Kiến trúc 3-layer auth (wallet/agent/trading)                   |
| `docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md` | Spec wallet auth (current)                                      |
| `docs/superpowers/plans/2026-05-14-c98-wallet-auth.md`        | Plan implement wallet auth                                      |
| `PLAN_LOGIN_SUBMIT.md`                                        | Plan email login — **superseded**, giữ làm historical reference |

---

## 12. Liên hệ

- **Tech design owner:** Tuấn Nguyễn Anh (BE)
- **FE owner (project này):** Tri Nguyen (`trinm@coin98.finance`)
- **BE base URL dev:** `http://tradingbot.ne.com:8088`
- **BE OpenAPI:** `http://localhost:8088/redoc` (khi BE chạy local) hoặc `BE/openapi.json`

---

**Quy tắc vàng:** trước khi đổi gì lớn (refactor folder, đổi state management, thay UI lib) → discuss với Tri trước. Trước khi thêm dependency mới (`pnpm add`) → cân nhắc xem có thật cần không, ưu tiên reuse cái đã có.
