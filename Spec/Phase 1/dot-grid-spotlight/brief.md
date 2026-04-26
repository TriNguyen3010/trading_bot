# Brief — Dot Grid Spotlight Effect

## 1. Mục đích

Tạo hiệu ứng nền tương tác cho hero section / landing page: một lưới chấm tĩnh trên nền tối, các chấm trong vùng quanh con trỏ chuột sẽ phát sáng màu vàng khi người dùng di chuyển chuột, và **tự tắt dần khi chuột đứng yên hoặc rời khỏi vùng**.

Mục tiêu trải nghiệm: tạo cảm giác "trang đang sống và phản hồi", nhưng không gây phân tâm — hiệu ứng phải biến mất khi user không tương tác.

## 2. Visual specs

| Thuộc tính | Giá trị | Ghi chú |
|---|---|---|
| Màu nền | `#0a0a0f` | Có thể tùy biến theo theme |
| Màu dot (idle) | `rgba(255, 210, 80, 0.14)` | Vàng ấm, mờ |
| Màu dot (sáng tối đa) | `rgba(255, 210, 80, 0.95)` | Tâm vùng spotlight |
| Kích thước dot | `1.2px` | Hình tròn |
| Khoảng cách dot | `22px` | Đều cả 2 chiều |
| Bán kính spotlight | `240px` | Vùng dot bị ảnh hưởng quanh cursor |
| Falloff | Quadratic (`t²`) | Dot càng xa cursor càng mờ |

## 3. Quy luật hành vi (behavior rules)

### Trigger states

| Trạng thái | Điều kiện | Hành vi |
|---|---|---|
| **Visible** | Chuột đang trong vùng VÀ vừa cử động trong 80ms gần nhất | Dots xung quanh cursor sáng dần lên (fade-in) |
| **Hidden** | Chuột đứng yên > 80ms HOẶC chuột rời khỏi vùng | Dots tối dần về trạng thái idle (fade-out) |

### Timing

- **Fade-in:** ~350ms — đủ "từ từ" để cảm nhận chuyển động, nhưng vẫn responsive
- **Fade-out:** ~900ms — chậm hơn fade-in để tạo cảm giác mềm mại, không bị giật
- **Idle threshold:** 80ms không cử động → bắt đầu fade-out
- **Cursor smoothing:** Lerp 0.18 — spotlight đuổi theo cursor có độ trễ nhẹ

### Edge cases

- Khi chuột re-enter sau khi đã fade-out hoàn toàn → fade-in lại bình thường (state machine không cần "reset")
- Khi user di chuột liên tục → strength giữ ở mức 1, không pulse
- Khi window resize → grid được tính lại, dot vẫn căn giữa vùng

## 4. Accessibility & performance

| Yêu cầu | Implementation |
|---|---|
| `prefers-reduced-motion: reduce` | Tắt animation, chỉ hiển thị grid tĩnh |
| Mobile / touch device | Tắt hiệu ứng (`@media (hover: none)`) — không có cursor để tương tác |
| Performance | Canvas redraw trong RAF loop. Khi `strength === 0` và không có movement → có thể skip RAF để tiết kiệm CPU |
| HiDPI screens | Dùng `devicePixelRatio` để dot không bị vỡ |

## 5. Technical implementation

**Khuyến nghị:** Canvas 2D (không dùng SVG hay CSS thuần)
- Lý do: cần điều khiển opacity của từng dot riêng theo khoảng cách → CSS không làm được, SVG quá nặng với hàng trăm dot

**Cấu trúc:**
1. Một `<canvas>` full-size, position absolute trong container
2. Build mảng `dots[]` 1 lần khi mount/resize
3. RAF loop:
   - Smooth cursor position (lerp)
   - Update `strength` (tween về target 0 hoặc 1, rate khác nhau cho fade-in/out)
   - Vẽ từng dot với opacity = base + boost(distance, strength)

**Events:**
- `mouseenter` → `isInside = true`
- `mousemove` → cập nhật `mouseX/Y` + `lastMoveTime`
- `mouseleave` → `isInside = false`
- `resize` → rebuild grid

## 6. Acceptance criteria

- [ ] Lưới dot màu vàng hiển thị đều trên toàn bộ container
- [ ] Khi di chuyển chuột vào vùng, dots quanh cursor sáng dần lên trong ~350ms
- [ ] Khi chuột đứng yên tại chỗ, dots **tự tắt dần** trong ~900ms (không cần rời chuột)
- [ ] Khi di chuột tiếp tục, dots sáng lại
- [ ] Khi rời chuột khỏi vùng, dots tắt dần như khi đứng yên
- [ ] Hiệu ứng mượt 60fps trên máy desktop tầm trung
- [ ] Tắt trên mobile và khi user bật reduced-motion
- [ ] Responsive khi resize window

## 7. Tham khảo

- File demo: `dot-grid-spotlight.html`
- Tham số có thể tinh chỉnh ở đầu script: `SPACING`, `RADIUS`, `COLOR`, `FADE_IN_RATE`, `FADE_OUT_RATE`, `IDLE_MS`
