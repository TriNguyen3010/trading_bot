# Connection Lines & Nodes — Logic Spec

Spec để port hệ thống animated connection lines (marching ants + state-aware fade) sang bất kỳ framework nào (React/Vue/Svelte/vanilla). Phần data model + animation + visual rules là framework-agnostic; phần render là SVG thuần.

---

## 1. Data model

Toàn bộ layout được mô tả bằng **2 object/array**. Render logic không hardcode tọa độ hay element nào.

### `NODES` — map of nodes

```ts
type Node = {
  x: number;          // pixel coord (trong viewBox)
  y: number;
  kind: 'endpoint' | 'junction' | 'placeholder';
  color: 'yellow' | 'green' | 'gray';
}

const NODES: Record<string, Node>
```

Ý nghĩa `kind`:
- `endpoint` — chấm tròn nhỏ ở 2 đầu line (r=5)
- `junction` — chấm tròn lớn hơn ở điểm phân nhánh (r=6)
- `placeholder` — chấm xám nhỏ, dim (r=3.5), đặt ở slot chưa active

### `CONNECTIONS` — array of edges

```ts
type Connection = {
  from: string;            // NODES key
  to: string;              // NODES key
  via?: [number, number][]; // optional waypoints cho path có gập
  fade?: boolean;          // true → gradient fade opacity về cuối
  style?: 'placeholder';   // render xám tĩnh, không animate
}

const CONNECTIONS: Connection[]
```

Quy ước routing:
- Không có `via` → line thẳng từ `from` → `to`
- Có `via` → path đi qua từng waypoint theo thứ tự, dùng `M` + `L` (orthogonal routing đề xuất khi vẽ tay: chỉ ngang/dọc, gập 90°)

---

## 2. Visual specs

| Element | Stroke | Color | Dash | Other |
|---|---|---|---|---|
| Line active | 2px | `#FFD24A` (yellow) / `#3DD9B5` (green) | `8 4` | `vector-effect: non-scaling-stroke` |
| Line active highlighted | 2.4px | `#FFE066` / `#5FE8C7` | `8 4` | + drop-shadow glow |
| Line placeholder | 1.5px | `rgba(255,255,255,0.22)` | `4 4` | tĩnh, không animate |
| Endpoint dot | — | `#FFD24A` / `#3DD9B5` | — | r=5 |
| Junction dot | — | `#FFD24A` | — | r=6 |
| Placeholder dot | — | `rgba(255,255,255,0.25)` | — | r=3.5 |
| Highlighted dot | — | `#FFE066` / `#5FE8C7` | — | r=5.5 (endpoint) / 6.5 (junction) + glow |

**Quan trọng:**
- Dùng `vector-effect="non-scaling-stroke"` trên path để dash size không thay đổi khi SVG scale → khi line dài hơn, tự có thêm dash, không phải kéo dãn dash hiện có.
- Container chứa SVG nên có **fixed size** (không percentage) để `<circle>` không bị stretch méo thành ellipse.

---

## 3. Animation logic — marching ants

```css
@keyframes march {
  to { stroke-dashoffset: -12; }   /* = -(dash + gap) = -(8 + 4) */
}

.line-active {
  stroke-dasharray: 8 4;
  animation: march 1.4s linear infinite;
}

.line-active.highlighted {
  animation-duration: 0.7s;   /* chạy nhanh gấp 2 khi hover */
}
```

Nguyên lý: `stroke-dashoffset` animate từ `0` → `-(dash+gap)` tạo cảm giác dashes "chảy" dọc theo path. Linear easing để chạy đều, không giật.

**Tốc độ:**
- Active: `1.4s` per cycle — đủ nhanh để thấy chuyển động, đủ chậm để không phân tâm
- Highlighted: `0.7s` — khi user focus vào, ants chạy nhanh hơn = phản hồi visual

---

## 4. State system

### 4.1 Line states

| State | Trigger | Render |
|---|---|---|
| **Active** | Mặc định cho line giữa 2 active node | Solid bright, marching ants |
| **Active fade** | `fade: true` (line đi vào inactive slot) | Gradient opacity 1.0 → 0.45 dọc theo path, marching ants |
| **Highlighted** | User hover card có liên quan | + brighter color, + drop-shadow glow, + ants nhanh gấp 2 |
| **Placeholder** | `style: 'placeholder'` | Stroke xám tĩnh, không animate |

### 4.2 Fade gradient

Khi `fade: true`, sinh `<linearGradient>` cho path đó:

```svg
<linearGradient id="g-{from}-{to}" gradientUnits="userSpaceOnUse"
                x1="{from.x}" y1="{from.y}" x2="{to.x}" y2="{to.y}">
  <stop offset="0%"   stop-color="currentColor" stop-opacity="1"/>
  <stop offset="100%" stop-color="currentColor" stop-opacity="0.45"/>
</linearGradient>
```

Path dùng `stroke="url(#g-{from}-{to})"` thay vì màu solid.

**Tại sao end opacity = 0.45 (không phải 0.2)?**
Marching ants vẫn phải nhìn thấy được ở cuối line — user cần cảm giác "ant chạy đến đích". Nếu fade quá đậm (0.2), ants gần như tàng hình ở cuối → mất cảm giác chuyển động.

**Tại sao `currentColor`?**
Stops dùng `currentColor` → gradient inherit từ CSS `color` của path. Khi state đổi (active → highlighted), chỉ cần CSS đổi `color`, gradient tự áp dụng màu mới mà giữ nguyên fade ratio. Không cần regenerate gradient.

### 4.3 Logic quyết định fade

Quy tắc nghiệp vụ: **fade chỉ áp dụng cho line đi vào node ở "inactive slot"** (ví dụ "Add strategy" — slot trống chưa được fill content). Line giữa 2 active node thì solid bright xuyên suốt.

Trong code, encode bằng `fade: true` trên connection. Có thể compute tự động nếu thêm field `state` cho node:
```ts
conn.fade = NODES[conn.to].state === 'inactive'
```

---

## 5. Hover / highlight logic

### 5.1 Mục tiêu
Khi user hover một card, mọi line + dot **liên quan đến card đó** sẽ vào state highlighted.

"Liên quan" nghĩa là: line đi tới hoặc đi từ node tương ứng card, VÀ các dot ở 2 đầu line đó (kể cả junction dot ở giữa).

### 5.2 Implementation — `data-node-ids`

Mỗi SVG element gắn attribute `data-node-ids` chứa danh sách node IDs liên quan, cách nhau bằng space:

- **Path**: `data-node-ids="{from} {to}"`
- **Dot của node X**: `data-node-ids="X {neighbor1} {neighbor2} ..."` — gồm chính nó + tất cả neighbor (node nằm cùng connection với X)

Hover card có `data-card="X"`:
```js
querySelectorAll(`[data-node-ids~="X"]`)
  .forEach(el => el.classList.toggle('highlighted', on))
```

CSS attribute selector `~=` match khi value xuất hiện như một "word" trong space-separated list.

### 5.3 Tại sao thêm neighbors vào dot?

Junction dot nằm giữa nhiều line. Khi hover "strategy" (đi qua junction), junction dot cũng cần highlight. Nếu junction dot chỉ có `data-node-ids="junction"`, query `[data-node-ids~="strategy"]` sẽ miss nó.

Giải pháp: junction dot có `data-node-ids="junction source strategy addSlot"` (chính nó + 3 neighbors). Khi hover bất kỳ neighbor nào, junction match.

Áp dụng tương tự cho mọi dot — đơn giản và đối xứng.

### 5.4 Compute neighbors

```ts
function neighborIds(nodeId: string): string {
  const set = new Set<string>([nodeId]);
  for (const c of CONNECTIONS) {
    if (c.from === nodeId) set.add(c.to);
    if (c.to   === nodeId) set.add(c.from);
  }
  return Array.from(set).join(' ');
}
```

---

## 6. Render pipeline

Pseudocode framework-agnostic:

```
function render(svg, NODES, CONNECTIONS):
    defs = svg.defs

    // 1. Lines (paths) — vẽ trước để dots nằm trên
    for each conn in CONNECTIONS:
        path = create <path>
        path.d = "M from.x from.y" + via.map("L x y") + "L to.x to.y"
        path.vector-effect = "non-scaling-stroke"
        path.data-node-ids = "{from} {to}"

        if conn.style == 'placeholder':
            path.class = "line line-placeholder"
            path.stroke = "currentColor"
        else:
            path.class = "line line-active" + (green if any endpoint is green)
            if conn.fade:
                ensureGradient(defs, "g-{from}-{to}", from, to)
                path.stroke = "url(#g-{from}-{to})"
            else:
                path.stroke = "currentColor"

        svg.append(path)

    // 2. Dots
    for each (id, node) in NODES:
        circle = create <circle>
        circle.cx = node.x
        circle.cy = node.y
        circle.data-node-ids = neighborIds(id)
        circle.class = base on node.kind + node.color
        svg.append(circle)
```

```
function ensureGradient(defs, id, from, to):
    if defs already has <linearGradient id={id}>: return
    grad = create <linearGradient
                  id={id}
                  gradientUnits="userSpaceOnUse"
                  x1=from.x y1=from.y x2=to.x y2=to.y>
        <stop offset="0%"   stop-color="currentColor" stop-opacity="1.0"/>
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.45"/>
    defs.append(grad)
```

---

## 7. Porting tips

### React
- `NODES` và `CONNECTIONS` thành props/state
- Dùng `.map()` render `<path>` và `<circle>` trực tiếp trong JSX
- `<defs>` sinh từ `CONNECTIONS.filter(c => c.fade)`
- `useMemo` cho `neighborIds` để cache khi data không đổi
- Hover state: 1 state `hoveredId: string | null`, mỗi element tính `isHighlighted = data-node-ids includes hoveredId`

### Vue
- Tương tự React, dùng `v-for` + computed properties
- `v-bind:class` cho `.highlighted` dựa trên `hoveredId`

### Vanilla JS
- File HTML hiện tại là reference — copy nguyên `build()`, `buildPath()`, `buildDot()`, `setupHover()`

### Canvas (nếu cần performance cao với hàng trăm nodes)
- Dashes: vẽ thủ công với `ctx.setLineDash([8, 4])` + `ctx.lineDashOffset`
- Marching ants: tăng `lineDashOffset` mỗi frame trong RAF loop
- Gradient fade: `ctx.createLinearGradient(from.x, from.y, to.x, to.y)` với 2 color stops
- Hover detection: hit-test với khoảng cách điểm-tới-segment < threshold

---

## 8. Edge cases & lưu ý

1. **Container phải fixed pixel size** — nếu container scale theo viewport, SVG circles có thể bị stretch thành ellipse. Hoặc dùng `aspect-ratio: <viewBox-w>/<viewBox-h>` trên container.

2. **Path có gập (waypoints)**: gradient fade là **linear trong không gian 2D** từ `from` → `to`, không follow path. Với path gập nhiều, fade nhìn vẫn smooth nhưng từng segment có thể fade hơi khác. Nếu cần fade chính xác theo độ dài path → phải tách thành nhiều `<path>` con và chain gradient.

3. **`stroke-dashoffset` direction**: animate về giá trị **âm** để dashes chạy theo chiều `from → to`. Nếu animate về dương, ants chạy ngược lại.

4. **`prefers-reduced-motion`**: nên có CSS để tắt animation cho user nhạy cảm:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .line-active { animation: none; }
   }
   ```

5. **Performance**: với <100 connections, SVG + CSS animation hoàn toàn ổn (GPU-accelerated). Trên 200+ thì cân nhắc Canvas.

6. **Z-order**: vẽ paths trước, dots sau — dots phải nằm trên lines để cover phần line đi qua điểm node.

---

## 9. Tham số (chỉnh nhanh)

```css
/* tốc độ ants */
--ants-duration:           1.4s;
--ants-duration-highlight: 0.7s;

/* dash pattern */
--dash:    8;
--gap:     4;
--total:  12;   /* dash + gap, dùng cho stroke-dashoffset */

/* fade */
--fade-end-opacity: 0.45;

/* colors */
--yellow:        #FFD24A;
--yellow-bright: #FFE066;
--green:         #3DD9B5;
--green-bright:  #5FE8C7;
--placeholder:   rgba(255,255,255,0.22);

/* sizes */
--stroke-active:      2px;
--stroke-highlight:   2.4px;
--stroke-placeholder: 1.5px;
--dot-endpoint:    5px;
--dot-junction:    6px;
--dot-placeholder: 3.5px;
```

---

## 10. Reference implementation

File: `connection-lines.html` (v7) — vanilla HTML/CSS/JS, ~270 dòng, không dependencies.

Cấu trúc:
- HTML: `<div class="stage">` chứa cards (HTML) + `<svg>` rỗng có `<defs>`
- CSS: rule cho `.line-*`, `.dot-*`, keyframes `march`
- JS: `NODES`, `CONNECTIONS` data + `build()` + `setupHover()`
