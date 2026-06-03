# Review request — Phase 2b (Live launch + Hyperliquid agent wallet) — PR #19

**Repo:** https://github.com/TriNguyen3010/trading_bot
**PR:** https://github.com/TriNguyen3010/trading_bot/pull/19
**Branch:** `claude/inspiring-franklin-a85f4e` (11 commits, `f250722` → `a5935fe`)
**Base branch:** `main` — Phase 2a (PR #14/#17) + Phase 1 (PR #12) + Phase 3 (PR #13) đã merge vào `main`, nên diff CHỈ hiện 11 commit Phase 2b.
**Plan:** [`docs/superpowers/plans/2026-05-28-phase-2b-launchpad-live-agent.md`](../plans/2026-05-28-phase-2b-launchpad-live-agent.md)
**Auth reference:** [`BE/auth-architecture.md`](../../../BE/auth-architecture.md) §"Layer 2: Agent Wallet"
**Roadmap context:** build order 1 → 3 → 2a → **2b** → 4 → 5. Phase 2b unblock Live launch đã defer ở Phase 2a.

## What this PR ships

Feature mới `src/features/agent-wallet/` + wire vào Live path của Launchpad. Hyperliquid yêu cầu **agent wallet** (sub-key user EIP-712 `approveAgent`) trước khi bot tự đặt lệnh tiền thật.

**Flow:** Go Live → `launchBot(id, 'live')` check `agentApi.active()` → null → throw `AgentNotActiveError` → `LaunchpadModal` mở `AgentOnboardingDialog` (3-step: `/agent/create` → ví ký EIP-712 `eth_signTypedData_v4` → `/agent/confirm`) → success → resume launch: PATCH `dry_run=false` → `disableTelegram` → `botApi.start(id)`.

- `agent.api.ts` — `agentApi`: create / confirm / active / list / checkLimit (qua `@/lib/http`).
- `agent-helpers.ts` — `extractNonceFromSignPayload` (parse defensive `message.nonce`), `formatSpendingLimit`, `eip712Sign` (wrap `eth_signTypedData_v4`, map 4001 → `UserRejectedError`, no-provider → `NoProviderError`).
- `useAgentSignFlow.ts` — hook state machine (idle/creating/signing/confirming/success/error) orchestrate create → sign → confirm.
- `AgentOnboardingDialog.tsx` — modal 3-step (raw `DialogPrimitive`), driven bởi hook state.
- `launch-actions.ts` — `live` path check agent trước mọi mutation + `AgentNotActiveError`. **`disableTelegram(botId)` giữ nguyên** trước `start`.
- `LaunchpadModal.tsx` — enable Live card ("Go Live"), catch `AgentNotActiveError` → mở onboarding, `onSuccess` → resume `doLaunch('live')`.
- `api-helpers.ts` — re-export 7 agent type. `http.ts` — thêm `/agent/` vào `SILENT_TOAST_PREFIXES`.

## Quality gates (already passed)

- `pnpm typecheck` ✅
- `pnpm lint` ✅ 0 errors (5 pre-existing warnings, baseline unchanged)
- `pnpm test` ✅ **485/485** (62 files; +~38 test mới across 6 tasks)
- TDD từng task; mỗi task qua 2-tầng review (spec compliance + code quality) + 1 review tổng cross-cutting.

## Authorised decisions — DO NOT re-litigate (flag chỉ khi tìm ra bug thật)

1. **`disableTelegram` giữ trong `launchBot`** — plan Task 6 code sample BỎ dòng này; cố ý KHÔNG theo plan vì nó chống Freqtrade Updater crash trên null Telegram token (có test riêng `launch-actions.test.ts`). Giữ nguyên cho cả 2 mode.
2. **`/agent/check-limit` defer** — `agentApi.checkLimit` viết + unit-test sẵn nhưng CHƯA wire vào launch flow (plan §1.4 đánh dấu optional pre-flight). Defer Phase 2b.1.
3. **`suggestedLimit` của dialog chưa truyền từ LaunchpadModal** — `LaunchpadBot` không mang stake amount nên không có nguồn dữ liệu; prop optional, dialog chạy đúng. Wire sau khi có stake config.
4. **Nested dialog → render sibling** — `AgentOnboardingDialog` render dạng fragment sibling của Launchpad `DialogPrimitive.Root` (không lồng trong) để tránh Radix focus-trap/escape contention.
5. **4001 inline check trong `eip712Sign`** duplicate private `isUserReject` của `wallet.provider.ts` — cố ý inline (tránh đụng code Phase 0 auth), có comment "keep in sync".
6. **Inline Vietnamese strings** (không qua `i18n/en.ts`) — nhất quán với convention hiện tại của `wallet-auth`/`bot-monitoring`.

## Focus areas — please verify explicitly

1. **`launchBot` live ordering** (`launch-actions.ts`). Verify `agentApi.active()` chạy TRƯỚC mọi mutation; agent null → throw `AgentNotActiveError` mà KHÔNG gọi `update`/`disableTelegram`/`start`. dry-run KHÔNG được gọi `active()`. Có timing/Promise interleaving nào để `start` fire trước khi `update`/`disableTelegram` resolve không?
2. **Resume-after-onboarding loop** (`LaunchpadModal.tsx` `handleOnboardingSuccess`). `onSuccess` → `setOnboardingOpen(false)` → `void doLaunch('live')`. Có nguy cơ double-launch / re-entrancy không? `onSuccess` fire từ `useEffect [state, onSuccess]` của dialog với closure không memoized — trace xem có fire >1 lần cho 1 success không.
3. **Read-your-write trên `/agent/active`** — resume gọi lại `active()` ngay sau `confirm()`. Nếu BE serve `active` từ replica trễ → `active()` trả null → onboarding mở lại (loop). Hiện chỉ có comment, chưa guard. BE có đảm bảo read-your-write sau `confirm` không? Cần retry/guard FE không?
4. **Nonce seam** (`useAgentSignFlow.ts` → `agent.confirm`). `extractNonceFromSignPayload(prep.sign_payload)` đào `message.nonce` từ object opaque (`additionalProperties:true` từ BE). Verify nonce gửi vào `AgentConfirmRequest` khớp `sign_payload.message.nonce`. Fallback `0` khi malformed — fail-fast (throw) hay giữ defensive? `0` nonce sẽ bị reject on-chain thay vì fail rõ ở FE.
5. **EIP-712 sign** (`eip712Sign`). Verify `params: [walletAddress, JSON.stringify(typedData)]` đúng thứ tự cho `eth_signTypedData_v4` (Coin98/EIP-1193). Map 4001 → `UserRejectedError`, non-4001 → rethrow nguyên error. Có case wallet trả error shape khác 4001 mà thực ra là user-reject không?
6. **Error UX double-surface** (`http.ts` `SILENT_TOAST_PREFIXES`). Đã thêm `/agent/` để modal/dialog tự own error (tránh toast + box). Verify không path `/agent/*` nào còn cần global toast (vd lỗi không gắn với UI nào đang mở).
7. **State leak khi đóng giữa chừng** — đóng `AgentOnboardingDialog` lúc đang `signing`/`confirming` (ví đang chờ ký). Hook `setState` sau await không có unmount guard. Có crash/warning/leak thật trên flow dialog này không?

## Out of scope — don't flag

- Agent rotation (`/bot/rotate-wallet`) / revoke UI — Phase 2b.1 / admin.
- `/agent/check-limit` wiring vào launch — defer (xem decision #2).
- Rich monitoring `BotMonitoringPage` (Phase 4), tier/paywall (Phase 5).
- Phase 1/2a/3 code đã merge + review (PR #12/#13/#14).

## Known follow-ups (non-blocking, đã document)

Flag chỉ khi tìm ra issue MỚI:

- `suggestedLimit` chưa wire (decision #3) — cần nguồn stake amount.
- Read-your-write guard trên resume (focus #3) — chờ xác nhận BE contract.
- Nonce `0` fallback fail-fast (focus #4) — quyết định sau khi rõ shape `sign_payload` thật từ BE.

## Output format

Verdict at top: **GO** / **NO-GO** + 1-line rationale.

Per finding:

- **Severity:** Critical / Important / Should-fix / Nice-to-have / Note
- **Location:** `file.ts:line-line`
- **Issue:** what's wrong
- **Suggested fix:** concrete patch or direction

Flag any regression against Phase 1 (PR #12), Phase 2a (PR #14), or Phase 3 (PR #13) explicitly — đặc biệt `launchBot` PATCH/`disableTelegram`/start ordering.
