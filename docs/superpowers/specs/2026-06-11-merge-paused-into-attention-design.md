# Spec: Gộp filter "Paused" vào "Needs attention"

**Date:** 2026-06-11
**Author:** Tri (FE) + Claude
**Status:** Approved (design), chờ implement

---

## 1. Mục tiêu

Bỏ chip filter **Paused** đứng riêng trên dashboard. Bot ở trạng thái `PAUSED`
được gộp vào nhóm **Needs attention** — tức là được **đếm** và **lọc** chung với
các trạng thái cần xử lý khác. Vị trí **sort** của bot PAUSED **giữ nguyên** (vẫn
nằm bucket cuối).

## 2. Lý do

Một bot đang `PAUSED` là vốn nhàn rỗi mà user nên thao tác (resume) — cùng framing
"cần làm gì đó với bot này" mà phần home portfolio đã dùng sẵn ("Resume one to put
capital to work"). Vì vậy PAUSED thuộc về nhóm action-needed cùng với
`ERROR`, `BACKTEST_FAILED`, `NEW`.

Hàng chip rút gọn từ 5 → 4: **All · Needs attention · Live · Dry-run**.

## 3. Hiện trạng (trước khi sửa)

`src/features/bot-monitoring/bot-filter.ts`:

```ts
export type FilterCategory =
  | 'all'
  | 'live'
  | 'dry-run'
  | 'paused'
  | 'attention';

const CATEGORY_STATES = {
  live: ['LIVE'],
  'dry-run': ['DRY-RUN'],
  paused: ['PAUSED'],
  attention: ['ERROR', 'BACKTEST_FAILED', 'NEW'],
};

export const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'live', label: 'Live' },
  { key: 'dry-run', label: 'Dry-run' },
  { key: 'paused', label: 'Paused' },
];
```

## 4. Thay đổi — chỉ 1 file: `bot-filter.ts`

1. **Bỏ `'paused'` khỏi union `FilterCategory`** (line 8). Xoá member này để compiler
   tự flag mọi chỗ còn tham chiếu — sạch và an toàn.
2. **Gộp PAUSED vào attention** (lines 16-20): `attention: ['ERROR', 'BACKTEST_FAILED', 'NEW', 'PAUSED']`,
   xoá entry `paused: ['PAUSED']`.
3. **Bỏ `paused: 0`** trong initializer của `countByCategory` (line 48).
4. **Bỏ chip `Paused`** khỏi `FILTER_CHIPS` (line 68).

Kết quả mong muốn:

```ts
export type FilterCategory = 'all' | 'live' | 'dry-run' | 'attention';

const CATEGORY_STATES = {
  live: ['LIVE'],
  'dry-run': ['DRY-RUN'],
  attention: ['ERROR', 'BACKTEST_FAILED', 'NEW', 'PAUSED'],
};

export const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'live', label: 'Live' },
  { key: 'dry-run', label: 'Dry-run' },
];
```

## 5. KHÔNG đụng tới (cố ý)

- **`bot-sort.ts`** — PAUSED giữ bucket 4 (sort xuống cuối, theo lựa chọn của Tri).
  `ERROR`/`BACKTEST_FAILED` vẫn dẫn đầu. Khi xem chip "Needs attention", bot lỗi
  thật vẫn nổi lên trên, PAUSED nằm dưới cùng nhóm.
- **Status badge** — bot PAUSED vẫn hiển thị badge "Paused" riêng trên card. Chỉ
  thay đổi cách **filter/đếm**, không đổi badge.
- **`DashboardPage.tsx`** — logic `counts[filter] === 0 → setFilter('all')` và default
  filter `'all'` vẫn chạy đúng, không cần sửa (compiler xác nhận sau khi xoá `'paused'`).
- **`BotCard.tsx:54`** (`BACKTEST_FAILED: '— paused'`) và label badge — không liên quan,
  giữ nguyên.

## 6. Tests cần cập nhật

Cách làm theo TDD: sửa expectation của test trước (đỏ), rồi sửa 4 chỗ ở `bot-filter.ts` (xanh).

### `__tests__/bot-filter.test.ts`

- `matchesCategory('PAUSED', 'attention')` → `true` (thêm assert).
- Xoá dòng `expect(matchesCategory(s, 'paused')).toBe(false)` trong test transient states.
- `filterByCategory(cards, 'attention').map(c => c.id)` → `[3, 6, 7, 8]` (thêm id 3 = PAUSED).
- `countByCategory(cards)` → bỏ key `paused`, `attention: 4` (thay vì 3).

### `__tests__/StatusFilterChips.test.tsx`

- Bỏ `paused: 1` khỏi fixture `counts`.
- (Tuỳ chọn) thêm assert chip "Paused" không còn render.

## 7. Definition of Done

- [ ] `bot-filter.ts` sửa xong 4 điểm, chip row còn 4 chip.
- [ ] Bot PAUSED đếm vào "Needs attention", click chip đó hiện cả bot PAUSED.
- [ ] Bot PAUSED vẫn sort xuống cuối (dưới ERROR/BACKTEST_FAILED/NEW).
- [ ] `pnpm typecheck` ✓ (không còn tham chiếu `'paused'` mồ côi).
- [ ] `pnpm test` ✓ (bot-filter + StatusFilterChips tests xanh).
- [ ] `pnpm lint` ✓, `pnpm format` ✓.
