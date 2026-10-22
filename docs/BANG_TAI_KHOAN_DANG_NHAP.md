# BẢNG TỔNG HỢP THÔNG TIN HỆ THỐNG WEB & TÀI KHOẢN ĐĂNG NHẬP CHUẨN

---

### THÔNG TIN HỌC PHẦN & SINH VIÊN THỰC HIỆN
* **Trường:** Đại học Công nghệ Thông tin và Truyền thông (ICTU)
* **Khoa:** Công nghệ Thông tin
* **Bộ môn:** Mạng & Quản trị Hệ thống / Công nghệ Phần mềm
* **Môn học:** Triển khai và Quản trị Hệ thống Phần mềm
* **Đề tài:** **Đề 18: Hệ thống Quản lý Hóa đơn & Thanh toán (Billing Management System)**
* **Sinh viên thực hiện:** **Vũ Hồng Dũng**
* **Mã số sinh viên (MSSV):** **DTC245180068**
* **Lớp / Khóa:** **KTPM K23B**
* **Repository GitHub:** https://github.com/dtc245180068-droid/billing-management-system

---

## 1. THÔNG TIN CÁC CỔNG DỊCH VỤ & ĐƯỜNG DẪN TRUY CẬP (WEB ENDPOINTS)

| STT | Dịch vụ / Phân hệ | Giao thức & Cổng Host | Đường dẫn truy cập (URL) | Mục đích sử dụng |
|:---:|---|:---:|---|---|
| **1** | **Website Quản lý Hóa đơn (Nginx HTTPS)** | **HTTPS (Cổng 443)** | **`https://localhost`**<br>*(hoặc `https://<IP_MAY_CHU>`)* | Cổng giao tiếp chính: Bảo mật SSL tự ký RSA 2048-bit, Security Headers, Rate Limiting. |
| **2** | **Trang Đăng nhập Hệ thống** | **HTTPS (Cổng 443)** | **`https://localhost/login`** | Giao diện đăng nhập phân quyền tích hợp 4 nút chọn nhanh tài khoản kiểm thử. |
| **3** | **Website HTTP Redirect** | **HTTP (Cổng 8080 / 80)** | `http://localhost:8080`<br>*(hoặc `http://localhost:80`)* | Tự động chuyển hướng (HTTP 301 Redirect) sang `https://localhost`. |
| **4** | **Bảng điều khiển Giám sát Grafana** | **HTTP (Cổng 3001)** | **`http://localhost:3001`** | Trực quan hóa 3 bộ Dashboards: Doanh thu kinh doanh, Container Docker và PostgreSQL. |
| **5** | **Truy vấn Log tập trung (Loki LogQL)** | **HTTP (Cổng 3001)** | **`http://localhost:3001/explore`** | Giao diện Grafana Explore truy vấn bóc tách log an ninh bằng ngôn ngữ LogQL. |
| **6** | **Máy chủ Chỉ số Prometheus TSDB** | **HTTP (Cổng 9090)** | **`http://localhost:9090`** | Kiểm tra 5 Scrape Targets UP (`/targets`) và trạng thái cảnh báo tự động (`/alerts`). |
| **7** | **Quản trị CSDL pgAdmin 4** | **HTTP (Cổng 5050)** | **`http://localhost:5050`** | Giao diện đồ họa web trực quan quản trị CSDL PostgreSQL 16. |
| **8** | **API Kiểm tra Sức khỏe (Health Check)** | **HTTPS (Cổng 443)** | **`https://localhost/api/health`** | Trả về trạng thái uptime, độ trễ kết nối PostgreSQL và dung lượng RAM heap. |
| **9** | **Prometheus Raw Metrics API** | **HTTPS (Cổng 443)** | **`https://localhost/metrics`** | Endpoint cào chỉ số thời gian thực (Request rate, latency, doanh thu, logins). |
| **10** | **Grafana Loki Log Server** | **HTTP (Cổng 3100)** | `http://localhost:3100/ready` | Máy chủ lưu trữ nhật ký phân tán dạng chuỗi nhãn thời gian. |
| **11** | **PostgreSQL 16 Database** | **TCP (Cổng nội bộ 5432)** | `postgres:5432`<br>*(nội bộ `backend-net`)* | CSDL quan hệ chính (Cô lập an toàn, tuyệt đối không mở cổng ra ngoài Host). |

---

## 2. BẢNG TỔNG HỢP TÀI KHOẢN ĐĂNG NHẬP CHUẨN THEO PHÂN QUYỀN

### Nhóm 1: Tài khoản Ứng dụng Web Quản lý Hóa đơn (Billing Web App)

> **Cơ chế Điều hướng Phân quyền (Role-based Navigation):**
> Khi người dùng truy cập hệ thống (`https://localhost/` hoặc các trang nội bộ), hệ thống sẽ **bắt buộc đăng nhập ngay tại `/login`** chứ không cho phép khách vãng lai xem Dashboard trước. Sau khi người dùng nhập tài khoản, hệ thống sẽ **xác thực danh tính, xác nhận vai trò** và **tự động chuyển hướng đến đúng giao diện chức năng tương ứng** với vai trò đó.

| STT | Vai trò (Role) | Tên đăng nhập | Mật khẩu | Đối tượng / Họ tên | Giao diện chuyển đến sau đăng nhập | Quyền hạn & Chức năng thực tế |
|:---:|---|:---:|:---:|---|:---:|---|
| **1** | **Quản Trị Viên (ADMIN)** | **`admin`** | **`admin123`** | **Vũ Hồng Dũng**<br>*(Quản trị viên)* | **`https://localhost/`**<br>*(Dashboard trung tâm)* | **Toàn quyền:** Xem bảng điều khiển KPI doanh thu thời gian thực, quản lý khách hàng, duyệt thanh toán, giám sát hệ thống. |
| **2** | **Kế Toán Trưởng (ACCOUNTANT)** | **`ketoan1`** | **`123456`** | **Nguyễn Thu Hà**<br>*(Kế toán trưởng)* | **`https://localhost/invoices`**<br>*(Quản lý Hóa đơn & Duyệt)* | **Nghiệp vụ tài chính & Xét duyệt:** Lập hóa đơn bán hàng/dịch vụ GTGT, tính thuế VAT, đối soát công nợ, **thẩm định & phê duyệt / từ chối các yêu cầu xuất hóa đơn** gửi từ khách hàng, xuất in hóa đơn điện tử PDF. *(Đã ẩn các mục kỹ thuật hạ tầng Giám sát & Quản trị, Metrics chỉ dành riêng cho Admin)*. |
| **3** | **Khách Hàng 1 (CUSTOMER)** | **`khachhang1`** | **`123456`** | **Công ty Alpha Việt Nam** *(KH001)* | **`https://localhost/portal`**<br>*(Cổng Khách hàng)* | **Cổng khách hàng cá nhân:** Xem hóa đơn của chính mình, **lập yêu cầu xuất hóa đơn gửi Kế toán duyệt**, nhận thông báo dạng form (xanh khi được duyệt & tạo hóa đơn, đỏ kèm lý do khi bị từ chối), tự tra cứu số tiền đã trả, in hóa đơn VAT, thanh toán trực tuyến 24/7. |
| **4** | **Khách Hàng 2 (CUSTOMER)** | **`khachhang2`** | **`123456`** | **Tập đoàn Beta Group** *(KH002)* | **`https://localhost/portal`**<br>*(Cổng Khách hàng)* | **Cổng khách hàng cá nhân:** Tra cứu danh sách hóa đơn dịch vụ của Beta Group, gửi yêu cầu cấp hóa đơn cho Ban Kế toán, kiểm tra hạn nợ thanh toán, nhận thông báo dạng form phản hồi. |

---

### Nhóm 2: Tài khoản Quản trị Hệ thống, Giám sát & CSDL (DevOps & Database)

| STT | Hệ thống / Dịch vụ | Tên đăng nhập / Email | Mật khẩu | Phạm vi sử dụng & Ghi chú |
|:---:|---|:---:|:---:|---|
| **1** | **Grafana Dashboard & Loki** | **`admin`** | **`GrafanaAdmin_2026!#`** | Đăng nhập Grafana tại `http://localhost:3001`. Xem 3 Dashboards tự nạp sẵn và truy vấn LogQL trong Explore. |
| **2** | **pgAdmin 4 Web GUI** | **`admin@billing.com`** | **`AdminPass_2026!#`** | Đăng nhập giao diện quản trị CSDL tại `http://localhost:5050`. |
| **3** | **PostgreSQL App DB (Owner)** | **`billing_user`** | **`StrongBillingPass_2026!#`** | Kết nối CSDL `billing_db` bên trong pgAdmin hoặc kết nối của ứng dụng Web Node.js. |
| **4** | **PostgreSQL Least Privilege** | **`monitoring_user`** | **`Monitor_2026_ReadOnly99!`** | Tài khoản phân quyền tối thiểu dành riêng cho `postgres-exporter` (Chỉ có quyền `pg_monitor` & `SELECT`, cấm xóa bảng `DROP TABLE`). |
| **5** | **Prometheus Server** | *(Không yêu cầu)* | *(Mạng nội bộ)* | Truy cập trực tiếp tại `http://localhost:9090` để kiểm tra metrics và alert rules. |

---

## 3. HƯỚNG DẪN TRUY CẬP VÀ MẸO DEMO NHANH

### 1. Bỏ qua cảnh báo SSL tự ký trên trình duyệt
Khi truy cập `https://localhost`, trình duyệt sẽ hiển thị cảnh báo: *"Kết nối của bạn không an toàn"* (do chứng chỉ SSL tự ký dùng cho môi trường thử nghiệm):
* Bấm nút **Nâng cao (Advanced)**.
* Chọn liên kết **Tiếp tục truy cập localhost (Proceed to localhost / Continue)**.

### 2. Sử dụng 4 nút chọn nhanh tài khoản
Tại trang đăng nhập `https://localhost/login`, hệ thống đã thiết kế sẵn **4 nút bấm chọn nhanh tài khoản** (`Quản trị viên`, `Kế toán trưởng`, `Khách hàng 1`, `Khách hàng 2`). Bạn chỉ cần nhấp một nút là form tự điền tài khoản & mật khẩu tương ứng, giúp thao tác trình diễn bảo vệ đồ án diễn ra nhanh chóng, chính xác.

---

## 4. BỘ LỆNH KIỂM CHỨNG & VẬN HÀNH NHANH

* **Kiểm tra hồi quy toàn diện hệ thống (Đạt 10/10 PASS - 100%):**
  ```powershell
  python scripts/check_regression.py
  ```

* **Kiểm chứng kịch bản Brute-force & cơ chế Rate Limiting Nginx (HTTP 429):**
  ```powershell
  python scripts/simulate_bruteforce.py
  ```

* **Xuất bằng chứng 6 biện pháp Hardening phục vụ viết báo cáo đồ án:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/hardening_evidence.ps1
  ```

* **Khởi động và kiểm tra 11 container:**
  ```powershell
  docker compose up -d
  docker compose ps
  ```
