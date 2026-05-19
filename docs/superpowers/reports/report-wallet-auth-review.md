# Báo cáo Review: C98 Wallet Auth — Design Spec + Implementation Plan

> Review sau commit `f56ecaf` — đã đọc toàn bộ 512 dòng spec + 2415 dòng plan.

---

## A. BUG trong test — sẽ FAIL khi chạy

### A1. `http.test.ts` — 403 toast assertion sai ngôn ngữ ❌

**File:** Plan Task 4, `http.test.ts` (dòng ~582–594 plan)

```ts
// Test viết:
expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Signature'));

// Implementation viết:
toast.error('Chữ ký không khớp địa chỉ ví. Vui lòng kết nối lại.');
```

Test assert `"Signature"` (tiếng Anh) nhưng toast message là tiếng Việt `"Chữ ký không khớp..."`. Test này sẽ **FAIL**.

**Fix:** Đổi assertion thành `expect.stringContaining('Chữ ký')` hoặc `expect.stringContaining('không khớp')`.

---

## B. Mâu thuẫn giữa Design Spec và Implementation Plan

### B1. `disconnect()` — Design nói fire-and-forget, Plan lại `await`

**Design spec §6.3:**
```ts
// "không await, không block UX"
walletApi.disconnect().catch(() => { /* ignore */ });
clearWalletAuth();
set({...});
```

**Plan Task 6 (`wallet.store.ts`):**
```ts
// await = block đến khi BE respond
try {
  await walletApi.disconnect();
} catch { /* ignore */ }
clearStorage();
set({...});
```

Design nói rõ "không await, không block UX" nhưng Plan lại `await`. Hai cách đều handle failure đúng, nhưng `await` sẽ **block UI** cho đến khi BE respond (hoặc timeout), ảnh hưởng cảm nhận UX khi disconnect.

**Khuyến nghị:** Dùng fire-and-forget như design spec — hoặc nếu chọn await, cập nhật lại design spec ghi rõ thay đổi quyết định.

### B2. `AppBootstrap` — Design vẫn gọi `hydrate()` trong `useEffect`, Plan đã chuyển sang module-level

**Design spec §5.4** vẫn viết:
```tsx
useEffect(() => {
  const store = useWalletStore.getState();
  store.hydrate();  // ← vẫn gọi hydrate ở đây
  if (store.address) {
    store.loadUser();
  }
}, []);
```

**Plan Task 6 + Task 10** đã chuyển sang:
- `hydrate()` chạy ở module-level khi import `wallet.store.ts`
- `AppBootstrap` chỉ gọi `loadUser()`, **không gọi `hydrate()` nữa**

Design spec chưa được cập nhật để phản ánh thay đổi module-level hydrate này.

### B3. `getWalletCredentials()` — Design không validate fields, Plan thì có

**Design spec §4.3:**
```ts
return JSON.parse(raw) as WalletCredentials;  // cast thẳng, không check
```

**Plan Task 4 (`http.ts`):**
```ts
const parsed = JSON.parse(raw) as Partial<WalletCreds>;
if (!parsed.address || !parsed.nonce || !parsed.signature) return null;  // validate
```

Plan version tốt hơn (validate trước khi dùng). Design nên cập nhật cho nhất quán.

### B4. Design §7.1 nói bypass skip `hydrate()`, nhưng module-level hydrate chạy vô điều kiện

Design spec §7.1 bảng bypass:
> **App bootstrap**: Skip `hydrate()` + `loadUser()`

Nhưng module-level hydrate chạy tại import time, **không check `BYPASS_AUTH`**:
```ts
if (typeof window !== 'undefined') {
  useWalletStore.getState().hydrate();  // luôn chạy
}
```

Thực tế không gây bug (hydrate đọc empty sessionStorage → no-op), nhưng mâu thuẫn với tài liệu.

---

## C. Logic thiếu / chưa cover

### C1. Không có test cho `connect()` khi `/user/status` fail (403/network)

Design spec §3.2 step 6 + comment "Important" nói rõ:
> connect() MUST call walletApi.getStatus() directly and throw on failure

Nhưng `wallet.store.test.ts` **chỉ test** các trường hợp:
- Happy path
- No provider
- User reject accounts
- User reject signing
- `getNonce` fail

**THIẾU test** cho trường hợp `walletApi.getStatus()` fail sau khi sign thành công. Đây chính là bug mà update `f56ecaf` fix, nhưng lại không có test bảo vệ nó.

**Khuyến nghị:** Thêm test:
```ts
it('sets error when /user/status fails after successful sign', async () => {
  // setup detect, accounts, nonce, sign OK
  vi.mocked(walletApi.getStatus).mockRejectedValueOnce(new Error('403'));
  await useWalletStore.getState().connect();
  expect(useWalletStore.getState().status).toBe('error');
  expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
});
```

### C2. `useIsAuthenticated` chỉ check `address` + `signature`, thiếu `nonce`

```ts
export const useIsAuthenticated = () =>
  useWalletStore((s) => !!s.address && !!s.signature);
```

Nhưng `http.ts` validate cả 3 fields (`address`, `nonce`, `signature`). Nếu bằng cách nào đó `nonce` bị null mà `address` + `signature` có, thì:
- `ProtectedRoute` cho vào `/builder` ✓
- Nhưng `http.ts` gửi request **không có headers** → 401 → redirect → loop

**Khuyến nghị:** Thêm `!!s.nonce` vào selector, hoặc document rõ tại sao bỏ qua.

### C3. Không handle `is_active: false` từ BE

`AuthUser` có field `is_active: boolean`, nhưng **không có logic nào** check trường hợp BE trả `is_active: false`:
- `ProtectedRoute` chỉ check `address` + `signature`
- `connect()` flow set `status: 'ready'` bất kể `is_active` là gì
- Không có toast/warning nào cho user bị deactivate

Nếu BE đặt `is_active: false` cho 1 user, user đó vẫn vào app bình thường.

**Câu hỏi cần confirm với BE:** BE có dùng `is_active` để block access không, hay đó chỉ là metadata?

### C4. Thiếu task tạo file `.env.test`

Design spec §7.2 quy định:
> `.env.test` (mới) — `VITE_BYPASS_AUTH=true` cho CI

Nhưng **không task nào** trong plan (Task 0–12) tạo file này. Nếu thiếu, CI sẽ chạy test với `VITE_BYPASS_AUTH` undefined → có thể ảnh hưởng test kết quả.

**Khuyến nghị:** Thêm bước tạo `.env.test` vào Task 5 (test setup) hoặc Task 0.

### C5. `window.location.href = '/connect'` race với `disconnect()` trong `useWalletEvents`

Khi wallet fire `accountsChanged` hoặc `disconnect`:
```ts
void useWalletStore.getState().disconnect();  // fire-and-forget
window.location.href = '/connect';            // navigate ngay
```

`disconnect()` gọi `await walletApi.disconnect()` (BE call), nhưng `window.location.href` navigate ngay → page reload → kill in-flight API call → BE disconnect **không bao giờ hoàn thành**.

Thực tế: vì disconnect là best-effort nên chấp nhận được. Nhưng nên **document** rõ rằng BE disconnect có thể không thực sự hoàn thành trong trường hợp này.

---

## D. Structural / Documentation Issues

### D1. Section numbering lộn: §14 trước §13

Design spec:
- `## 14. Known limitations (accepted v1 risks)` — dòng 462
- `## 13. Definition of Done` — dòng 501

Section 14 nằm trước Section 13. Nên swap lại đúng thứ tự.

### D2. Task numbering — "Task 10.5" lẻ

Plan dùng "Task 10.5" cho HeaderToolbar migration. Nếu agentic worker chạy tuần tự theo task number, pattern "10.5" có thể bị skip hoặc gây confusion. Nên rename thành Task 11 và shift các task sau.

### D3. Design spec §3.2 step 2 state transition diagram không khớp implementation

Design spec step 2:
```
Resolve [address] → normalize toLowerCase() → state: connecting → signing
```

Nhưng implementation (Plan Task 6):
```ts
set({ status: 'connecting' });              // connecting TRƯỚC requestAccounts
const [address] = await requestAccounts(provider);
set({ status: 'signing', address });        // signing SAU requestAccounts
```

Thực tế: `connecting` được set **trước** khi gọi `requestAccounts`, không phải sau khi resolve. Diagram nên sửa lại cho đúng flow.

---

## E. Minor / Nice-to-have

### E1. `Content-Type: application/json` gắn cho mọi request kể cả không có body

`http.ts` luôn set `Content-Type: application/json` header, kể cả GET requests và POST `/wallet/disconnect` (empty body). Không gây lỗi nhưng technically không cần thiết và có thể gây confused nếu BE strict về content-type.

### E2. Poll timing khác nhau giữa `ConnectWalletPage` (5×500ms=2.5s) và `useWalletEvents` (10×500ms=5s)

Cả hai đều poll cho provider injection, nhưng timeout khác nhau. Điều này có thể intentional (events hook cần kiên nhẫn hơn), nhưng nên ghi chú lý do trong comment hoặc spec.

### E3. `personal_sign` param order

Implementation dùng `params: [message, address]` (đúng EIP-191 standard). Tuy nhiên một số wallet historically dùng reversed order. Cần verify với Coin98 cụ thể trong smoke test (Plan Task 12 Step 2).

---

## F. Tổng kết

| Mức độ | Số lượng | Tóm tắt |
|--------|----------|---------|
| **Bug (test sẽ fail)** | 1 | 403 toast assertion sai ngôn ngữ |
| **Mâu thuẫn Design ↔ Plan** | 4 | disconnect await, hydrate location, getWalletCreds validation, bypass+hydrate |
| **Logic thiếu** | 5 | Missing test cho getStatus fail, useIsAuthenticated thiếu nonce, is_active, .env.test, disconnect race |
| **Documentation** | 3 | Section numbering, Task 10.5, state diagram |
| **Minor** | 3 | Content-Type, poll timing, personal_sign order |

**Ưu tiên sửa:**
1. Fix bug A1 (test sẽ fail — sửa 1 dòng)
2. Thêm test C1 (bảo vệ fix quan trọng nhất của commit f56ecaf)
3. Quyết định B1 (disconnect: await hay fire-and-forget?) rồi sync design ↔ plan
4. Tạo `.env.test` (C4)
5. Cập nhật design spec cho B2, B3, B4, D1, D3
