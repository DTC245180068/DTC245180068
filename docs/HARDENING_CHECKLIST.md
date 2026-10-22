# BẢNG KIỂM TRA & TÀI LIỆU HARDENING HỆ THỐNG DOCKER COMPOSE
## Đề 18: Hệ thống Quản lý Hóa đơn & Thanh toán (Billing Management System)

---

### 1. Tổng quan về Hardening (Làm cứng hệ thống)
Hardening là quy trình bảo mật nhằm giảm thiểu bề mặt tấn công (attack surface) của hệ thống bằng cách loại bỏ các rủi ro tiềm ẩn, hạn chế quyền tối đa (Principle of Least Privilege), cô lập các phân vùng mạng và thiết lập các lớp phòng thủ chuyên sâu (Defense-in-Depth).

Dưới đây là các biện pháp Hardening đã được áp dụng đầy đủ trên toàn bộ hệ thống dịch vụ theo yêu cầu của Đề bài.

---

### 2. Danh mục Các Biện pháp Hardening Đã Triển Khai

| STT | Hạng mục Hardening | Dịch vụ Áp dụng | Cấu hình Chi tiết | Mục đích & Rủi ro Ngăn chặn |
|---|---|---|---|---|
| **1** | **Non-Root Container User** | `billing-app`, `prometheus`, `loki` | - Dockerfile: `adduser -u 10001 -S appuser`<br>- Compose: `user: "10001:10001"` (App, Loki)<br>- Compose: `user: "65534:65534"` (Prometheus) | Ngăn ngừa tấn công **Container Breakout** (khi kẻ tấn công chiếm quyền container không thể kiểm soát máy chủ host). |
| **2** | **Network Isolation (Phân vùng mạng)** | Toàn bộ 11 dịch vụ | 3 Subnets Docker riêng biệt:<br>- `frontend-net`: Nginx, App, pgAdmin, Grafana<br>- `backend-net`: App, Postgres, pgAdmin, exporter<br>- `monitoring-net`: Prometheus, Grafana, Exporters, Loki, Promtail | **Cách ly cơ sở dữ liệu:** Database tuyệt đối không mở port ra Internet, chỉ giao tiếp nội bộ trong `backend-net`. |
| **3** | **Cấm leo thang đặc quyền** | Toàn bộ các dịch vụ | `security_opt: ["no-new-privileges:true"]` | Chặn các tiến trình con bên trong container sử dụng `setuid` hoặc `setgid` để giành thêm đặc quyền root. |
| **4** | **Giới hạn tài nguyên (Resource Limits)** | Toàn bộ các dịch vụ | - `mem_limit`: 64MB - 512MB<br>- `cpus`: 0.3 - 1.0 CPU | Chống tấn công **Từ chối dịch vụ (DoS / Resource Exhaustion)** làm sập máy chủ chủ nhà. |
| **5** | **Security Headers Nginx** | `nginx` reverse proxy | - `Strict-Transport-Security: max-age=31536000`<br>- `X-Frame-Options: SAMEORIGIN`<br>- `X-Content-Type-Options: nosniff`<br>- `X-XSS-Protection: 1; mode=block`<br>- `Content-Security-Policy: ...`<br>- `Permissions-Policy: ...` | Chống tấn công **Clickjacking, Cross-Site Scripting (XSS), MIME sniffing, Man-in-the-Middle (MITM)**. |
| **6** | **Ẩn thông tin phiên bản (Information Disclosure)** | `nginx` reverse proxy | `server_tokens off;` | Không lộ phiên bản Nginx trong HTTP response header `Server`, gây khó khăn cho kẻ tấn công dò quét lỗ hổng (CVE scanning). |
| **7** | **Mã hóa truyền thông SSL/TLS** | `nginx` reverse proxy | - HTTPS tự ký chuẩn RSA 2048-bit<br>- Chặn hoàn toàn HTTP (301 redirect sang 443)<br>- Chỉ cho phép TLSv1.2 & TLSv1.3<br>- Bộ Cipher mã hóa mạnh (GCM, SHA256/384) | Bảo mật toàn bộ dữ liệu giao dịch hóa đơn truyền tải qua mạng công cộng. |
| **8** | **Kiểm soát tần suất truy cập (Rate Limiting)** | `nginx` reverse proxy | `limit_req_zone $binary_remote_addr zone=billing_limit:10m rate=15r/s;`<br>`limit_req zone=billing_limit burst=20 nodelay;` | Chống vét cạn brute-force và DDoS mức ứng dụng (Application Layer 7 Flooding). |
| **9** | **Quản lý Mật khẩu & Bí mật An toàn** | Database, pgAdmin, Grafana | Lưu trong `.env` riêng biệt, không hardcode vào Git, mật khẩu độ phức tạp cao (>16 ký tự bao gồm hoa, thường, số và ký tự đặc biệt). | Chống lộ thông tin xác thực trên kho mã nguồn GitHub công khai. |
| **10** | **Read-Only Volume Mounts** | Config files, Init SQL, Provisioning | Thêm cờ `:ro` (Read-Only) vào toàn bộ file cấu hình gắn vào container | Tránh trường hợp container bị can thiệp làm thay đổi cấu hình gốc. |

---

### 3. Lệnh Kiểm tra & Xác minh Hardening (Verification Commands)

#### 1. Kiểm tra User chạy trong container ứng dụng (Phải là Non-Root):
```bash
docker exec -it billing-app id
```
*Kết quả mong đợi:* `uid=10001(appuser) gid=10001(appgroup) groups=10001(appgroup)`

#### 2. Kiểm tra tính cách ly mạng của PostgreSQL:
```bash
# Thử kết nối trực tiếp cổng 5432 từ bên ngoài host:
# Kết quả: Cổng 5432 KHÔNG được expose ra host, hoàn toàn đóng!
docker port billing-postgres
```
*Kết quả mong đợi:* Không có cổng nào được forward ra ngoài máy host.

#### 3. Kiểm tra Security Headers trả về từ Nginx:
```bash
curl -k -I https://localhost
```
*Kết quả mong đợi:*
```http
HTTP/2 200
server: nginx
strict-transport-security: max-age=31536000; includeSubDomains
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; ...
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
```

#### 4. Kiểm tra giới hạn tài nguyên Container:
```bash
docker stats --no-stream
```
*Kết quả mong đợi:* Cột `MEM LIMIT` hiển thị đúng ngưỡng tối đa đã thiết lập trong compose (ví dụ: `billing-app` là 384MB, `postgres` là 512MB).
