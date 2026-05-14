# Design — Coin98 Wallet Authentication

> **Mục tiêu:** Thay thế email/password login bằng wallet signature auth dùng Coin98 wallet, theo flow stateless mà BE đã confirm.
>
> **Created:** 2026-05-14
> **Owner:** Tri Nguyen
> **Status:** Design approved — pending implementation plan
> **Replaces:** Email login flow (current `feat/auth-and-submit` branch — sẽ merge vào main trước rồi mở branch wallet riêng)

---

## 0. Bối cảnh

Trading Bot BE đã chuyển toàn bộ auth sang **wallet signature** thay cho Bearer JWT:

- Không có `/user/login`, không có JWT, không có session cookie.
- Mỗi request kèm 3 header `X-Wallet-Address`, `X-Wallet-Nonce`, `X-Wallet-Signature`.
- BE verify `ecrecover(signature, nonce_message) == address`. Khớp → authenticated.
- Auto-create user khi lần đầu thấy wallet — không cần register flow.

FE side hiện đang ở branch `feat/auth-and-submit` (email login + submit-to-BE WIP). Chiến lược:

1. **Merge `feat/auth-and-submit` vào main trước** để có baseline submit flow.
2. **Mở branch mới `feat/wallet-auth`** để thay thế clean toàn bộ email logic.

---

## 1. Quyết định chốt

| Hạng mục | Lựa chọn |
|----------|----------|
| Wallet provider scope | **Chỉ Coin98 wallet extension** (detect `window.coin98.provider` + fallback `window.ethereum.isCoin98`) — block các wallet khác |
| Auth strategy | **Wallet thay hẳn email** — xóa toàn bộ `features/auth/` |
| Storage | **`sessionStorage`** với key `trading_bot_wallet_auth` — không dùng zustand `persist` middleware |
| Dependency thêm | **KHÔNG** — dùng `window.coin98.provider` raw, không thêm wagmi/viem/ethers |
| Branch | `feat/wallet-auth` off main (sau khi merge `feat/auth-and-submit`) |
| 403 behavior | Toast error, **không retry**, **không redirect** — user bấm "Thử lại" thủ công |
| chainChanged event | **Bỏ qua** — auth không bind chain |
| Bootstrap re-verify | **Có** — load app phát gọi `/user/status` để verify cred còn valid không |
| Bypass UX (`VITE_BYPASS_AUTH=true`) | **Auto skip** vào `/builder`, không hiện ConnectWalletPage |
| Bypass headers | **Không gắn fake** — pair với BE chạy mode `AUTH_DISABLED` |

---

## 2. Architecture overview

### 2.1. File structure mới

```
src/features/wallet-auth/
├── wallet.types.ts          — WalletCredentials, NonceResponse, AuthUser
├── wallet.api.ts            — getNonce(addr), getStatus(), disconnect()
├── wallet.provider.ts       — detectCoin98(), requestAccounts(), personalSign()
├── wallet.store.ts          — Zustand store, sessionStorage thủ công (không persist mw)
├── ConnectWalletPage.tsx    — UI thay LoginPage (route: /connect)
├── ProtectedRoute.tsx       — guard: nếu chưa connect → /connect
└── useWalletEvents.ts       — hook lắng accountsChanged + disconnect events

src/lib/http.ts              — SỬA: thay Bearer header bằng X-Wallet-* headers
src/routes.tsx               — SỬA: /login → /connect, đổi LoginPage → ConnectWalletPage
src/main.tsx                 — SỬA: hydrate wallet store + bootstrap loadUser() khi mount
```

### 2.2. File xóa (trên branch `feat/wallet-auth`)

- `src/features/auth/` toàn bộ folder:
  - `LoginPage.tsx`
  - `auth.api.ts` (email login)
  - `auth.store.ts` (JWT store)
  - `auth.types.ts` (email types)
  - `auth.store.test.ts`
  - `ProtectedRoute.tsx` (sẽ tái dựng trong `wallet-auth/`)

### 2.3. Stack tận dụng

- `lib/http.ts` (chỉnh sửa, không re-write)
- `lib/format-error.ts` (giữ nguyên)
- `sonner` toasts
- Zustand (không dùng `persist` middleware ở store này)
- TypeScript, Tailwind, Radix primitives

---

## 3. Wallet connect flow

### 3.1. ConnectWalletPage UI states

| State | Trigger | UI |
|-------|---------|----|
| **detecting** | Mount page, đang check provider | Spinner + "Đang kiểm tra ví Coin98..." (max 1.5s) |
| **no-c98** | `window.coin98.provider` undefined | "⚠️ Chưa cài Coin98 Wallet" + link tới Chrome Web Store + "Đã cài? Refresh trang" |
| **idle** | Phát hiện C98 | Logo + "Đăng nhập Trading Bot" + nút primary `[Kết nối Coin98 Wallet]` |
| **connecting** | Sau khi bấm kết nối, đang chờ `eth_requestAccounts` | "Mở Coin98 để chấp thuận kết nối..." |
| **signing** | Đã có address, đang `personal_sign` | Show address + "Mở Coin98 để ký message..." + `[Cancel]` |
| **error** | User reject / nonce fetch fail / 401 / 403 | Show error cụ thể + `[Thử lại]` |
| **ready** | Sign OK + `/user/status` 200 | (Auto navigate `/builder`) |

### 3.2. Happy path sequence

```
1. Mount ConnectWalletPage
   └─ detectCoin98() → tìm window.coin98.provider HOẶC window.ethereum.isCoin98
      ├─ Found → state: idle
      └─ Not found → state: no-c98

2. User click "Kết nối Coin98 Wallet"
   └─ provider.request({ method: 'eth_requestAccounts' })
      ├─ Reject → state: error ("Bạn đã từ chối kết nối")
      └─ Resolve [address] → normalize toLowerCase() → state: connecting → signing

3. walletApi.getNonce(address)
   └─ GET /wallet/nonce?address=<addr>  (public, không cần headers)
      ├─ 400 → state: error ("Địa chỉ ví không hợp lệ")
      ├─ Network → state: error ("Không thể kết nối server")
      └─ 200 { nonce, message } → next step

4. provider.request({ method: 'personal_sign', params: [message, address] })
   ├─ Reject → state: error ("Bạn đã từ chối ký message")
   └─ "0x...sig" (132 chars) → next step

5. walletStore.setCredentials({ address, nonce, signature })
   └─ Ghi sessionStorage["trading_bot_wallet_auth"] = JSON.stringify(creds)

6. walletApi.getStatus()  → verify cred + lấy user
   └─ GET /user/status với X-Wallet-* headers
      ├─ 401 → http.ts auto-clear sessionStorage + redirect /connect (loop break)
      ├─ 403 → toast "Signature không khớp", clear store, KHÔNG redirect — state: error
      └─ 200 { id, email: null, wallet_address, is_active, is_admin }
         └─ setUser(...) → state: ready → navigate('/builder', { replace: true })
```

### 3.3. Coin98 detection

```ts
function detectCoin98(): EthereumProvider | null {
  const win = window as any;
  // Coin98 chuẩn: window.coin98.provider
  if (win.coin98?.provider) return win.coin98.provider;
  // Fallback: window.ethereum với flag isCoin98
  if (win.ethereum?.isCoin98) return win.ethereum;
  return null;
}
```

Detection có thể chạy lại sau short delay (300ms) vì wallet inject async — tránh race condition mount-time.

---

## 4. HTTP layer changes

### 4.1. `src/lib/http.ts` — đổi authorization header

**Trước:**
```ts
const token = getToken();
if (token) headers['Authorization'] = `Bearer ${token}`;
```

**Sau:**
```ts
const creds = getWalletCredentials();
const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
if (creds && !isPublic) {
  headers['X-Wallet-Address']   = creds.address;
  headers['X-Wallet-Nonce']     = creds.nonce;
  headers['X-Wallet-Signature'] = creds.signature;
}
```

### 4.2. Public paths (whitelist không gắn headers)

```ts
const PUBLIC_PATHS = [
  '/wallet/nonce',
  '/internal/',
  '/webhook/',
  '/docs',
  '/openapi',
  '/health',
];
```

(BE confirm Q1: các path này bypass auth middleware.)

### 4.3. `getWalletCredentials()`

```ts
function getWalletCredentials(): WalletCredentials | null {
  try {
    const raw = sessionStorage.getItem('trading_bot_wallet_auth');
    if (!raw) return null;
    return JSON.parse(raw) as WalletCredentials;
  } catch {
    return null;
  }
}

function clearWalletAuth() {
  try {
    sessionStorage.removeItem('trading_bot_wallet_auth');
  } catch { /* noop */ }
}
```

### 4.4. Error handling thay đổi

| Status | Hành vi |
|--------|---------|
| **401** | `clearWalletAuth()` + toast "Phiên ví hết hạn, vui lòng kết nối lại" + redirect `/connect` |
| **403** | Toast "Signature không khớp địa chỉ ví" + **KHÔNG** clear + **KHÔNG** redirect + **KHÔNG** retry auto. (Đặc biệt: 403 ở submit endpoint thì silentToast = true để dialog hiện error riêng.) |
| **400** | Giữ nguyên — chung |
| **422** | Giữ nguyên — `ValidationError` |

### 4.5. `SILENT_TOAST_PREFIXES` giữ nguyên

`['/bot-strategy/', '/bot/']` — submit dialog có error box riêng, http.ts không fire toast.

### 4.6. `BYPASS_AUTH` env

Khi `VITE_BYPASS_AUTH=true`:
- `http.ts` không gắn X-Wallet-* headers, không xử lý 401/403 redirect (giả định BE cũng đang `AUTH_DISABLED`).
- `ProtectedRoute` cho qua hẳn — không redirect `/connect`.

---

## 5. State management

### 5.1. `wallet.store.ts` shape

```ts
interface WalletCredentials {
  address: string;     // lowercase
  nonce: string;
  signature: string;
}

interface AuthUser {
  id: number;
  email: string | null;        // luôn null cho wallet user
  wallet_address: string;
  is_active: boolean;
  is_admin: boolean;
}

interface WalletState {
  // Persisted in sessionStorage thủ công
  address: string | null;
  nonce: string | null;
  signature: string | null;

  // In-memory only
  user: AuthUser | null;
  status: 'idle' | 'detecting' | 'no-c98' | 'connecting' | 'signing' | 'ready' | 'error';
  error: string | null;

  // Actions
  hydrate: () => void;
  connect: () => Promise<void>;       // detect → req accounts → nonce → sign → verify
  disconnect: () => Promise<void>;    // POST /wallet/disconnect best-effort + clear
  loadUser: () => Promise<void>;      // gọi /user/status
  reset: () => void;                   // clear không gọi BE
}
```

### 5.2. Tại sao KHÔNG dùng `persist` middleware

- Spec yêu cầu storage key cố định (`trading_bot_wallet_auth`) với shape phẳng `{address, nonce, signature}`.
- `persist` mặc định wrap thành `{state: {...}, version: ...}` — không match spec.
- Chỉ persist 3 field credentials, không persist `user`/`status`/`error`.
- → Ghi/đọc sessionStorage thủ công trong `connect()` / `disconnect()` / `hydrate()`.

### 5.3. `user` không persist

- Sau reload, FE bắt buộc gọi `/user/status` để verify cred còn valid + lấy fresh user info.
- Nếu nonce đã hết hạn (24h) → 401 → http.ts auto-clear + redirect.
- Đây là source of truth duy nhất.

### 5.4. App bootstrap (trong `main.tsx`)

```tsx
function AppBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const store = useWalletStore.getState();
    store.hydrate();
    if (store.address) {
      store.loadUser();  // verify cred + lấy user; 401 thì http.ts tự xử
    }
  }, []);
  return <>{children}</>;
}
```

### 5.5. Selector hook (theo pattern cũ)

```ts
export const useIsAuthenticated = () =>
  useWalletStore((s) => !!s.address && !!s.signature);
```

---

## 6. Wallet events handling

### 6.1. Events được lắng

| Event | Fire khi | FE xử lý |
|-------|----------|----------|
| `accountsChanged` | User đổi account trong C98 | Clear sessionStorage + redirect `/connect` |
| `accountsChanged` với `[]` | User disconnect site khỏi wallet | Clear + redirect `/connect` |
| `disconnect` | Provider tự disconnect | Clear + redirect `/connect` |
| `chainChanged` | User đổi network | **Bỏ qua** (auth không bind chain) |

### 6.2. `useWalletEvents.ts` hook

Mount **1 lần duy nhất** ở App root (không trong từng page).

```tsx
useEffect(() => {
  const provider = detectCoin98();
  if (!provider) return;

  const onAccountsChanged = (accounts: string[]) => {
    const current = useWalletStore.getState().address;
    const next = accounts[0]?.toLowerCase();
    if (!next || next !== current) {
      useWalletStore.getState().disconnect();
      window.location.href = '/connect';
    }
  };

  const onDisconnect = () => {
    useWalletStore.getState().disconnect();
    window.location.href = '/connect';
  };

  provider.on('accountsChanged', onAccountsChanged);
  provider.on('disconnect', onDisconnect);

  return () => {
    provider.removeListener('accountsChanged', onAccountsChanged);
    provider.removeListener('disconnect', onDisconnect);
  };
}, []);
```

### 6.3. `disconnect()` action

```ts
disconnect: async () => {
  // Best-effort báo BE invalidate nonce — không await, không block UX
  walletApi.disconnect().catch(() => { /* ignore */ });
  // Clear local
  clearWalletAuth();
  set({
    address: null, nonce: null, signature: null,
    user: null, status: 'idle', error: null,
  });
}
```

Nếu `POST /wallet/disconnect` fail (network/500) → vẫn clear local. UX không bị block.

---

## 7. CI / dev bypass mode

### 7.1. Khi `VITE_BYPASS_AUTH=true`

| Layer | Hành vi |
|-------|---------|
| `ProtectedRoute` | Cho qua không check store, không redirect |
| `http.ts` | Không gắn `X-Wallet-*` headers; không xử lý 401/403 redirect |
| `App bootstrap` | Skip `hydrate()` + `loadUser()` |
| `useWalletEvents` | Không attach listeners |
| `ConnectWalletPage` | Auto redirect `/builder` nếu user vào đây |

### 7.2. Env files

- `.env.development` — default `VITE_BYPASS_AUTH=false` (dev thật)
- `.env.test` (mới) — `VITE_BYPASS_AUTH=true` cho CI
- `.env.local` — dev tự set true nếu muốn skip wallet

---

## 8. Address normalization (Q4 từ BE)

**Quy tắc**: luôn `.toLowerCase()` trước khi:

1. Gửi `?address=<addr>` query param
2. Gắn header `X-Wallet-Address`
3. Lưu `sessionStorage`
4. So sánh trong `accountsChanged` handler

```ts
const normalized = address.toLowerCase();
```

Tránh case BE compare lowercase mà FE gửi checksum → recover khớp nhưng compare miss.

---

## 9. Testing strategy

| Layer | Test type | Tool | Coverage |
|-------|-----------|------|----------|
| `wallet.provider.ts` | Unit | Vitest | Mock `window.coin98.provider`; test detect / requestAccounts / personalSign + error (no provider, user reject) |
| `wallet.store.ts` | Unit | Vitest + jsdom | Mock `walletApi` + provider; test `connect()` happy / sign-reject / nonce-fail / status-401 |
| `wallet.api.ts` | Unit | Vitest | Mock fetch; assert URL, headers, body, response parsing |
| `http.ts` | Unit (update) | Vitest | Update existing `http.test.ts`: thay assert `Authorization: Bearer` sang `X-Wallet-*` headers |
| `ConnectWalletPage.tsx` | Component | Testing Library | Render từng UI state qua mock store; test buttons trigger đúng actions |
| `useWalletEvents.ts` | Hook | Testing Library | Mock provider events; assert disconnect được gọi |
| E2E happy path | Manual | Browser + C98 thật | Connect → submit bot → verify BE tạo bot OK |

**Test files DELETE**:
- `src/features/auth/auth.store.test.ts`

---

## 10. BE confirmations (đã có)

Tất cả từ file `Q1-Q6.md` của Tuấn:

| # | Câu hỏi | BE confirm |
|---|---------|------------|
| 1 | Endpoints đã chuyển X-Wallet-*? | ✅ Tất cả. Bypass paths: `/wallet/nonce`, `/internal/*`, `/webhook/*`, `/docs`, `/openapi`, `/health` |
| 2 | `/user/status` shape? | ✅ `{id, email: null, wallet_address, is_active, is_admin}` — dùng `wallet_address` làm identity |
| 3 | Nonce TTL? | ✅ 24h, reusable trong TTL, không one-time |
| 4 | Address case? | ✅ Middleware normalize lowercase — FE phải `.toLowerCase()` trước khi gửi/lưu |
| 5 | Register flow? | ✅ Không cần — auto-create user khi lần đầu connect |
| 6 | Disconnect body? | ✅ Empty body, chỉ headers; response `{status: "ok"}` |
| 7 | HTTPS? | ⏳ Dev BE đang HTTP (mạng local cty) — HTTPS sẽ áp dụng khi lên stag/prod |

**Hệ quả Q7**: tiếp tục dùng Vite proxy ở dev (`VITE_API_BASE_URL=/api` → forward `http://tradingbot.ne.com:8088`). Production cần BE bật HTTPS hoặc Vercel rewrite — vẫn là open question như PLAN_LOGIN_SUBMIT.md cũ.

---

## 11. Migration steps (ngắn gọn — chi tiết sẽ ở implementation plan)

1. Merge `feat/auth-and-submit` vào main (có baseline submit + email login tạm).
2. Mở `feat/wallet-auth` off main.
3. Tạo `src/features/wallet-auth/` (theo Section 2).
4. Sửa `lib/http.ts` (theo Section 4).
5. Sửa `routes.tsx` + `main.tsx`.
6. Xóa `src/features/auth/`.
7. Update test files.
8. Smoke test với C98 thật trên dev.
9. Open PR — review — merge.

---

## 12. Future considerations (KHÔNG làm ở phase này)

- WalletConnect / multi-wallet support
- Link nhiều wallet vào 1 account
- Chain locking (force user kết nối đúng chain Hyperliquid)
- Wallet display name / ENS lookup
- "Remember me" cho cross-tab UX (nâng cấp lên localStorage có encryption)

---

## 13. Definition of Done

- [ ] User mở `/` → bị redirect `/connect` (nếu chưa connect)
- [ ] User bấm "Connect" → wallet popup → ký → redirect `/builder`
- [ ] Mọi API call kèm 3 headers `X-Wallet-*`
- [ ] User đổi account trong wallet → auto redirect `/connect`
- [ ] 401 từ bất kỳ endpoint nào → clear sessionStorage + redirect `/connect`
- [ ] 403 từ bất kỳ endpoint nào → toast, không redirect, không retry
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` pass
- [ ] Smoke test: connect C98 thật → create bot thật → verify BE response
- [ ] `features/auth/` đã xóa hoàn toàn
- [ ] `feat/auth-and-submit` đã merge vào main trước khi bắt đầu
