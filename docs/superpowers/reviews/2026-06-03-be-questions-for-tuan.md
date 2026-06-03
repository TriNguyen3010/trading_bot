# Message gửi Tuấn (BE) — câu hỏi sau đợt re-review FE

> Anh Tri copy gửi Tuấn. 5 câu, xếp theo độ ưu tiên. Phần lớn FE đã tự fix/guard, đây là các điểm cần BE xác nhận để chốt.

---

Tuấn ơi, anh vừa rà lại toàn bộ FE, có vài chỗ cần em xác nhận phía BE nhé:

**1. (Quan trọng) `stoploss` có 2 chỗ, đang lệch nhau khi user TẮT stop-loss.**
FE gửi payload `/bot-strategy/create` có:

- top-level `stoploss`: `null` khi user tắt SL.
- `configurations.risk.stoploss`: `-0.4` (−40%) cho cùng trạng thái đó.

Cho anh hỏi: **code gen file `.py` đọc field nào?** Và `-0.4` có phải là "stop bắt buộc mặc định" mà Freqtrade luôn cần (nên FE phải gửi 1 giá trị), hay BE coi `null` = không stop? → Anh cần biết để cho 2 field nhất quán + hiển thị đúng trên summary (giờ bot ROI/manual đang ship `-0.4` mà UI không nói gì).

**2. Xin `error_code` ổn định khi đầy cap agent.**
Khi `/agent/create` fail vì ví đã đủ 3 agent Hyperliquid, FE đang phải **match chuỗi** ("too many" + "agent") để biết → mở luồng quản lý/revoke. Nếu BE đổi câu chữ là FE hỏng. Em thêm giúp field máy đọc được không, ví dụ `{"detail": {"code": "AGENT_CAP_FULL"}}` hoặc HTTP 409? FE sẽ ưu tiên code, giữ string match làm fallback.

**3. Xác nhận signature flow khi user đổi account giữa chừng.**
Nếu user ký bằng 1 address khác với `X-Wallet-Address`/nonce đã xin (đổi account trong ví giữa lúc sign), BE có **recover signer rồi so với header address** và trả 403 không? Anh muốn chắc là mismatch bị từ chối (không nhầm lẫn nonce).

**4. Nonce lookup có case-insensitive theo address không?**
FE lowercase address ở mọi chỗ (xin nonce + header). BE lưu/đọc nonce theo `wallet_nonce:{address}` — em confirm là lookup không phân biệt hoa/thường (hoặc cũng lowercase) để không lệch khi ví trả address checksum nhé.

**5. (Product) Sau khi revoke/rotate để giải phóng slot, bot user vừa bấm "Go Live" có cần BE tự khởi động lại không,** hay FE sẽ chủ động gọi start lại? Anh muốn thống nhất hành vi để user bấm Live 1 phát là chạy, không phải bấm lại.

Cảm ơn em, mấy cái 1–2 là chặn việc anh smoke-test Live thật nên ưu tiên giúp anh nhé.
