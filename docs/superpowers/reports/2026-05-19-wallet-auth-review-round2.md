# Wallet Auth Review — Round 2

> **Date:** 2026-05-19
> **Reviewer:** Devin
> **Base commit:** `4769338` (docs(wallet-auth): apply triple-reviewed spec/plan fixes)
> **Scope:** Verify 10 fixes from round 1, regression check, BE doc alignment, is_active recommendation, new gaps

---

## 1. Fix Verification

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| **A1** | `http.test.ts` 403 assertion dùng `'Signature'` thay vì `'Chữ ký'` | **PASS** | Plan line 593: `expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Chữ ký'))` — khớp toast message `'Chữ ký không khớp địa chỉ ví...'` ở line 881 |
| **B1** | §6.2 handlers `onAccountsChanged`/`onDisconnect` phải async + await `disconnect()` | **PASS** | Spec §6.2 line 354/363: cả 2 handlers đều `async` + `await disconnect()` trước `window.location.href`. Plan line 1980/1990: tương tự. Plan tests line 1891/1903: `await onHandlers.accountsChanged(...)` — đúng await |
| **B2** | §5.4 phải reflect module-level hydrate, không phải useEffect | **PASS** | Spec §5.4 đã split: §5.4.1 (module-level hydrate) + §5.4.2 (AppBootstrap chỉ gọi `loadUser()`). Comment rõ: "hydrate() đã chạy ở module-level — không gọi lại ở đây" |
| **B3** | §4.3 `getWalletCredentials()` phải validate cả 3 field | **PASS** | Spec §4.3 line 198: `if (!parsed.address \|\| !parsed.nonce \|\| !parsed.signature) return null;` |
| **B4** | §7.1 bypass table row "App bootstrap" phải ghi rõ hydrate vẫn chạy | **PASS** | Spec §7.1: "Skip `loadUser()` (hydrate vẫn chạy module-level nhưng no-op khi sessionStorage rỗng)" |
| **C1** | Plan cần test `connect()` khi `/user/status` fail sau sign | **PASS** ⚠️ | Test thêm ở plan line 1210: "clears creds and sets error when /user/status fails after sign". Assert đủ 5 điểm (status, address, nonce, signature, sessionStorage). **Nhưng có lỗi import — xem §5 Gap #1** |
| **C2** | `useIsAuthenticated` selector thêm `!!s.nonce` | **PASS** | Spec §5.5 line 328 + Plan line 1502-1503: `!!s.address && !!s.nonce && !!s.signature` |
| **C4** | Xoá `.env.test` khỏi spec, giữ `vi.stubEnv` per-test | **PASS** | Spec §7.2 line 423: "Tests dùng `vi.stubEnv` per-test [...] **không cần** `.env.test`. Lý do: nếu set `BYPASS=true` ở `.env.test`, sẽ break các test cần `BYPASS=false`" |
| **D1** | §13 (DoD) phải đứng trước §14 (Known limitations) | **PASS** | Spec: §13 DoD ở line 501, §14 Known Limitations ở line 517 |
| **D3** | §3.2 step 2 state diagram rõ ràng hơn | **PASS** | Spec §3.2: `connecting` set TRƯỚC `requestAccounts`, `signing` set SAU `Resolve [address]` — flow rõ |

**Tổng: 10/10 PASS** (1 có issue phụ — C1 import, xem §5)

---

## 2. Regression Check

### 2.1. §5.4 split → references ở chỗ khác

**Không có regression.** Grep toàn bộ spec + plan: không có reference nào trỏ tới "§5.4" (dạng text). Plan line 2113 reference "§7.1" vẫn valid — bypass mode section không thay đổi.

### 2.2. §6.3 disconnect bắt buộc await → all callers

**Không có regression.** 2 callers đã update:

| Caller | File (Plan) | Pattern | Đúng? |
|--------|-------------|---------|-------|
| `useWalletEvents` | Plan line 1985/1991 | `await disconnect()` → `window.location.href` | ✅ |
| `HeaderToolbar` logout | Plan line 2225 (Task 10.5) | `await disconnect()` → `navigate('/connect')` + `onClick={async () => {` | ✅ |

Không có caller thứ 3 — grep `disconnect()` chỉ thấy 2 call sites ngoài store action chính.

### 2.3. §5.5 selector thêm `!!s.nonce` → assume 2-field ở chỗ khác

**Không có regression.** `useIsAuthenticated` là selector duy nhất check cred fields. `ProtectedRoute` gọi qua hook này. Không có code nào check 2 field riêng.

### 2.4. §13 DoD bullet "luôn await disconnect trước navigate" → Plan Task 12 verify

**Minor gap.**

DoD line 509 yêu cầu: _"caller `await disconnect()` [...] trước khi navigate/clear local — **verify ở Network tab**"_

Plan Task 12 (smoke test) step 4 nói: _"switch to a different account → app should auto-redirect back to /connect"_

→ Step 4 test đúng behavior nhưng **không hướng dẫn verify Network tab** (kiểm tra POST `/wallet/disconnect` response 200 trước khi location change). Tester cẩn thận sẽ đọc DoD và tự verify, nhưng lý tưởng Task 12 nên explicit.

**Fix đề xuất:** Thêm sub-step vào Task 12 step 4:
```
4b. Open Network tab → switch account → verify POST /wallet/disconnect
    fires AND completes (200) BEFORE page navigates to /connect.
```

---

## 3. BE Doc ↔ Spec Alignment

### 3.1. §4.4 case mapping ↔ BE doc

**Gap trong BE doc.** Spec §4.4 có bảng status mapping chi tiết (401 cho nonce expired/thiếu headers, 403 cho sig mismatch). Nguồn: confirm verbal từ Tuấn 2026-05-19.

BE doc (`auth-architecture.md` Layer 1) mô tả flow middleware (verify nonce → recover → compare) nhưng **không có bảng status code** (không ghi 401 trả về khi nào, 403 khi nào).

**Recommendation:** Tuấn thêm section "Error Responses" vào BE doc Layer 1 để spec FE và BE doc khớp nhau. Đề xuất table:

```markdown
### Error Responses (Wallet Auth Middleware)

| Status | Condition | Response body |
|--------|-----------|---------------|
| 401    | Nonce hết TTL / không có trong Redis | `{"detail": "Nonce expired or invalid"}` |
| 401    | Thiếu 1+ header X-Wallet-* | `{"detail": "Missing wallet headers"}` |
| 401    | Address/Signature sai format | `{"detail": "Invalid wallet credentials"}` |
| 403    | ecrecover address ≠ header address | `{"detail": "Signature mismatch"}` |
```

### 3.2. §6.3 disconnect ↔ BE doc

**Gap trong BE doc.** Spec §6.3 ghi rõ: "BE xoá `wallet_nonce:0x...` khỏi Redis." BE doc chỉ list route `/wallet/disconnect` (line 90) nhưng **không mô tả behavior** (xoá Redis key nào, response shape, side effects).

**Recommendation:** Tuấn thêm vào BE doc Layer 1:

```markdown
### /wallet/disconnect

- **Method:** POST
- **Auth:** Requires X-Wallet-* headers
- **Behavior:** Xoá key `wallet_nonce:{address}` khỏi Redis → nonce invalid ngay lập tức (không cần chờ TTL)
- **Response:** `{"status": "ok"}`
- **Lý do security:** Nếu chỉ clear FE mà không xoá Redis, cred bị steal vẫn auth được trong ≤24h
```

### 3.3. Các chi tiết BE doc Layer 1 mà spec FE chưa cover

| Detail trong BE doc | Spec FE | Cần thêm? |
|---------------------|---------|-----------|
| Message format: `"Sign this message to authenticate with Gamma Trade.\n\nNonce: {nonce}"` | Không ghi — FE dùng `message` trả về từ `/wallet/nonce` | **Không** — FE pass-through, không cần hardcode |
| Recovery: `eth_account.Account.recover_message()` | Không ghi | **Không** — BE implementation detail |
| BE doc nói "MetaMask" nhiều chỗ | FE spec nói "Coin98" | **Nên sửa BE doc** dùng "wallet" hoặc "EIP-1193 provider" thay "MetaMask" để tránh confusion |

### 3.4. Nonce expiry status code (câu hỏi mở từ round 1)

Spec §4.4 ghi 401 cho "Nonce hết hạn". BE doc không confirm. Câu hỏi cho Tuấn:

> **Q7 (mới):** Khi nonce hết TTL 24h, middleware trả 401 hay 403?
> - Nếu 401 → FE auto-clear + redirect → OK
> - Nếu 403 → FE chỉ toast, **KHÔNG** redirect → user stuck
> 
> Spec hiện assume 401. Xin confirm.

---

## 4. `is_active=false` — Recommendation

### Tình trạng

BE Tuấn chưa trả lời round 1 câu C3 (is_active semantics). `/user/status` response chứa `is_active: boolean` nhưng không rõ:

1. BE middleware có block user inactive (trả 401/403) hay vẫn cho qua?
2. FE có cần check `is_active` sau khi nhận 200 không?
3. Hay `is_active` chỉ là metadata hiển thị?

### Đề xuất FE (áp dụng được ngay, không cần chờ BE)

**Thêm defensive check trong `connect()`** — cheap (1 if-statement), safe cho cả 3 scenario:

```ts
// Trong connect(), sau khi getStatus() thành công:
const user = await walletApi.getStatus();

// Defensive: nếu BE trả 200 nhưng user bị disable,
// không cho vào builder. Nếu BE middleware đã block thì
// code này không bao giờ chạy tới (đã bị 401/403 trước đó).
if (!user.is_active) {
  clearStorage();
  set({
    address: null, nonce: null, signature: null,
    user: null, status: 'error',
    error: 'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ admin.',
  });
  return;
}

set({ user, status: 'ready' });
```

**Tại sao approach này an toàn:**

| Scenario BE | FE behavior |
|-------------|-------------|
| BE middleware block inactive → 401 | http.ts clear + redirect `/connect` — code trên không chạy tới |
| BE middleware block inactive → 403 | connect() catch block xử lý — code trên không chạy tới |
| BE trả 200 với `is_active=false` | Code trên catch, hiện error rõ ràng cho user |
| BE trả 200 với `is_active=true` (normal) | Code trên skip, flow bình thường |

**Action items:**
1. Thêm đoạn code trên vào spec §3.2 step 6 và plan `connect()` action
2. Thêm test case: `it('shows error when user is inactive', ...)`
3. **Vẫn cần gửi câu hỏi cho Tuấn** — nếu BE middleware đã block thì check FE là redundant (nhưng không hại). Câu hỏi:

> **Q8 (is_active):** Khi `is_active=false`:
> 1. Middleware có block request trước khi tới handler không? Nếu có, trả status code nào (401/403)?
> 2. Hay middleware vẫn cho qua, để FE tự quyết định?
> 3. Use case nào set `is_active=false`? (admin ban? tự deactivate? chưa verify?)

---

## 5. Gaps Mới

### Gap #1 (BUG): C1 test dùng `new HttpError()` nhưng thiếu import

**Vị trí:** Plan `wallet.store.test.ts` line 1219

```ts
vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
  new HttpError(403, 'Forbidden'),  // ← HttpError chưa import
);
```

**Context:** File import ở plan lines 1011-1018 không có `HttpError`. Các test cũ ở lines 1117/1137 dùng `Object.assign(new Error('Forbidden'), { name: 'HttpError', status: 403 })` để tránh dependency.

**Fix — chọn 1 trong 2:**

**Option A** (recommended — consistent): Đổi line 1219 thành pattern Object.assign cho consistent với tests line 1117/1137:
```ts
vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
  Object.assign(new Error('Forbidden'), { name: 'HttpError', status: 403 }),
);
```

**Option B**: Thêm import `HttpError` vào đầu file:
```ts
import { HttpError } from '@/lib/http';
```
Nhưng cần kiểm tra `HttpError` có được export không, và import này có bị vi.mock shadow không.

→ **Option A an toàn hơn** vì giữ nguyên pattern đã dùng trong file.

### Gap #2 (MINOR): Task 12 smoke test thiếu verify disconnect ở Network tab

Đã mô tả ở §2.4. Thêm sub-step `4b` vào Task 12 step 4.

### Gap #3 (DOC): BE doc thiếu status code mapping + disconnect behavior

Đã mô tả ở §3.1 + §3.2. Recommendation: Tuấn thêm 2 section vào `auth-architecture.md` Layer 1.

### Gap #4 (DOC): BE doc dùng "MetaMask" thay vì generic "wallet"

BE doc dùng "MetaMask" xuyên suốt nhưng FE dùng Coin98. Nên sửa thành "EIP-1193 wallet provider" hoặc "MetaMask / Coin98" để tránh confusion khi developer đọc cả 2 doc.

---

## Action Items (Actionable — Apply Ngay)

### Must-fix (trước implementation)

| # | Item | File | Fix |
|---|------|------|-----|
| **1** | C1 test import lỗi | Plan `wallet.store.test.ts` line 1219 | Đổi `new HttpError(403, 'Forbidden')` → `Object.assign(new Error('Forbidden'), { name: 'HttpError', status: 403 })` |
| **2** | `connect()` thêm `is_active` check | Spec §3.2 step 6 + Plan `connect()` | Thêm defensive check (xem §4 code block) |
| **3** | Test cho `is_active=false` | Plan `wallet.store.test.ts` | Thêm test case `it('shows error when user is inactive', ...)` |

### Should-fix (cheap, better doc)

| # | Item | File | Fix |
|---|------|------|-----|
| **4** | Task 12 Network tab verify | Plan Task 12 step 4 | Thêm sub-step 4b (xem §2.4) |
| **5** | BE doc status codes | `auth-architecture.md` Layer 1 | Gửi Tuấn bảng đề xuất (xem §3.1) |
| **6** | BE doc disconnect behavior | `auth-architecture.md` Layer 1 | Gửi Tuấn section đề xuất (xem §3.2) |
| **7** | BE doc "MetaMask" → generic | `auth-architecture.md` | Sửa wording (xem §3.4) |

### Cần BE confirm

| # | Câu hỏi | Priority |
|---|---------|----------|
| **Q7** | Nonce hết TTL → 401 hay 403? | P0 — ảnh hưởng UX (user stuck nếu 403) |
| **Q8** | `is_active=false` semantics (3 sub-questions) | P1 — defensive code đã cover, nhưng cần confirm |

---

## Summary

Round 1 fixes đều **PASS** — apply đúng intent. 1 bug nhỏ mới (C1 import), 1 defensive feature nên thêm (`is_active` check), và 3 doc gaps ở BE doc. Không có regression từ các fixes.
