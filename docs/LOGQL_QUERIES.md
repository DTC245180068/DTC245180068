# TÀI LIỆU HƯỚNG DẪN TRUY VẤN LOGQL VỚI LOKI & PROMTAIL
## Đề 18: Hệ thống Quản lý Hóa đơn & Thanh toán (Billing Management System)

---

### 1. Giới thiệu Kiến trúc Thu thập Log Tập Trung (Centralized Logging)

Hệ thống triển khai mô hình quản lý nhật ký tập trung bao gồm:
1. **Application & Service Logs**: 
   - Ứng dụng **Node.js Billing App** sử dụng thư viện `winston` ghi log định dạng JSON ra file `/var/log/app/app.log` và `error.log`.
   - **Nginx Reverse Proxy** ghi `access.log` và `error.log` theo định dạng `json_combined` tại `/var/log/nginx/`.
   - Các container Docker ghi log chuẩn `json-file` tại `/var/lib/docker/containers/`.
2. **Promtail (Log Shipping Agent)**:
   - Chạy như một container daemon thu thập (tail) toàn bộ file log thời gian thực.
   - Trích xuất trường JSON (timestamp, level, service, statusCode, responseTimeMs) và gán nhãn (labels).
   - Đẩy (push) log nén về Loki qua HTTP API (`http://loki:3100/loki/api/v1/push`).
3. **Loki (Log Aggregation Engine)**:
   - Lưu trữ log theo chỉ mục nhãn (labels-only indexing) kết hợp TSDB, tối ưu dung lượng và tốc độ truy vấn.
4. **Grafana (Visualization & Exploration)**:
   - Giao diện trực quan hóa thông qua menu **Explore**, cho phép lọc, tìm kiếm và phân tích log theo cú pháp **LogQL**.

---

### 2. Hướng dẫn Truy cập và Sử dụng Grafana Explore

1. Mở trình duyệt và truy cập Grafana tại: `http://localhost:3001`
2. Đăng nhập với tài khoản:
   - **Username:** `admin`
   - **Password:** `GrafanaAdmin_2026!#` (hoặc mật khẩu cấu hình trong `.env`)
3. Tại menu bên trái, nhấp vào biểu tượng la bàn **Explore** (hoặc truy cập `http://localhost:3001/explore`).
4. Tại ô chọn Datasource góc trên bên trái, chọn **Loki**.
5. Nhập các câu truy vấn LogQL bên dưới vào ô soạn thảo query và nhấn **Run query** (hoặc `Shift + Enter`).

---

### 3. Danh sách Các Câu Truy Vấn Mẫu LogQL (Đáp ứng Yêu cầu Đề Bài)

#### Câu truy vấn 1: Lọc tất cả log lỗi (Error Logs) trong hệ thống
- **Mục đích:** Phát hiện nhanh các lỗi xảy ra trong ứng dụng Node.js (lỗi kết nối DB, cú pháp, 500 error).
- **Cú pháp LogQL:**
```logql
{container="billing-app"} |= "error"
```
- **Giải thích:**
  - `{container="billing-app"}`: Bộ chọn luồng log (stream selector) của container ứng dụng.
  - `|= "error"`: Lọc giữ lại các dòng log có chứa chuỗi `"error"` (không phân biệt case nếu dùng `|~ "(?i)error"`).

---

#### Câu truy vấn 2: Phân tích log JSON và lọc các HTTP Request có độ trễ > 50ms
- **Mục đích:** Giám sát hiệu năng, phát hiện các API xử lý chậm làm ảnh hưởng trải nghiệm người dùng.
- **Cú pháp LogQL:**
```logql
{container="billing-app"} | json | responseTimeMs > 50
```
- **Giải thích:**
  - `| json`: Parser tự động bóc tách các trường từ chuỗi JSON log của Winston (`level`, `method`, `url`, `statusCode`, `responseTimeMs`).
  - `| responseTimeMs > 50`: Bộ lọc số học (filter expression) lọc ra những request có thời gian xử lý lớn hơn 50 mili-giây.

---

#### Câu truy vấn 3: Lọc các truy vấn HTTP lỗi 4xx và 5xx qua Nginx Reverse Proxy
- **Mục đích:** Theo dõi lưu lượng bị lỗi tại cổng vào Nginx (404 Not Found, 403 Forbidden, 502 Bad Gateway, 500 Internal Error).
- **Cú pháp LogQL:**
```logql
{container="billing-nginx"} | json | status >= 400
```
- **Giải thích:**
  - `{container="billing-nginx"}`: Chọn log sinh ra từ web server Nginx.
  - `| json`: Bóc tách cấu trúc log JSON do Nginx xuất ra.
  - `| status >= 400`: Lọc các request có mã phản hồi HTTP từ 400 trở lên.

---

#### Câu truy vấn 4: Giám sát các sự kiện nghiệp vụ quan trọng (Tạo hóa đơn & Thanh toán)
- **Mục đích:** Kiểm toán (Audit log) các thao tác tài chính nghiệp vụ trong hệ thống hóa đơn.
- **Cú pháp LogQL:**
```logql
{container="billing-app"} |~ "(Created new invoice|Recorded payment)"
```
- **Giải thích:**
  - `|~`: Bộ lọc sử dụng Regular Expression (biểu thức chính quy).
  - Tìm kiếm các sự kiện tạo hóa đơn mới (`Created new invoice`) hoặc ghi nhận giao dịch thanh toán thành công (`Recorded payment`).

---

#### Câu truy vấn 5: Đo lường tốc độ phát sinh log lỗi theo thời gian (Metric Query over Logs)
- **Mục đích:** Chuyển đổi log thành chuỗi thời gian (time series) để vẽ đồ thị cảnh báo trong Grafana.
- **Cú pháp LogQL:**
```logql
sum by (container) (rate({job="docker-containers"} |= "error" [5m]))
```
- **Giải thích:**
  - `rate(... [5m])`: Tính tỷ lệ trung bình số log lỗi xuất hiện mỗi giây trong cửa sổ 5 phút gần nhất.
  - `sum by (container)`: Tổng hợp và gom nhóm theo từng container tương ứng.

---

### 4. Bằng chứng Kiểm thử (Verification & Screenshots)
Khi chấm bài hoặc viết báo cáo, chụp lại ảnh màn hình tại Grafana Explore:
1. Ảnh chụp kết quả chạy câu truy vấn 1 (Log lỗi)
2. Ảnh chụp kết quả chạy câu truy vấn 2 (Log JSON độ trễ request)
3. Ảnh chụp đồ thị Log volume sinh ra từ Promtail
