# PLAN — Login bằng Email & Submit Bot lên Backend

> **Mục tiêu:** User đăng nhập bằng email/password, tự config bot qua UI wizard, bấm Submit để gửi payload JSON lên BE thật.
>
> **Created:** 2026-05-11
> **Owner:** TriNguyen
> **Status:** Ready to implement (đã gather đủ thông tin từ BE)

---

## 0. Thông tin nền

### 0.1. Backend đã confirm

| Hạng mục | Giá trị |
|----------|---------|
| **Base URL (dev)** | `https://tradingbot.ne.com:8502` |
| **Login endpoint** | `POST /user/login` — body `{ email, password }` → response `{ access_token, token_type: "bearer" }` |
| **User info endpoint** | `GET /user/status` (cần Bearer token) → response `UserOut { id, email, is_active, is_admin }` |
| **Submit bot endpoint** | `POST /bot-strategy/create` — body `UnifiedBotStrategyCreate` → status `201` + body `BotStrategyOut { bot: { id, ... }, strategy: { id, bot_id, ... } }`. **Note:** Endpoint atomic `/bot-strategy/create` là chính thức theo `Data/openapi.json` + `Data/API_SPEC.md`. Tài liệu `tradingbot_doc.md` (Mar 2026) còn ghi `/bot/create` + `/strategy/create` riêng — đã outdated, BE refactor sang atomic rồi. Đừng dùng legacy. |
| **`/user/token`** | Không dùng — BE confirm chỉ dùng `/user/login` (chat 11/5/26 14:00 với BE Tuấn Nguyễn) |
| **Refresh token** | Không có → khi 401 thì force logout |
| **Account test** | `trinm@coin98.finance` / `Coin98@123` |

### 0.2. Giới hạn & quyết định

- **Bỏ Register page** — đã có account seed, không cần đăng ký mới ở MVP.
- **Login email là giải pháp tạm** — sau sẽ thay bằng wallet auth (Web3). Vì vậy:
  - Không over-engineer: bỏ qua refresh token, email verification, password strength meter, "forgot password", v.v.
  - Thiết kế `auth.store` có abstraction nhẹ để dễ swap sang wallet auth sau.
- **CORS:** FE tự xử lý qua Vite dev proxy → BE không cần allow `localhost:5173`.
- **Submit thành công:** redirect sang `/bots/{bot.id}` (đã có sẵn `BotMonitoringPage`).
- **Submit thất bại 422:** parse error theo format FastAPI mặc định `{ detail: [{ loc, msg, type }] }`.

### 0.3. Codebase đang có gì

- **Stack:** React 18 + Vite + TS + Tailwind + Radix (shadcn) + Zustand + RHF + Zod + Sonner.
- **Routes:** `/` (redirect → `/builder`), `/builder`, `/bots`, `/bots/:id`.
- **Builder wizard:** đã hoàn thành 4 step (BotConfig, EntryStrategy, Direction, CloseMethod) ở `src/features/bot-builder/`.
- **Payload builder:** `src/lib/serializer.ts::buildUnifiedPayload(state)` → output khớp `unifiedBotStrategyCreateSchema`.
- **Hiện tại nút "Export":** chỉ tải file `.json` về máy (`ExportDialog.tsx`) — **chưa gọi BE thật**.
- **Auth:** **CHƯA CÓ** — `grep "login|auth|jwt"` zero match thực sự.

---

## 1. Roadmap tổng quan

3 phase, làm tuần tự. Mỗi phase mở 1 PR riêng để dễ review/revert.

| Phase | Tên | Output | Thời gian |
|-------|-----|--------|-----------|
| **Phase 1** | Auth foundation | Login page chạy được, ProtectedRoute hoạt động, axios/fetch wrapper xử lý 401 | ~3-4h |
| **Phase 2** | Submit lên BE | Nút Submit trong ExportDialog gọi BE thật, redirect đúng, handle 422 | ~2-3h |
| **Phase 3** | Polish & QA | Logout button, UX edge cases, unit test, smoke test end-to-end | ~2h |

**Tổng:** ~1 ngày làm việc.

---

## 2. PHASE 1 — Auth Foundation

### 2.1. Mục tiêu

- User mở app → bị redirect về `/login`.
- Nhập đúng email/password → redirect về `/builder`.
- Nhập sai → hiển thị error.
- Mọi request sau login tự gắn `Authorization: Bearer <token>`.
- Token hết hạn (401) → tự clear token + redirect `/login` + toast warning.

### 2.2. Files tạo mới

```
src/
├── features/
│   └── auth/
│       ├── auth.api.ts          ← gọi BE: login() + getStatus()
│       ├── auth.store.ts        ← Zustand store: token, user, isAuthenticated
│       ├── auth.types.ts        ← TS types: LoginRequest, AuthUser
│       ├── LoginPage.tsx        ← UI trang login
│       └── ProtectedRoute.tsx   ← HOC wrap routes cần auth
├── lib/
│   └── http.ts                  ← fetch wrapper: baseURL + Authorization + 401 handler
└── (.env.example mới ở root)
```

### 2.3. Files sửa

- `vite.config.ts` — thêm `server.proxy` cho dev (bypass CORS).
- `src/routes.tsx` — thêm route `/login`, wrap routes hiện tại bằng `ProtectedRoute`.
- `.gitignore` — đã có `.env*` rồi, OK.

### 2.4. Task list

#### Task 1.1. Setup environment & Vite proxy

> ⚠️ **CẢNH BÁO QUAN TRỌNG** (sửa sau feedback review):
> Nếu để `VITE_API_BASE_URL=https://tradingbot.ne.com:8502` ở dev, `http.ts` sẽ gọi **thẳng** vào BE → bypass Vite proxy → **lỗi CORS 100%**.
> Cách đúng: ở **dev** thì `VITE_API_BASE_URL=/api` (qua proxy), ở **production** mới dùng URL thật.

**Strategy:** Tận dụng Vite tự load env theo mode (`pnpm dev` → `development`, `pnpm build` → `production`). Commit `.env.development` + `.env.production` vào repo vì URL không phải secret.

**File:** `.gitignore` (sửa)

Thay 2 dòng:
```
.env
.env.*
!.env.example
```
bằng:
```
.env.local
.env.*.local
```
→ Cho phép commit `.env.development` và `.env.production`, chỉ ignore `.env.local` (override cá nhân của từng dev).

**File:** `.env.example` (mới — để document biến)
```env
# Base URL của BE. Ở dev = "/api" (qua Vite proxy, bypass CORS).
# Ở production = full URL của BE (BE phải whitelist CORS domain FE).
VITE_API_BASE_URL=/api
```

**File:** `.env.development` (mới — commit vào repo)
```env
# Vite dev server proxy chặn request /api/* và forward sang BE.
# Xem vite.config.ts > server.proxy.
VITE_API_BASE_URL=/api
```

**File:** `.env.production` (mới — commit vào repo)
```env
# Production gọi thẳng BE. BE phải mở CORS allow origin của Vercel domain.
VITE_API_BASE_URL=https://tradingbot.ne.com:8502
```

**File:** `.env.local` (không commit — Tri tự tạo nếu cần override)
```env
# Optional: override khi cần test BE local hoặc URL khác
# VITE_API_BASE_URL=http://localhost:8000
```

**File:** `vite.config.ts` (sửa)
```ts
server: {
  port: 5173,
  host: '127.0.0.1',
  proxy: {
    '/api': {
      target: 'https://tradingbot.ne.com:8502',
      changeOrigin: true,
      secure: false, // BE đang dùng cert tự ký
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
  watch: { usePolling: true },
},
```

→ Lúc dev, FE gọi `/api/user/login` → Vite forward sang `https://tradingbot.ne.com:8502/user/login`. Không cần BE config CORS ở dev.

**`http.ts` clean — không cần if/else môi trường:**
```ts
const baseURL = import.meta.env.VITE_API_BASE_URL; // "/api" ở dev, full URL ở prod
const url = `${baseURL}${path}`;                   // vd "/api/user/login"
```

**Acceptance:**
- `pnpm dev` chạy ok, không có lỗi terminal.
- Mở DevTools Network tab khi đang dev → request gửi đến `http://127.0.0.1:5173/api/...`, KHÔNG phải `https://tradingbot.ne.com:8502/...`.
- Response status đúng (không phải lỗi CORS).

---

#### Task 1.2. HTTP wrapper

**File:** `src/lib/http.ts` (mới)

Yêu cầu:
- Function `http<T>(method, path, body?)` trả về `Promise<T>`.
- Tự đọc token từ `auth.store` → gắn header `Authorization: Bearer <token>`.
- Base URL: `import.meta.env.VITE_API_BASE_URL` cho mọi môi trường — không cần if/else. Vite tự load env theo mode (`/api` ở dev, URL thật ở prod). Xem Task 1.1.
- Xử lý 401 → clear auth store + toast "Phiên hết hạn, vui lòng đăng nhập lại" + `window.location.href = '/login'`.
- Xử lý 422 → throw `ValidationError` (custom class chứa `detail` từ BE) để form catch và hiển thị.
- Xử lý error khác → throw `Error(response.statusText)` + toast lỗi generic.

**Acceptance:** Unit test mock fetch, verify 401 trigger logout.

---

#### Task 1.3. Auth types & API

**File:** `src/features/auth/auth.types.ts` (mới)
```ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
}

export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}
```

**File:** `src/features/auth/auth.api.ts` (mới)
```ts
export const authApi = {
  login: (body: LoginRequest) => http<TokenResponse>('POST', '/user/login', body),
  getStatus: () => http<AuthUser>('GET', '/user/status'),
};
```

**Acceptance:** Type check pass.

---

#### Task 1.4. Auth store

**File:** `src/features/auth/auth.store.ts` (mới)

Yêu cầu:
- Zustand với `persist` middleware (lưu `localStorage`).
- State: `token: string | null`, `user: AuthUser | null`.
- Actions: `login(email, password)`, `logout()`, `loadUserFromToken()`.
- `login()` flow: gọi `authApi.login` → lưu token → gọi `authApi.getStatus` → lưu user.
- Selector helper: `useIsAuthenticated()` = `!!token`.

**Acceptance:** Unit test cover login → state thay đổi đúng, logout → clear cả token và user.

---

#### Task 1.5. Login page

**File:** `src/features/auth/LoginPage.tsx` (mới)

UI:
- Form 2 field: email, password. Dùng `react-hook-form` + Zod schema (`z.object({ email: z.string().email(), password: z.string().min(1) })`).
- Reuse `Input`, `Button`, `FormField` từ `src/components/ui/`.
- Style giống design hiện tại (dark theme, brand color #F0B90B yellow).
- Logo Coin98 + tiêu đề "Đăng nhập Trading Bot Platform".
- Submit:
  - Disable button + spinner khi pending.
  - Catch error → toast `sonner` + set form error (`setError`).
  - Success → `navigate('/builder')`.
- Footer note: "Chưa có tài khoản? Liên hệ admin." (vì bỏ Register).

**Acceptance:**
- Login với `trinm@coin98.finance / Coin98@123` thành công → redirect `/builder`.
- Login sai → toast "Email hoặc mật khẩu không đúng".

---

#### Task 1.6. Protected route

**File:** `src/features/auth/ProtectedRoute.tsx` (mới)
```tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.token);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

**File:** `src/routes.tsx` (sửa)
```tsx
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <Navigate to="/builder" replace /> },
  { path: '/builder', element: <ProtectedRoute><BuilderPage /></ProtectedRoute> },
  { path: '/bots', element: <ProtectedRoute><BotsListPage /></ProtectedRoute> },
  { path: '/bots/:id', element: <ProtectedRoute><BotMonitoringPage /></ProtectedRoute> },
  { path: '*', element: <Navigate to="/builder" replace /> },
]);
```

**Acceptance:**
- Truy cập `/builder` khi chưa login → redirect `/login`.
- Sau login → vào được `/builder`.

---

### 2.5. Phase 1 — Definition of Done

- [ ] `pnpm dev` chạy không lỗi
- [ ] `pnpm typecheck` pass
- [ ] `pnpm lint` pass
- [ ] Login với account test thành công, redirect `/builder`
- [ ] Login sai email/pwd → toast lỗi rõ ràng
- [ ] Reload page giữ nguyên session (token persist trong localStorage)
- [ ] Truy cập `/builder` khi chưa login → bounce về `/login`
- [ ] Token bị BE reject (giả lập 401) → auto logout + redirect

---

## 3. PHASE 2 — Submit Bot lên BE

### 3.1. Mục tiêu

Thay đổi nút Export hiện tại (chỉ download file) thành nút Submit thật:
- User config xong bot → bấm "Submit"
- FE gọi `POST /bot-strategy/create`
- Success → toast + redirect `/bots/{response.bot.id}`
- Failure 422 → hiển thị lỗi field cụ thể
- Failure khác → toast lỗi generic

### 3.2. Files tạo mới

```
src/
└── features/
    └── bot-builder/
        └── bot-strategy.api.ts    ← gọi POST /bot-strategy/create
```

### 3.3. Files sửa

- `src/features/export-import/ExportDialog.tsx` — thêm nút Submit + handler.
- `src/features/export-import/export-dialog.store.ts` — thêm state `submitting`, `submitError`.

### 3.4. Task list

#### Task 2.1. API client

**File:** `src/features/bot-builder/bot-strategy.api.ts` (mới)
```ts
import type { CreatePayload, Schemas } from '@/types/api-helpers';
import { http } from '@/lib/http';

export type BotStrategyResponse = Schemas['BotStrategyOut'];

export const botStrategyApi = {
  create: (payload: CreatePayload) =>
    http<BotStrategyResponse>('POST', '/bot-strategy/create', payload),
};
```

**Acceptance:** Type check pass.

---

#### Task 2.2. Sửa ExportDialog

**File:** `src/features/export-import/ExportDialog.tsx` (sửa)

Thay đổi UI:
- Giữ nguyên: section preview JSON, copy JSON, download JSON (giữ làm option phụ cho debug).
- **Thêm CTA chính**: nút "Submit to Backend" (primary, yellow brand color).
- Disable khi `issues.length > 0` (validate fail) hoặc `submitting === true`.
- Khi bấm Submit:
  1. `setSubmitting(true)`
  2. Gọi `botStrategyApi.create(bundle)`
  3. Success:
     - Toast: `Bot #{id} "{bot_name}" đã được tạo thành công`
     - `onOpenChange(false)` (đóng dialog)
     - Reset builder store (`resetAll()`) — optional, bàn với Tri
     - `navigate(`/bots/${response.bot.id}`)`
  4. Failure:
     - Nếu 422 → parse `error.detail`, hiển thị list field error trong dialog (giống `parseError` hiện tại)
     - Nếu khác → toast `sonner` lỗi generic
  5. Finally: `setSubmitting(false)`

**Acceptance:**
- Submit thành công → redirect `/bots/:id` đúng
- Submit lỗi 422 → field error hiển thị rõ trong dialog
- Submit lỗi 500 → toast "Lỗi server, vui lòng thử lại"

---

#### Task 2.3. (Optional) Submit từ Header thay vì Dialog

Cân nhắc thêm nút "Deploy Bot" hoặc đổi tên "Export" → "Submit" trên `HeaderToolbar`. **Tùy quyết định Tri**, không bắt buộc.

---

### 3.5. Phase 2 — Definition of Done

- [ ] Submit bot bằng account test → BE nhận đúng, log DB BE có bot mới
- [ ] Redirect sang `/bots/:id` đúng id BE trả về
- [ ] Submit thiếu field bắt buộc → 422 từ BE → hiển thị error chính xác
- [ ] Submit khi mất mạng → toast lỗi rõ ràng, không crash
- [ ] Vẫn copy/download JSON được (giữ cho debug)

---

## 4. PHASE 3 — Polish & QA

### 4.1. Mục tiêu

Hoàn thiện UX, đảm bảo không có edge case lỗi, viết test.

### 4.2. Task list

#### Task 3.1. Logout button + User badge

**File:** `src/features/bot-builder/components/HeaderToolbar.tsx` (sửa)

Thêm vào góc phải header:
- Avatar tròn + email user (lấy từ `auth.store`)
- Dropdown menu (Radix `DropdownMenu`): "Đăng xuất"
- Click Đăng xuất → `auth.store.logout()` → redirect `/login`

**Acceptance:** Logout từ bất kỳ trang nào đều về `/login`.

---

#### Task 3.2. Loading & error UX

- Spinner overlay khi đang submit (full-screen hoặc trong dialog).
- Toast position consistent (top-right).
- Disable form khi pending để tránh double-submit.

---

#### Task 3.3. Unit tests

**File:** `src/features/auth/auth.store.test.ts` (mới)
- Test login happy path (mock `authApi`)
- Test logout clear state
- Test persist (mock localStorage)

**File:** `src/lib/http.test.ts` (mới)
- Test 401 trigger logout
- Test 422 throw ValidationError
- Test success path return body

**Acceptance:** `pnpm test` pass.

---

#### Task 3.4. Smoke test end-to-end (thủ công)

Checklist test thủ công với account thật:

1. [ ] Clear localStorage, mở `/` → redirect `/login`
2. [ ] Login sai password → toast lỗi
3. [ ] Login đúng → redirect `/builder`
4. [ ] Reload trang → vẫn ở `/builder` (không bị bounce login)
5. [ ] Config bot đầy đủ (4 step) → bấm Submit
6. [ ] BE trả 201 → redirect `/bots/:id`
7. [ ] Trang monitoring hiển thị bot vừa tạo
8. [ ] Bấm Đăng xuất → về `/login`, localStorage cleared
9. [ ] Đóng tab, mở lại → vẫn yêu cầu login (vì đã logout)
10. [ ] Test giả lập token expired: manually xoá `access_token` trong localStorage → reload `/builder` → bounce `/login`

---

### 4.3. Phase 3 — Definition of Done

- [ ] User badge + logout button hoạt động
- [ ] Tất cả checklist smoke test pass
- [ ] Unit test pass (`pnpm test`)
- [ ] Lint + typecheck pass

---

## 5. Rollout & Rollback

### 5.1. Rollout

1. **Branch:** `feat/auth-and-submit` off từ `main`.
2. **Commits:**
   - `feat: add vite dev proxy for BE` (Phase 1.1)
   - `feat: add http wrapper with 401 handler` (Phase 1.2)
   - `feat: add auth store + api` (Phase 1.3-1.4)
   - `feat: add login page + protected route` (Phase 1.5-1.6)
   - `feat: add bot-strategy create api` (Phase 2.1)
   - `feat: submit bot to backend from export dialog` (Phase 2.2)
   - `feat: add logout button + user badge` (Phase 3.1)
   - `test: cover auth store + http wrapper` (Phase 3.3)
3. **PR review** → merge `main` → deploy Vercel.

### 5.2. Rollback

Mỗi Phase 1 PR riêng → revert cực dễ. Auth bị lỗi → revert PR auth, app trở về trạng thái cũ (chỉ có builder + export download).

### 5.3. Production checklist (trước khi deploy)

- [ ] `.env.production` có `VITE_API_BASE_URL` chính xác (không phải `/api`)
- [ ] HTTP wrapper xử lý cả 2 case: dev (`/api`) và production (`https://...`)
- [ ] BE đã whitelist CORS cho domain Vercel
- [ ] Test 1 lần trên Vercel preview deploy trước khi merge main

---

## 6. Future work (sau MVP)

- Wallet auth (Sign-In with Ethereum / RainbowKit)
- Refresh token (nếu BE bổ sung)
- "Forgot password" + email verification (nếu vẫn giữ email login)
- 2FA cho admin
- Role-based UI (ẩn/hiện feature theo `is_admin`)

---

## 7. Open questions cho BE (chưa cần trả lời ngay)

1. Status code BE trả khi credentials sai? (401 hay 422?)
2. Format error response chuẩn của BE? (Hiện đang assume FastAPI default)
3. Khi user `is_active: false` → BE chặn login hay vẫn cho login? FE cần handle case nào?
4. Token TTL bao lâu? (Để pre-emptive logout trước khi expire — không bắt buộc cho MVP)

→ Hỏi sau khi gặp lỗi thật trong quá trình implement.
