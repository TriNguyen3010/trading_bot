# Tier 1 Findings — Critical vùng (Live/tiền thật)

> Review 4 vùng critical (agent-wallet, launchpad, serializer/schema, http) bằng 4 subagent song song, **Claude tự verify lại từng finding với code thật**. Baseline: 561 test xanh.
> **Kết luận: KHÔNG có Blocker.** 3 bug serializer/schema thật & đáng fix; còn lại latent/defensive hoặc đã biết.
> Ngày: 2026-06-03

---

## ✅ Đã verify thật — NÊN FIX (FE, có thể TDD ngay)

### F1 — `trailing_stop_positive_offset` refine chặn oan khi trailing TẮT · Important

- **`schemas/unified-bot-strategy.schema.ts:369-383`** + **`serializer.ts:81-83`**
- `superRefine` bắt `offset > positive` **vô điều kiện**; nhưng `buildRisk` **luôn** emit `trailing_stop_positive`/`offset` (kể cả `trailing_stop:false`).
- **Hậu quả:** user từng để trailing ON với offset≤positive rồi TẮT trailing → giá trị còn đó (inert) nhưng export/submit **bị Zod chặn** dù trailing không dùng. Freqtrade bỏ qua field này khi trailing off → FE strict hơn cần thiết.
- **Fix:** gate refine bằng `data.trailing_stop === true` (1 dòng). Test: trailing off + offset≤positive → parse pass.

### F2 — SL bị dựng sai khi import: tp_sl tắt SL → quay lại thành SL bật −40% · Important

- **`serializer.ts:600`** `slEnabled: (risk?.stoploss ?? -0.4) > -0.4 || closeType === 'tp_sl'`
- Export bot tp_sl + SL **disabled** ghi `risk.stoploss = -0.4` (sentinel, `buildRisk:78`). Import lại: `-0.4 > -0.4`=false **nhưng** `|| closeType==='tp_sl'`=true → `slEnabled:true`, `slValue:-40`.
- **Hậu quả:** user tắt SL → export → import → thấy **SL bật −40%**; re-submit ship stoploss −40% user không hề chọn. Config drift âm thầm theo vòng export/import.
- **Fix:** đừng overload `-0.4` làm sentinel. Hoặc thêm FE-only round-trip flag `sl_enabled` (giống pattern `close_method_type` đã có), hoặc key `slEnabled` theo **top-level `stoploss`** (đã `null` khi tắt) thay vì `risk.stoploss`. Test: round-trip tp_sl + SL off giữ `slEnabled:false`.

### F3 — Hai nguồn sự thật cho stoploss lệch nhau · Important (cần BE xác nhận)

- **`serializer.ts:401-402`** top-level `stoploss = null` khi SL off **vs** **`serializer.ts:78`** `configurations.risk.stoploss = -0.4` cùng trạng thái.
- Comment nói `risk` là source-of-truth, top-level chỉ "lift cho consumer đơn giản". Consumer đọc top-level `null` (không SL) vs đọc risk `-0.4` (SL 40%) → cấu hình bot **khác nhau**.
- **Cần hỏi BE (Tuấn):** codegen `.py` đọc field nào? `-0.4` có phải floor cố ý (Freqtrade bắt buộc có stoploss)? → rồi cho 2 field nhất quán. **Không tự fix trước khi rõ BE.**

---

## 🟡 Latent / defensive — verify thật nhưng CHƯA trigger (fix rẻ, tùy chọn)

- **F4 · public-path match quá rộng** — `http.ts:92-93` `startsWith` với `/docs`,`/openapi`,`/health` (không trailing `/`) → `/healthcheck`, `/wallet/nonceXYZ`… lọt whitelist (bỏ auth). **Hiện không có endpoint nào đụng** → latent. Fix: match theo segment boundary (`path===p || startsWith(p+'/')`, `/wallet/nonce` exact). _Important nhưng chưa khai thác được._
- **F5 · CapFullStep nút no-op khi `onManageAgents` undefined** — `AgentOnboardingDialog.tsx:128`. Prop optional; nếu caller không wire → nút "Quản lý agent" không làm gì, không có Retry/Cancel → kẹt. **Cả 2 caller hiện tại (WalletChip + LaunchpadModal) đều wire** → latent foot-gun cho caller tương lai. Fix: cho prop **required** hoặc fallback về ErrorStep. _Nice._
- **F6 · silent-toast quá rộng** — `http.ts:82` `['/bot-strategy/','/bot/','/agent/']` nuốt mọi toast cho các prefix này (kể cả 5xx/403). Đúng cho dialog có error UX riêng, nhưng `agentApi.active/list/syncStatus/revoke…` gọi từ surface không render lỗi → fail âm thầm. Fix: option `{silentToast?}` per-call thay vì prefix toàn cục. _Nice/design._
- **F7 · concurrent launch** — `LaunchpadModal.tsx:70-105` sau `AgentNotActiveError` set `busy=null`, ModeCards không disable khi onboarding mở. **Thực tế overlay onboarding (z-40 inset-0) che nút parent** → khó click trùng. Fix phòng thủ rẻ: `if (busy) return` đầu `doLaunch`. _Nice._
- **F8 · raw 403/5xx body vào toast không giới hạn** — `http.ts:181,194` reflect `res.text()` thẳng vào `toast.error` (text node, không XSS) nhưng body HTML/khổng lồ từ proxy hiện nguyên. Fix: cap length + fallback generic nếu không phải JSON `{detail}`. _Nice._
- **F9 · 401 redirect cả khi đang ở `/`** — `http.ts:161-166` luôn `location.href='/'`, gây full reload nếu 401 fire lúc đã ở landing. Fix: guard `if (pathname !== '/')`. _Nice._

---

## 🔵 Đã biết / chờ BE (không phải bug mới)

- **isAgentCapFull string-match brittle** (`agent-helpers.ts`) — match "too many"+"agent" case-insensitive; BE đổi chữ là hỏng. = **N-1 BE follow-up** (xin `error_code: AGENT_CAP_FULL`). FE giữ substring làm fallback.
- **rotate-wallet sau cap-full không relaunch bot gốc / không đóng modal** (`LaunchpadModal`) — product intent chưa chốt (= N-2). Cần quyết UX rồi mới sửa.
- **read-your-write sau /agent/confirm** — relaunch live re-check `/agent/active`; nếu BE replica lag → onboarding mở lại. Comment đã ghi. Tùy BE.

---

## Test gaps đáng thêm (kèm khi fix)

- Round-trip tp_sl + **SL off** (lộ F2) · trailing off + offset≤positive (lộ F1) · top-level vs risk stoploss agreement (F3).
- `partial_levels` boundary (amount 0 / >100 / profit≤0) — schema hiện cho mọi number (BE §6.8 yêu cầu profit>0, 0<amount≤100). _Nice._
- cap-full end-to-end từ `HttpError` thật (không phải `new Error('500')`).
- public-path collision (`/healthcheck`) treated as public.

---

## Đề xuất batch fix (TDD, 1 commit/nhóm)

1. **Serializer/schema (F1+F2)** — 2 bug round-trip/validation thật, FE-only, fix gọn + test. _Làm trước._
2. **http defensive (F4+F9)** — public-path boundary + 401-on-landing guard, rẻ + tăng an toàn.
3. **F5** make `onManageAgents` required (1 dòng type).
4. **F3 + isAgentCapFull + N-2**: gộp vào message hỏi BE (Tuấn), fix sau khi rõ.
5. F6/F7/F8 — nice-to-have, để cuối hoặc bỏ qua (YAGNI tùy anh).
