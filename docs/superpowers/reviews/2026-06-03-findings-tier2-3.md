# Tier 2 + Tier 3 Findings + Fixes

> Review 6 vùng còn lại bằng subagent song song + Claude tự verify từng finding với code thật, fix theo TDD. Baseline 561 → **589 test xanh**.
> **0 Blocker** ở mọi vùng (B1/B2 ban đầu gắn nhãn Blocker → thực chất là display-bug + template-bug, đã fix). Ngày: 2026-06-03.

---

## TIER 2 (đã fix — 4 commit)

| ID      | Vùng           | Bug                                                                                          | Fix                                                                                      |
| ------- | -------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **W-1** | wallet-auth    | F9 (Tier1) khiến 401 trên `/` không reload → store Zustand giữ creds cũ → UI "connected" giả | http.ts phát `WALLET_AUTH_CLEARED_EVENT`, store reset qua event (tránh import cycle)     |
| **I-1** | bot-monitoring | poll status đang bay có thể ghi đè optimistic update (Stop→hiện lại Running 1 nhịp)          | generation guard: `setStatus` bump gen, poll discard nếu gen đổi                         |
| **I-2** | bot-monitoring | bot.api lifecycle (start/stop/sync/remove…) 0 test khẳng định endpoint                       | table-driven test khoá method+path (DELETE /bot/{id}…)                                   |
| **E-1** | export-import  | submitError/error/textInput còn lại khi đóng→mở lại dialog                                   | reset khi `open` flip true                                                               |
| **E-2** | export-import  | ExportDialog gọi `setParseError` **trong useMemo** (render-phase setState)                   | derive thuần, bỏ useState                                                                |
| **E-3** | export-import  | file sửa tay decode ra short+spot (lọt schema rule3 vs T-2) → state vô lý                    | ImportDialog refuse short+!futures; + re-attach `sl_enabled` (hoàn thiện F2 path import) |

## TIER 3 (đã fix — 3 commit)

| ID     | Vùng        | Bug                                                                                                                    | Fix                                                                               |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **B1** | bot-summary | `translateRoi` nhân `roi*100` → step UI 1.5% hiện "150% target" trên thẻ xác nhận deploy                               | bỏ `*100`, roi đã là %                                                            |
| **B2** | template    | `grid-stable` lưu roi dạng ratio (0.005) → serializer ship 0.005% → bot exit mọi tick                                  | đổi sang % (0.5/0.3/0.1) — cùng B1 nên summary "0.50%" không đổi, config đúng lại |
| —      | backtest    | `formatWinRate` heuristic `<=1` → win-rate 1% thật (1.0) hiện "100%"                                                   | bỏ heuristic (chỉ field 0-100 được truyền)                                        |
| —      | backtest    | `extractTrades` cast không validate từng row → `t.profit_abs.toFixed()` crash nếu field thiếu                          | normalize mỗi row (coerce number)                                                 |
| —      | builder     | deserialize default `marketType:'spot'`; lock futures chỉ ở component mount lười → import lọt spot+leverage>1 fail T-3 | default `'futures'` (Hyperliquid perp-only)                                       |

---

## DEFERRED — cần BE (xem message gửi Tuấn) hoặc product intent

- **F3** — `stoploss` top-level (null khi SL off) ≠ `configurations.risk.stoploss` (-0.4). Cần BE xác nhận codegen đọc field nào + `-0.4` có phải floor cố ý → rồi mới chỉnh nhất quán.
- **I-2 (summary)** — bot ROI/manual/indicator luôn ship `stoploss:-0.4` nhưng summary không nhắc → nếu -0.4 là intended (F3) thì nên surface dòng "hard stop -40%" trong summary.
- **isAgentCapFull / AGENT_CAP_FULL (N-1)** — xin error_code ổn định.
- **N-2** — rotate sau cap-full: relaunch bot gốc hay không (product intent).
- **W-2** — signer ≠ requested address giữa chừng → confirm BE 403 recover-compare.
- **W-3** — nonce Redis lookup có case-insensitive không (FE lowercase mọi nơi).

## NOTED — không fix (lý do)

- **I-1 (legacy `deserializeBundle` slEnabled tp_sl bug)** — dead code, không dùng ngoài test (chỉ `deserializeUnifiedPayload` được dùng). Để nguyên.
- Nice các loại: `-0.00` hiển thị, poll retry-budget, close-while-running orphan job, `formatTradeDuration` dead+unrendered, summary multi-group flatten/lookback/MA-source, migrate dedup. → backlog, YAGNI/cosmetic.
