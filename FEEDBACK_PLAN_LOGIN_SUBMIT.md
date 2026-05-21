# Feedback: PLAN_LOGIN_SUBMIT.md

Bản kế hoạch `PLAN_LOGIN_SUBMIT.md` được soạn thảo rất chi tiết, cấu trúc rõ ràng và tuân thủ các best practice của React (Zustand persist, xử lý 401/422 tập trung, Vite Proxy). Tuy nhiên, có một số điểm cần điều chỉnh để đảm bảo code chạy đúng ở môi trường Dev.

## 1. Điểm cần sửa bắt buộc: Lỗi logic cấu hình Vite Proxy (CORS)

**Vị trí trong Plan:** Task 1.1 & Task 1.2

**Vấn đề:**
Bạn định cấu hình Vite proxy (`/api` -> `https://tradingbot.ne.com:8502`) để tránh CORS. Nhưng ở file `.env.local` bạn lại đặt:

```env
VITE_API_BASE_URL=https://tradingbot.ne.com:8502
```

Khi thư viện `http.ts` gọi request, nó sẽ gọi **trực tiếp** đến domain của backend thay vì gọi qua `localhost:5173/api/...`. Hậu quả là Vite Proxy bị bỏ qua hoàn toàn và request sẽ thất bại do lỗi CORS.

**Cách khắc phục:**
Chỉnh lại các file biến môi trường để ép `http.ts` gọi vào `/api` ở môi trường Dev.

- **Sửa `.env.local`** (hoặc `.env.development`):

  ```env
  # Bắt buộc dùng /api để Vite Proxy chặn và xử lý CORS dưới local
  VITE_API_BASE_URL=/api
  ```

- **Tạo thêm `.env.production`**:
  ```env
  # Khi deploy, gọi thẳng lên BE thật (BE lúc này cần mở CORS whitelist domain của FE)
  VITE_API_BASE_URL=https://tradingbot.ne.com:8502
  ```

_(Với cách cấu hình này, file `src/lib/http.ts` của bạn sẽ rất sạch, không cần viết logic If/Else kiểm tra môi trường.)_

---

## 2. Lưu ý cần confirm với Backend (Mục 0.1)

**Vị trí trong Plan:** `POST /bot-strategy/create`

Trong tài liệu kỹ thuật ban đầu (`BE/tradingbot_doc.md` Mục 5.2 và 5.3), kiến trúc backend định nghĩa 2 endpoint rời:

1. `POST /bot/create`
2. `POST /strategy/create`

Nhưng trong PLAN, bạn đang gọi 1 endpoint gộp là `POST /bot-strategy/create`.

- **Nếu** bạn đã trao đổi với BE và họ xác nhận đã tạo endpoint gộp này cho FE dễ dùng → Cách làm của bạn hoàn toàn tối ưu.
- **Nếu chưa**, vui lòng confirm lại với BE để tránh việc gửi data lên bị sai đường dẫn API.

---

## 3. Tổng kết

Ngoài vấn đề về Vite proxy ở trên, tất cả các phần còn lại của PLAN bao gồm:

- **Roadmap 3 Phases**
- **Task list**
- **Definition of Done (DoD)**
- **Kịch bản Rollback**

đều **rất hoàn hảo và chuyên nghiệp**. Bạn có thể cập nhật lại file `PLAN_LOGIN_SUBMIT.md` theo phần feedback số 1 và tiến hành code ngay!
