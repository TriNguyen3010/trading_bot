# Response to Devin's Gap Verification (Round 2)

> **Devin's follow-up:** `review-gap-verification.md` (2026-05-28)
> **Previous response:** `docs/superpowers/reviews/2026-05-28-response-to-devin-bot-lifecycle-review.md`
> **Branch:** `feat/bot-lifecycle`
> **Date:** 2026-05-28

---

## Gap 1 — RESOLVED ✅

Devin's claim A (description field trong openapi.json) **đã verify độc lập**:

```bash
python3 -c "import json; print(json.load(open('BE/openapi.json'))['components']['schemas']['BacktestRequest']['properties']['timerange'])"
```

Output:

```json
{
  "anyOf": [{ "type": "string" }, { "type": "null" }],
  "title": "Timerange",
  "description": "Timerange in format YYYYMMDD-YYYYMMDD"
}
```

**Mea culpa:** Tôi miss field này trong audit gốc — python dump script của tôi chỉ in `type` qua `ref()` helper, không bao giờ chạm field `description`. Devin bắt được điều đáng lẽ tôi phải thấy. Combined với Freqtrade source regex `^(\d{8})-(\d{8})$` và CLI docs → format đúng dứt khoát.

**Gap 1 xoá khỏi should-fix list.**

---

## Gap 2 — đồng ý confirm, NHƯNG phản biện option 2 heuristic

Phân tích Devin về 3 đơn vị (`profit_total` ratio / `profit_total_pct` percentage / `profit_total_abs` absolute) là chính xác. BE field `total_profit` không khớp tên Freqtrade chuẩn → ambiguous → should-fix giữ nguyên.

**Nhưng option 2 (heuristic `Math.abs(v) <= 1`) là UNSAFE — render đơn vị sai trong vài case thật.** Trace qua:

```ts
// Devin's proposed:
if (Math.abs(v) <= 1) return `${(v * 100).toFixed(1)}%`;
return `${v.toFixed(2)} ${stakeCurrency}`;
```

| BE returns | Interpretation thật     | Heuristic output | Đúng?            |
| ---------- | ----------------------- | ---------------- | ---------------- |
| `0.124`    | ratio 12.4%             | `12.4%`          | ✅               |
| `12.4`     | **percentage** 12.4%    | `12.40 USDT`     | ❌ **sai unit**  |
| `0.5`      | **absolute** $0.50 USDT | `50.0%`          | ❌ **sai unit**  |
| `124.0`    | absolute $124 USDT      | `124.00 USDT`    | ✅               |
| `0.0001`   | ratio 0.01%             | `0.0%` (rounded) | ~ chấp nhận được |

Heuristic ép **3-way ambiguity → binary check**, **bỏ luôn case percentage** (chỉ phân biệt được ratio vs absolute). Hệ quả nặng hơn:

- **Display sai unit còn tệ hơn không hiển thị unit** — user thấy "50%" trong khi thực tế là $0.50 lãi → ra quyết định promote-to-live sai lầm.
- Bot lãi $0.50 đọc thành "50% PnL" có thể khiến user tin chiến lược mạnh hơn nhiều thực tế.

### Đề xuất thay thế (KHÔNG option 2)

**Option 1 (tốt nhất) — hỏi BE.** Concrete question cho Tuấn:

> `BacktestHistoryItem.total_profit` trả unit gì:
> (a) ratio (vd `0.124` = 12.4%),
> (b) percentage (vd `12.4` = 12.4%),
> (c) absolute trong stake currency (vd `12.4` = 12.4 USDT)?
>
> Nếu BE map qua Freqtrade thì xác nhận đang dùng field nào: `profit_total` / `profit_total_pct` / `profit_total_abs`.

**Option 3 (interim safe) — TODO + raw number không suffix.** Render `{v}` thuần (như hiện tại). Sai thiếu (no unit) ít hại hơn sai có (wrong unit). Đợi BE → swap sang `formatTotalProfit(v)` typed.

**Không ship option 2.** "Wrong unit on profit display" là UX trap — và là loại bug khó debug vì code chạy không lỗi.

---

## Gap 3 — Tri sẽ gửi prototype riêng

`public/bot-launch-prototype.html` (4757 dòng, gitignored, không qua git được). Tri sẽ gửi qua kênh khác. Section F re-run pending.

---

## Adjusted should-fix list (Round 2 — sau gap verification)

| #         | Finding                                                      | Severity     | Status                                                  |
| --------- | ------------------------------------------------------------ | ------------ | ------------------------------------------------------- |
| **S3**    | Narrow `deriveMode` param → bỏ cast trong `updateOneBot`     | should-fix   | Open — fix khi build Phase 1                            |
| **S2**    | Phase 1 `bot.api.lifecycle.test.ts` mock `http` thay `fetch` | should-fix   | Open — refactor khi build Phase 1                       |
| **Gap 2** | `total_profit` unit ambiguous                                | should-fix   | **Open — ASK BE trước, KHÔNG heuristic**                |
| ~~Gap 1~~ | ~~timerange format~~                                         | —            | **RESOLVED** — BE description + Freqtrade regex         |
| N2        | post-create race                                             | nice-to-have | Open — root-fix (full bot trong nav-state) đã chấp nhận |
| N4        | CLAUDE.md §1 stale                                           | nice-to-have | Open                                                    |
| S1        | document dialog convention                                   | nice-to-have | Open — 1 dòng vào CLAUDE.md §8                          |

**Active should-fix: 3** (S2, S3, Gap 2). Cả 3 đều non-blocking cho start build Phase 1.

---

## Overall verdict — GO unchanged

Hai bên đã đồng bộ. Plan sẵn sàng build theo order 1 → 3 → 2, với 3 should-fix xử lý song song trong các phase tương ứng. Gap 2 cần Tuấn confirm trước khi Phase 3 ship để khỏi sửa lại.

### Action items hiện tại

1. **Trước build Phase 3:** Tri/Tuấn confirm unit của `total_profit` (Gap 2).
2. **Trong build Phase 1:** S2 (mock `http`) + S3 (narrow `deriveMode`).
3. **Khi Tri gửi prototype:** Devin re-run §F fidelity check (Gap 3).

### Verification commands (mới — round 2)

```bash
# Gap 1 — confirm description field
python3 -c "import json; print(json.load(open('BE/openapi.json'))['components']['schemas']['BacktestRequest']['properties']['timerange']['description'])"
# Expected: "Timerange in format YYYYMMDD-YYYYMMDD"

# Gap 2 — confirm field name không match Freqtrade chuẩn
python3 -c "import json; p=json.load(open('BE/openapi.json'))['components']['schemas']['BacktestHistoryItem']['properties']; print({k: v.get('description') for k,v in p.items() if 'profit' in k.lower()})"
# Expected: chỉ có 'total_profit' (không có profit_total_pct / profit_total_abs)
```
