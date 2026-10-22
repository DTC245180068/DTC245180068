# TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG
# KHOA CÔNG NGHỆ THÔNG TIN
--------------------***--------------------

## BÁO CÁO BÀI TẬP LỚN TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG PHẦN MỀM

**Đề tài:** Hệ thống Quản lý Hóa đơn & Thanh toán (Billing Management System) – Đề Tài 18
* **Sinh viên thực hiện:** Vũ Hồng Dũng
* **Mã số sinh viên (MSSV):** DTC245180068
* **Lớp / Khóa:** KTPM K23B

*Thái Nguyên, 2026*

---

## BẢNG TỔNG HỢP THÔNG TIN CỔNG DỊCH VỤ WEB & TÀI KHOẢN ĐĂNG NHẬP CHUẨN

> [!NOTE]
> Toàn bộ 11 container dịch vụ đang được triển khai và vận hành ổn định. Các tài khoản bên dưới đã được nạp sẵn dữ liệu thực tế 100% trong cơ sở dữ liệu `billing_db`, được phân quyền truy cập nghiêm ngặt và hỗ trợ 4 nút chọn nhanh trên giao diện đăng nhập để thuận tiện tối đa cho công tác kiểm tra, đánh giá đồ án.

### 1. Danh mục các cổng dịch vụ Web và đường dẫn truy cập (Web Endpoints)

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

### 2. Danh sách tài khoản người dùng ứng dụng Web (Billing Web App)

| STT | Vai trò (Role) | Tên đăng nhập (Username) | Mật khẩu (Password) | Đối tượng / Họ tên | Quyền hạn & Chức năng thực tế |
|:---:|---|:---:|:---:|---|---|
| **1** | **Quản Trị Viên (ADMIN)** | **`admin`** | **`admin123`** | **Vũ Hồng Dũng**<br>*(Quản trị viên hệ thống)* | **Toàn quyền:** Quản lý danh mục khách hàng, lập hóa đơn mới, chỉnh sửa trạng thái hóa đơn, ghi nhận thanh toán, xem báo cáo doanh thu thực thu thời gian thực. |
| **2** | **Kế Toán Trưởng (ACCOUNTANT)** | **`ketoan1`** | **`123456`** | **Nguyễn Thu Hà**<br>*(Kế toán trưởng)* | **Nghiệp vụ tài chính:** Lập hóa đơn bán hàng/dịch vụ GTGT, tính thuế VAT, đối soát công nợ khách hàng, xuất in hóa đơn điện tử PDF. |
| **3** | **Khách Hàng 1 (CUSTOMER)** | **`khachhang1`** | **`123456`** | **Công ty TNHH Công nghệ Alpha Việt Nam** *(Mã: KH001)* | **Phân quyền khách hàng:** Đăng nhập chỉ xem danh sách hóa đơn của chính mình (**"Hóa đơn của tôi"**), tự tra cứu số tiền đã trả, in hóa đơn VAT, bảo mật tuyệt đối dữ liệu. |
| **4** | **Khách Hàng 2 (CUSTOMER)** | **`khachhang2`** | **`123456`** | **Tập đoàn Đầu tư & Thương mại Beta Group** *(Mã: KH002)* | **Phân quyền khách hàng:** Đăng nhập tra cứu danh sách hóa đơn dịch vụ của Beta Group, kiểm tra hạn nợ thanh toán. |

---

### 3. Danh sách tài khoản Quản trị Hệ thống, Giám sát & CSDL (DevOps & Database)

| STT | Hệ thống / Dịch vụ | Tên đăng nhập / Email | Mật khẩu | Phạm vi sử dụng & Ghi chú |
|:---:|---|:---:|:---:|---|
| **1** | **Grafana Dashboard & Loki** | **`admin`** | **`GrafanaAdmin_2026!#`** | Đăng nhập Grafana tại `http://localhost:3001`. Xem 3 Dashboards tự nạp sẵn và truy vấn LogQL trong Explore. |
| **2** | **pgAdmin 4 Web GUI** | **`admin@billing.com`** | **`AdminPass_2026!#`** | Đăng nhập giao diện quản trị CSDL tại `http://localhost:5050`. |
| **3** | **PostgreSQL App DB (Owner)** | **`billing_user`** | **`StrongBillingPass_2026!#`** | Kết nối CSDL `billing_db` bên trong pgAdmin hoặc kết nối của ứng dụng Web Node.js. |
| **4** | **PostgreSQL Least Privilege** | **`monitoring_user`** | **`Monitor_2026_ReadOnly99!`** | Tài khoản phân quyền tối thiểu dành riêng cho `postgres-exporter` (Chỉ có quyền `pg_monitor` & `SELECT`, cấm xóa bảng `DROP TABLE`). |
| **5** | **Prometheus Server** | *(Không yêu cầu)* | *(Mạng nội bộ)* | Truy cập trực tiếp tại `http://localhost:9090` để kiểm tra metrics và alert rules. |

---

### 4. Hướng dẫn truy cập và mẹo thao tác demo nhanh

1. **Bỏ qua cảnh báo SSL tự ký trên trình duyệt:**
   - Khi truy cập `https://localhost`, trình duyệt sẽ hiển thị cảnh báo: *"Kết nối của bạn không an toàn"* (do chứng chỉ SSL tự ký dùng cho môi trường nội bộ/thử nghiệm).
   - Thao tác: Bấm **Nâng cao (Advanced)** -> Chọn **Tiếp tục truy cập localhost (Proceed to localhost / Continue)**.
2. **Sử dụng 4 nút chọn nhanh tài khoản:**
   - Tại trang đăng nhập `https://localhost/login`, hệ thống đã tích hợp sẵn **4 nút bấm chọn nhanh tài khoản** (`Quản trị viên`, `Kế toán trưởng`, `Khách hàng 1`, `Khách hàng 2`).
   - Nhấp chuột vào nút tương ứng để tự động điền thông tin đăng nhập và trải nghiệm các vai trò nghiệp vụ khác nhau ngay tức thì.

---

## PHẦN I: BÁO CÁO BÀI TẬP LỚN (NỘI DUNG TỔNG HỢP)

### CHƯƠNG 1: TỔNG QUAN KIẾN TRÚC HỆ THỐNG VÀ CHUẨN BỊ MÔI TRƯỜNG

#### 1.1. Sơ đồ kiến trúc tổng thể
Hệ thống được thiết kế theo mô hình kiến trúc container hóa với 11 dịch vụ phần mềm phối hợp chặt chẽ, độc lập nhưng giao tiếp thông qua 3 Docker internal networks (`frontend-net`, `backend-net`, `monitoring-net`):
* **Nginx Reverse Proxy:** Đóng vai trò cổng giao tiếp duy nhất (Single Point of Entry) nhận request từ người dùng ngoài internet qua cổng 80/443 (hoặc 8080/443), thực hiện định tuyến sang ứng dụng Node.js, áp dụng các cơ chế bảo mật HTTP Security Headers chuẩn OWASP, mã hóa SSL/TLS tự ký RSA 2048-bit, ẩn phiên bản máy chủ (`server_tokens off`) và giới hạn tần suất truy cập (Rate Limiting) nghiêm ngặt nhằm chống tấn công DoS và Brute-force.
* **Ứng dụng Web & Cơ sở dữ liệu:** Chạy bên trong container riêng biệt. Web Node.js Express cung cấp phân hệ nghiệp vụ toàn diện cho Quản trị viên (Admin), Kế toán trưởng và Khách hàng đối tác doanh nghiệp, kết nối trực tiếp với CSDL PostgreSQL 16 nội bộ qua Docker network `backend-net` được cô lập hoàn toàn (không mở cổng 5432 ra máy chủ Host).
* **Giám sát Metrics (Prometheus + Grafana):** Prometheus định kỳ cào dữ liệu (scrape metrics) 15 giây/lần từ 5 targets (Node.js App, Postgres Exporter, Nginx Exporter, cAdvisor, Prometheus), sau đó Grafana trực quan hóa thành các dashboard quản trị chuyên nghiệp, hiển thị số liệu doanh thu thực thu, phân bổ hóa đơn, thông số phần cứng CPU/RAM khớp 100% thời gian thực.
* **Quản lý Log tập trung (Loki + Promtail):** Promtail tự động đọc log định dạng JSON từ ứng dụng (`/var/log/app/app.log`) và Nginx (`/var/log/nginx/access.log`), gán nhãn container và chuyển tiếp về Loki server, cho phép quản trị viên truy vết và điều tra sự cố an toàn thông tin bằng ngôn ngữ LogQL trong Grafana Explore.

```mermaid
flowchart TB
    %% ====================================================================
    %% SƠ ĐỒ KIẾN TRÚC TỔNG THỂ HỆ THỐNG QUẢN LÝ HÓA ĐƠN & THANH TOÁN (ĐỀ 18)
    %% THIẾT KẾ ĐỐI XỨNG THEO CHUẨN MÔ HÌNH HẠ TẦNG DOCKER COMPOSE
    %% ====================================================================

    User["👤 Người dùng<br/>(Khách hàng / Kế toán / Admin)"]

    subgraph DockerHost ["📦 Docker Compose (máy chủ Ubuntu / Host)"]

        subgraph MonitoringCol ["📊 Giám sát và log tập trung"]
            Grafana["Grafana<br/>(Dashboards & LogQL Explore)"]

            Loki["Loki<br/>(Lưu trữ log tập trung)"]
            Prometheus["Prometheus<br/>(TSDB Metrics Server)"]

            Promtail["Promtail<br/>(đọc log container JSON)"]
            Exporters["Exporters<br/>(cAdvisor, Postgres, Nginx)"]

            Grafana -->|LogQL| Loki
            Grafana -->|PromQL| Prometheus
            Promtail -->|đẩy log :3100| Loki
            Exporters -->|thu metrics :9090| Prometheus
        end

        subgraph ServiceCol ["🏢 Phân hệ Dịch vụ & Dữ liệu"]
            subgraph ReverseProxyBox ["Reverse Proxy"]
                Nginx["Nginx<br/>HTTPS + Security Headers<br/>+ Rate Limiting"]
            end

            subgraph AppDbBox ["Ứng dụng & Cơ sở dữ liệu"]
                WebApp["Web App (Node.js Express)<br/>Cổng Khách Hàng & Quản Trị (:3000)"]
                Postgres[("PostgreSQL 16<br/>(billing_db :5432)")]
                WebApp <-->|SQL :5432| Postgres
            end

            Nginx -->|proxy :3000| WebApp
        end

    end

    %% Các luồng kết nối chính
    User -->|HTTPS 443| Nginx
    Nginx -.->|proxy /grafana/ (Port 3001)| Grafana
    WebApp -.->|/metrics| Prometheus
    DockerHost -.->|Docker Logs (JSON)| Promtail

    %% Định dạng trực quan
    style DockerHost fill:#ffffff,stroke:#1e293b,stroke-width:2.5px;
    style MonitoringCol fill:#f8fafc,stroke:#334155,stroke-width:2px;
    style ServiceCol fill:transparent,stroke:none;
    style ReverseProxyBox fill:#f8fafc,stroke:#334155,stroke-width:2px;
    style AppDbBox fill:#f8fafc,stroke:#334155,stroke-width:2px;

    style User fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    style Nginx fill:#ffffff,stroke:#0f172a,stroke-width:1.5px;
    style WebApp fill:#ecfdf5,stroke:#059669,stroke-width:1.5px;
    style Postgres fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px;
    style Grafana fill:#fefce8,stroke:#ca8a04,stroke-width:1.5px;
    style Loki fill:#fdf4ff,stroke:#c026d3,stroke-width:1.5px;
    style Prometheus fill:#fff1f2,stroke:#e11d48,stroke-width:1.5px;
    style Promtail fill:#ffffff,stroke:#475569,stroke-width:1.5px;
    style Exporters fill:#ffffff,stroke:#475569,stroke-width:1.5px;
```

#### 1.2. Yêu cầu quản lý mã nguồn trên GitHub
Toàn bộ mã nguồn ứng dụng, các tệp cấu hình triển khai (`docker-compose.yml`, `nginx.conf`, `prometheus.yml`, `loki-config.yml`, `alert.rules.yml`...), kịch bản kiểm thử tự động và tài liệu kỹ thuật được quản lý chặt chẽ trên GitHub theo đúng thông tin sinh viên:
* **Repository GitHub:** https://github.com/dtc245180068-droid/billing-management-system
* **Mã số sinh viên (MSSV):** DTC245180068 | **Sinh viên:** Vũ Hồng Dũng
* Repository GitHub được tổ chức với các commit rõ ràng theo đúng tiến độ triển khai yêu cầu của môn học.
* Tệp README.md được biên soạn chi tiết, hướng dẫn cụ thể cách thức clone repository, cấu hình biến môi trường `.env` và chạy lệnh `docker compose up -d` để khởi chạy toàn bộ hệ thống.

**Cấu trúc thư mục mã nguồn dự án:**
```text
billing-management-system/
├── docker-compose.yml          # Cấu hình 9 container dịch vụ và 3 Docker networks
├── .env.example                # File mẫu biến môi trường (không chứa mật khẩu thật)
├── .gitignore                  # Khai báo loại trừ file nhạy cảm (.env, certs, log)
├── README.md                   # Tài liệu hướng dẫn triển khai hệ thống
├── app/                        # Ứng dụng Web Quản lý Hóa đơn & Thanh toán (Node.js Express)
│   ├── Dockerfile              # Dockerfile đóng gói ứng dụng Node.js Alpine
│   ├── package.json            # Khai báo phụ thuộc: express, pg, prom-client
│   ├── server.js               # Mã nguồn backend REST API, logging và Prometheus metrics
│   └── public/
│       └── index.html          # Giao diện Khách hàng & Quản trị viên 5 sao
├── db/
│   └── init.sql                # Khởi tạo schema CSDL PostgreSQL, cấp quyền và dữ liệu mẫu
├── nginx/
│   ├── nginx.conf              # Cấu hình Reverse Proxy, HTTPS, Security Headers, Rate Limit
│   ├── gen-cert.sh             # Script tự động tạo chứng chỉ SSL tự ký RSA 2048-bit
│   └── certs/                  # Thư mục lưu trữ server.crt và server.key
├── prometheus/
│   └── prometheus.yml          # Cấu hình targets cào metrics định kỳ cho Prometheus
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/        # Khai báo kết nối Prometheus và Loki
│   │   └── dashboards/         # Tự động nạp dashboard quản trị
│   └── dashboards/
│       └── billing_overview.json # File JSON định nghĩa 9 panels dashboard giám sát
├── loki/
│   └── loki-config.yaml        # Cấu hình dịch vụ lưu trữ log Loki
└── promtail/
    └── promtail-config.yaml    # Cấu hình thu thập log container gửi về Loki
```

---

### CHƯƠNG 2: TRIỂN KHAI ỨNG DỤNG WEB, CƠ SỞ DỮ LIỆU VÀ REVERSE PROXY

#### 2.1. Triển khai ứng dụng Web & Cơ sở dữ liệu (Bước 1 & Bước 2)
Hệ thống Quản lý Hóa đơn & Thanh toán (Billing Management System) được thiết kế nhằm số hóa toàn diện quy trình lập hóa đơn, đối soát công nợ, in ấn hóa đơn GTGT và ghi nhận thanh toán dịch vụ của doanh nghiệp. Ứng dụng web được phát triển trên nền tảng Node.js (Express framework), áp dụng mô hình kiến trúc MVC, kết nối hệ quản trị cơ sở dữ liệu PostgreSQL 16. Toàn bộ các dịch vụ được đóng gói độc lập và điều phối tập trung thông qua Docker Compose.

Cơ sở dữ liệu của hệ thống được chuẩn hóa chặt chẽ theo dạng chuẩn 3NF với 5 bảng thực thể chính:
* **users:** Quản lý tài khoản người dùng, phân quyền vai trò (`ADMIN`, `ACCOUNTANT`, `CUSTOMER`), lưu trữ họ tên và ngày tạo tài khoản.
* **customers:** Lưu trữ chi tiết thông tin định danh của khách hàng/đối tác doanh nghiệp: mã khách (`code`), tên doanh nghiệp (`name`), Mã số thuế (`tax_id`), email, số điện thoại, địa chỉ trụ sở và liên kết tới tài khoản đăng nhập (`user_id`).
* **invoices:** Ghi nhận thông tin chi tiết từng hóa đơn bán hàng/dịch vụ: mã số hóa đơn (`invoice_number`, ví dụ `INV-2026-0001`), khách hàng (`customer_id`), ngày lập (`issue_date`), hạn thanh toán (`due_date`), trạng thái (`DRAFT`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED`), tiền hàng trước thuế (`subtotal`), thuế suất GTGT (`tax_rate`), tiền thuế (`tax_amount`), chiết khấu (`discount_amount`), tổng tiền thanh toán (`total_amount`) và ghi chú.
* **invoice_items:** Quản lý chi tiết từng dòng hàng hóa/dịch vụ trên hóa đơn: tên sản phẩm dịch vụ (`item_description`), số lượng (`quantity`), đơn giá (`unit_price`) và thành tiền (`amount`).
* **payments:** Ghi nhận lịch sử giao dịch thanh toán: mã thanh toán (`payment_code`, ví dụ `PAY-2026-0001`), hóa đơn thanh toán (`invoice_id`), ngày thu tiền (`payment_date`), số tiền (`amount`), phương thức thanh toán (`payment_method`: `BANK_TRANSFER`, `CASH`, `CREDIT_CARD`, `EWALLET`), mã tham chiếu ngân hàng (`reference_no`) và ghi chú đối soát.

**Quy trình nghiệp vụ thực tế hoạt động 100%:**
* Hệ thống áp dụng cơ chế quản lý giao dịch CSDL với `BEGIN`, `COMMIT`, `ROLLBACK`. Khi lập hóa đơn mới, hóa đơn và các dòng hàng hóa chi tiết được lưu trữ nguyên vẹn trong một transaction duy nhất.
* Khi ghi nhận thanh toán cho một hóa đơn, hệ thống tự động tính tổng lũy kế số tiền đã trả. Nếu số tiền đã trả đủ 100% giá trị hóa đơn, trạng thái hóa đơn tự động chuyển sang `PAID` và cập nhật tức thời doanh thu vào Prometheus metric `billing_revenue_total_vnd`.
* **Phân quyền người dùng nghiêm ngặt:** Quản trị viên và Kế toán trưởng có toàn quyền quản lý khách hàng, lập hóa đơn và ghi nhận thanh toán. Khách hàng đối tác doanh nghiệp khi đăng nhập chỉ xem và in ấn hóa đơn của chính doanh nghiệp mình (`Hóa đơn của tôi`), bảo đảm tuyệt đối tính riêng tư và bí mật kinh doanh.
* Mọi hành vi nghiệp vụ và an ninh (đăng nhập thành công `AUTH_LOGIN_SUCCESS`, đăng nhập thất bại `AUTH_LOGIN_FAILED`, tạo hóa đơn mới, ghi nhận thanh toán, xóa hóa đơn) đều được ghi nhận có cấu trúc định dạng JSON ra tệp log và luồng STDOUT của container phục vụ công tác giám sát an toàn thông tin.

#### 2.2. Cấu hình Nginx làm Reverse Proxy và Bảo mật cơ bản (Bước 3 - Commit 1)
Nginx (phiên bản Alpine) được triển khai làm Reverse Proxy duy nhất tiếp nhận lưu lượng truy cập từ bên ngoài qua cổng 80 và 443 (hoặc 8080/443), sau đó phân phối lưu lượng vào container nội bộ `billing-app` qua cổng 3000. Toàn bộ các cổng dịch vụ trực tiếp (Node.js 3000, PostgreSQL 5432) đã được gỡ bỏ khỏi chế độ publish công khai nhằm giảm thiểu tối đa diện tích tấn công (attack surface).

Các cơ chế bảo mật và tối ưu đã cấu hình trên Nginx:
* **Chuyển hướng HTTPS bắt buộc:** Toàn bộ truy vấn HTTP qua cổng 80 được chuyển hướng tự động (HTTP 301 Permanent Redirect) sang kết nối mã hóa HTTPS an toàn qua cổng 443.
* **Mã hóa TLS an toàn:** Hệ thống tích hợp chứng chỉ số tự ký (Self-signed Certificate) chuẩn RSA 2048-bit tại thư mục `nginx/ssl/`, giới hạn giao thức ở TLSv1.2 và TLSv1.3 với các bộ mã hóa (cipher suite) bảo mật cao như `ECDHE-ECDSA-AES128-GCM-SHA256`, `ECDHE-RSA-AES128-GCM-SHA256`.
* **Bộ Security Headers tiêu chuẩn (áp dụng always):** 
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (ép buộc HTTPS qua cơ chế HSTS);
  - `X-Frame-Options: SAMEORIGIN` (chống tấn công Clickjacking);
  - `X-Content-Type-Options: nosniff` (chống tấn công MIME-type sniffing);
  - `X-XSS-Protection: 1; mode=block` (bộ lọc chống Cross-Site Scripting);
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Content-Security-Policy (CSP)` kiểm soát chặt chẽ nguồn tải mã JavaScript, Font và Style;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
* **Ẩn thông tin phiên bản máy chủ:** Cấu hình `server_tokens off` để ẩn phiên bản Nginx trong HTTP response header, khiến kẻ tấn công không thể khai thác các lỗ hổng theo version.
* **Kiểm soát tần suất truy cập (Rate Limiting):**
  - Vùng lưu lượng chung: `zone=billing_limit:10m rate=15r/s` với `burst=20 nodelay` chống nghẽn đường truyền và tấn công DoS.
  - Vùng xác thực đăng nhập: `zone=login_limit:10m rate=10r/m` với `burst=3 nodelay; limit_req_status 429;` tại endpoint `/api/auth/login`, từ chối ngay lập tức các yêu cầu dò quét mật khẩu với mã HTTP `429 Too Many Requests`.

---

### CHƯƠNG 3: GIÁM SÁT HỆ THỐNG VỚI PROMETHEUS, GRAFANA VÀ LOKI

#### 3.1. Tích hợp Prometheus + Grafana (Bước 4 - Commit 2)
Hệ thống triển khai giải pháp giám sát toàn diện (Observability) bằng bộ đôi Prometheus và Grafana, kết hợp cùng các công cụ trích xuất số liệu chuyên dụng (Exporters):
* **Prometheus Server:** Đóng vai trò máy chủ lưu trữ dữ liệu chuỗi thời gian (Time-series Database), tự động cào số liệu (scraping) định kỳ 15 giây từ 5 jobs:
  1. `billing-app` (ứng dụng Web Node.js qua endpoint `/metrics`);
  2. `postgres` (Postgres Exporter qua cổng 9187);
  3. `nginx` (Nginx Exporter qua cổng 9113 từ `/nginx_status`);
  4. `cadvisor` (Container metrics qua cổng 8080);
  5. `prometheus` (chính máy chủ Prometheus qua cổng 9090).
* **cAdvisor:** Giám sát trực tiếp hiệu năng phần cứng của toàn bộ các container Docker (tỷ lệ chiếm dụng CPU %, dung lượng RAM tiêu thụ, lưu lượng mạng Network Rx/Tx theo thời gian thực).
* **Nginx Prometheus Exporter:** Đọc dữ liệu từ endpoint `/nginx_status` của Nginx để đo lường số lượng kết nối đang mở (active connections), số request đã xử lý và tần suất yêu cầu trên giây.
* **Postgres Exporter:** Kết nối tới CSDL PostgreSQL bằng tài khoản đặc quyền tối thiểu `monitoring_user`, giám sát số phiên kết nối đang mở (Active Connections), giao dịch commit/rollback và tỷ lệ đệm cache hit ratio.
* **Custom Metrics nghiệp vụ Hóa đơn (Business Metrics):**
  - `billing_revenue_total_vnd`: Doanh thu thực thu thời gian thực từ các hóa đơn đã thanh toán (`PAID`), đồng bộ 100% với số liệu hiển thị trên Web App.
  - `billing_invoices_count{status="..."}`: Số lượng hóa đơn phân bổ theo từng trạng thái (`PAID`, `SENT`, `OVERDUE`, `DRAFT`, `CANCELLED`).
  - `billing_user_logins_total{status="..."}`: Thống kê số lần đăng nhập thành công (`success`) và thất bại (`failed`) phục vụ giám sát an toàn thông tin.
  - `billing_customers_count`: Tổng số khách hàng doanh nghiệp đã đăng ký.
  - `billing_http_requests_total` & `billing_http_request_duration_seconds`: Đo lường lưu lượng HTTP và độ trễ phản hồi (p50, p95 latency).
* **Hệ thống Dashboard tự động (Provisioning):** Grafana tự động nạp cấu hình Datasources (Prometheus, Loki) và 3 bộ Dashboard chuyên sâu nạp sẵn từ `grafana/dashboards/`:
  1. *Billing System - Executive & Performance Overview:* Biểu đồ doanh thu kinh doanh kết hợp với HTTP Request Rate và Latency.
  2. *Docker Containers Resource Monitoring:* Giám sát CPU/RAM và Network I/O thực tế của từng container.
  3. *PostgreSQL Database Performance Monitoring:* Số lượng kết nối và hiệu suất cache của Postgres.

#### 3.2. Triển khai hệ thống Log tập trung Loki + Promtail (Bước 5 - Commit 3)
Hệ thống log tập trung được thiết lập bằng bộ đôi Grafana Loki và Promtail:
* **Promtail Log Shipper:** Đóng vai trò là tác tử (agent) tự động thu thập tệp nhật ký hoạt động có cấu trúc JSON từ ứng dụng Web (`/var/log/app/app.log`), nhật ký truy cập Nginx (`/var/log/nginx/access.log`) và luồng nhật ký container Docker, sau đó phân loại và gắn nhãn theo từng dịch vụ (`job="billing-app"`, `job="billing-nginx"`, `container="billing-app"`) rồi chuyển tiếp về máy chủ Loki để lưu trữ và lập chỉ mục.
* **Grafana Loki:** Máy chủ lưu trữ nhật ký dung lượng nhẹ, tối ưu hóa lưu trữ theo nhãn thay vì full-text indexing, cho phép người dùng truy vấn tốc độ cao qua ngôn ngữ LogQL.

**Các câu truy vấn LogQL tiêu biểu đã được kiểm chứng thành công trên hệ thống:**
* **Truy vấn 1 (Lọc log lỗi HTTP 4xx/5xx từ Nginx access log):**
  ```logql
  {container="billing-nginx"} | json | status >= 400
  ```
* **Truy vấn 2 (Tìm kiếm các thông điệp lỗi hoặc ngoại lệ trong ứng dụng Web):**
  ```logql
  {container="billing-app"} |= "error"
  ```
* **Truy vấn 3 (Lọc toàn bộ đăng nhập thất bại phục vụ điều tra an toàn thông tin):**
  ```logql
  {container="billing-app"} |= "AUTH_LOGIN_FAILED"
  ```
* **Truy vấn 4 (Đo tần suất đăng nhập sai theo phút phục vụ giám sát và cảnh báo):**
  ```logql
  sum(count_over_time({container="billing-app"} |= "AUTH_LOGIN_FAILED" [1m]))
  ```
* **Truy vấn 5 (Truy vết sự kiện nghiệp vụ tạo hóa đơn và thanh toán):**
  ```logql
  {container="billing-app"} |~ "(Created new invoice|Recorded payment)"
  ```

#### 3.3. Kịch bản sự cố An toàn thông tin: Tấn công dò mật khẩu (Brute-Force), Cảnh báo tự động và Truy vết Log
Nhằm đáp ứng yêu cầu thực nghiệm an ninh vận hành, hệ thống đã xây dựng và kiểm thử thành công kịch bản phát hiện, cảnh báo và ngăn chặn tự động trước hành vi tấn công dò quét mật khẩu quản trị:
* **Mô phỏng tấn công:** Thực thi kịch bản kiểm thử tự động thông qua script `python scripts/simulate_bruteforce.py`. Kịch bản gửi liên tiếp 20 yêu cầu đăng nhập trong thời gian ngắn với các mật khẩu sai khác nhau nhắm vào tài khoản quản trị viên (`admin`) tại endpoint `https://localhost/api/auth/login`.
* **Phát hiện và Cảnh báo (Alert Firing):** Các lần đăng nhập sai làm tăng Prometheus metric `billing_user_logins_total{status="failed"}`. Quy tắc cảnh báo `BruteForceLoginDetected` trong `prometheus/alert.rules.yml` phát hiện số lần đăng nhập sai vượt ngưỡng 5 lần/phút và chuyển trạng thái cảnh báo sang `FIRING`.
* **Truy vết và Điều tra số (Forensics):** Sử dụng truy vấn LogQL trên Grafana Explore:
  `{container="billing-app"} |= "AUTH_LOGIN_FAILED"`
  Quản trị viên dễ dàng lọc ra toàn bộ các bản ghi bị từ chối, trích xuất chính xác địa chỉ IP nguồn tấn công, thời điểm xảy ra vụ việc và tài khoản bị nhắm tới.
* **Khắc phục và Ngăn chặn:** Cơ chế Rate Limiting tại Nginx (`zone=login_limit:10m rate=10r/m burst=3 nodelay; limit_req_status 429;`) ngay lập tức can thiệp. Kết quả thực nghiệm cho thấy từ yêu cầu thứ 5 trở đi, toàn bộ 16 yêu cầu tiếp theo bị Nginx chặn đứng hoàn toàn với mã HTTP `429 Too Many Requests`, bảo vệ ứng dụng Web và CSDL không bị quá tải.

---

### CHƯƠNG 4: CÁC BIỆN PHÁP HARDENING VÀ ĐÁNH GIÁ BẢO MẬT

#### 4.1. Áp dụng các biện pháp Hardening (Bước 6)
Nhằm gia cố an toàn thông tin toàn diện cho hệ thống theo các tiêu chuẩn công nghiệp (CIS Docker Benchmark & OWASP), 6 biện pháp hardening chuyên sâu đã được áp dụng và kiểm chứng qua script `scripts/hardening_evidence.ps1` (hoặc `.sh`):
1. **Phân tách mạng nội bộ (Network Isolation) & Cô lập CSDL:**
   - Hệ thống phân chia thành 3 Docker bridge networks biệt lập: `frontend-net` (mạng tiếp nhận bên ngoài), `backend-net` (mạng ứng dụng và cơ sở dữ liệu) và `monitoring-net` (mạng giám sát và log).
   - Cơ sở dữ liệu PostgreSQL 16 hoàn toàn **không publish cổng 5432 ra máy Host**, chỉ có `billing-app`, `postgres-exporter` và `pgadmin` nằm trong mạng `backend-net` mới có quyền kết nối.
2. **Quản lý mật khẩu mạnh và bảo vệ biến môi trường `.env`:**
   - Toàn bộ mật khẩu hệ thống (PostgreSQL, pgAdmin, Grafana, Token Secret) được thiết lập với độ phức tạp cao, lưu trữ độc lập trong tệp `.env`.
   - Tệp `.env` được khai báo trong `.gitignore` để không bị đẩy lên GitHub, đi kèm tệp mẫu `.env.example` không chứa mật khẩu thật. Trên môi trường Linux, tệp được phân quyền chặt chẽ `chmod 600 .env`.
3. **Hạn chế đặc quyền cơ sở dữ liệu (Least Privilege):**
   - Ứng dụng Web sử dụng tài khoản chuyên biệt `billing_user`.
   - Bộ trích xuất `postgres-exporter` kết nối tới CSDL bằng tài khoản đặc quyền tối thiểu `monitoring_user` với mật khẩu `Monitor_2026_ReadOnly99!`. Tài khoản này chỉ được cấp quyền đọc số liệu thống kê (`pg_monitor`) và quyền `SELECT` trên schema `public`, tuyệt đối bị cấm lệnh xóa bảng (`REVOKE CREATE`). Khi thử chạy lệnh `DROP TABLE customers`, CSDL từ chối thẳng thừng với lỗi `ERROR: must be owner of table customers`.
4. **Chạy container với quyền tối thiểu (Non-Root & No-New-Privileges):**
   - Container ứng dụng Web Node.js được đóng gói và chạy dưới tài khoản không có đặc quyền `appuser` (`UID 10001: GID 10001`). Prometheus chạy dưới quyền user `nobody` (`UID 65534`). Nếu kẻ tấn công chiếm quyền ứng dụng, chúng không thể thao túng máy chủ Host.
   - Toàn bộ 11 container được cấu hình cấm leo thang đặc quyền: `security_opt: - no-new-privileges:true`.
   - Thiết lập hạn ngạch tài nguyên nghiêm ngặt (`mem_limit` và `cpus`) cho từng container trong `docker-compose.yml` (ví dụ `mem_limit: 384m`, `cpus: 1.0` cho `billing-app`) chống hiện tượng cạn kiệt tài nguyên (OOM/DoS).
5. **Bảo mật Reverse Proxy Nginx & Security Headers:**
   - Ẩn hoàn toàn phiên bản máy chủ web (`server_tokens off`).
   - Cấu hình bắt buộc HTTPS với TLS 1.2 và 1.3, bộ mã hóa an toàn.
   - Áp dụng đầy đủ các Security Headers: HSTS, X-Frame-Options, X-Content-Type-Options, Content-Security-Policy (CSP), Permissions-Policy.
   - Áp dụng cơ chế Rate Limiting phân tầng: bảo vệ lưu lượng chung (15 req/s) và bảo vệ endpoint đăng nhập (10 req/min).
6. **Giám sát tài nguyên thời gian thực:**
   - Hệ thống theo dõi liên tục mức tiêu thụ CPU, RAM, Network I/O của toàn bộ 11 containers thông qua cAdvisor và lệnh `docker stats`, bảo đảm hệ thống vận hành ổn định lâu dài.

---

### KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN
Báo cáo đã trình bày quy trình triển khai hoàn chỉnh **Hệ thống Quản lý Hóa đơn & Thanh toán (Đề tài 18)** bằng Docker Compose gồm ứng dụng web Node.js Express MVC với đầy đủ chức năng quản lý khách hàng, lập hóa đơn GTGT, in hóa đơn PDF, ghi nhận thanh toán và phân quyền người dùng thực tế; cơ sở dữ liệu PostgreSQL 16 và Nginx Reverse Proxy với HTTPS cùng bộ Security Headers OWASP; giám sát toàn diện container, web server và CSDL bằng Prometheus và Grafana Dashboards tự động nạp; quản lý log tập trung bằng Loki, Promtail và các truy vấn LogQL chuyên sâu. Kịch bản mô phỏng tấn công dò mật khẩu (Brute-force) cho thấy chuỗi phát hiện, cảnh báo FIRING, truy vết log và chặn đứng bằng Nginx Rate Limiting (HTTP 429) hoạt động chính xác 100% theo thiết kế. Sáu biện pháp hardening đã được áp dụng và kiểm chứng qua kịch bản kiểm thử tự động đạt tỷ lệ 10/10 PASS.

**Hướng phát triển trong tương lai:**
* **Tự động hóa CI/CD:** Tích hợp pipeline kiểm thử tự động và tự động đóng gói image đẩy lên Docker Hub thông qua GitHub Actions.
* **Tăng cường an ninh nâng cao:** Tích hợp tường lửa ứng dụng web (WAF) ModSecurity và hệ thống giám sát an ninh container thời gian thực Falco.
* **Mở rộng cụm phân tán:** Chuyển đổi mô hình Docker Compose sang điều phối cụm Kubernetes (K8s) với khả năng tự động co giãn tài nguyên (Horizontal Pod Autoscaling) phục vụ doanh nghiệp quy mô lớn.

---

## PHỤ LỤC: HƯỚNG DẪN VẬN HÀNH VÀ TÀI KHOẢN QUẢN TRỊ TRÊN MÁY MỚI

**Trường Đại học Công nghệ Thông tin và Truyền thông - Khoa Công nghệ Thông tin - Bộ môn Hệ thống Thông tin & CNPM**
* **Đề tài 18:** Hệ thống Quản lý Hóa đơn & Thanh toán (Billing Management System)
* **Sinh viên thực hiện:** Vũ Hồng Dũng | **MSSV:** DTC245180068 | **Lớp:** KTPM K23B
* **Địa chỉ truy cập máy chủ:** `https://localhost` (hoặc IP máy ảo)

### PHẦN 1: BẢNG TỔNG HỢP CÁC ĐƯỜNG LINK & TÀI KHOẢN ĐĂNG NHẬP

#### Nhóm 1: Tài khoản Ứng dụng Web Quản lý Hóa đơn (Billing Web App)

| STT | Vai trò (Role) | Tên đăng nhập (Username) | Mật khẩu (Password) | Đối tượng / Họ tên | Quyền hạn & Chức năng thực tế |
|:---:|---|:---:|:---:|---|---|
| **1** | **Quản Trị Viên (ADMIN)** | **`admin`** | **`admin123`** | **Vũ Hồng Dũng**<br>*(Quản trị viên hệ thống)* | **Toàn quyền:** Quản lý danh mục khách hàng, lập hóa đơn mới, chỉnh sửa trạng thái hóa đơn, ghi nhận thanh toán, xem báo cáo doanh thu thực thu thời gian thực. |
| **2** | **Kế Toán Trưởng (ACCOUNTANT)** | **`ketoan1`** | **`123456`** | **Nguyễn Thu Hà**<br>*(Kế toán trưởng)* | **Nghiệp vụ tài chính:** Lập hóa đơn bán hàng/dịch vụ GTGT, tính thuế VAT, đối soát công nợ khách hàng, xuất in hóa đơn điện tử PDF. |
| **3** | **Khách Hàng 1 (CUSTOMER)** | **`khachhang1`** | **`123456`** | **Công ty TNHH Công nghệ Alpha Việt Nam** *(Mã: KH001)* | **Phân quyền khách hàng:** Đăng nhập chỉ xem danh sách hóa đơn của chính mình (**"Hóa đơn của tôi"**), tự tra cứu số tiền đã trả, in hóa đơn VAT, bảo mật tuyệt đối dữ liệu. |
| **4** | **Khách Hàng 2 (CUSTOMER)** | **`khachhang2`** | **`123456`** | **Tập đoàn Đầu tư & Thương mại Beta Group** *(Mã: KH002)* | **Phân quyền khách hàng:** Đăng nhập tra cứu danh sách hóa đơn dịch vụ của Beta Group, kiểm tra hạn nợ thanh toán. |

---

#### Nhóm 2: Tài khoản Quản trị Hệ thống, Giám sát & CSDL (DevOps & Database)

| STT | Hệ thống / Dịch vụ | Tên đăng nhập / Email | Mật khẩu | Phạm vi sử dụng & Ghi chú |
|:---:|---|:---:|:---:|---|
| **1** | **Grafana Dashboard & Loki** | **`admin`** | **`GrafanaAdmin_2026!#`** | Đăng nhập Grafana tại `http://localhost:3001`. Xem 3 Dashboards tự nạp sẵn và truy vấn LogQL trong Explore. |
| **2** | **pgAdmin 4 Web GUI** | **`admin@billing.com`** | **`AdminPass_2026!#`** | Đăng nhập giao diện quản trị CSDL tại `http://localhost:5050`. |
| **3** | **PostgreSQL App DB (Owner)** | **`billing_user`** | **`StrongBillingPass_2026!#`** | Kết nối CSDL `billing_db` bên trong pgAdmin hoặc kết nối của ứng dụng Web Node.js. |
| **4** | **PostgreSQL Least Privilege** | **`monitoring_user`** | **`Monitor_2026_ReadOnly99!`** | Tài khoản phân quyền tối thiểu dành riêng cho `postgres-exporter` (Chỉ có quyền `pg_monitor` & `SELECT`, cấm xóa bảng `DROP TABLE`). |
| **5** | **Prometheus Server** | *(Không yêu cầu)* | *(Mạng nội bộ)* | Truy cập trực tiếp tại `http://localhost:9090` để kiểm tra metrics và alert rules. |

---

#### Nhóm 3: Danh mục Cổng Dịch vụ và URL Truy cập Hệ thống (Web Endpoints)

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

### PHẦN 2: QUY TRÌNH TRIỂN KHAI VÀ KHỞI CHẠY TRÊN MÁY MỚI (TỪ A ĐẾN Z)
Khi chuyển toàn bộ hệ thống sang một máy tính hoặc máy ảo mới, hãy thực hiện tuần tự các bước sau:

* **Bước 1: Cài đặt Docker và Docker Compose (nếu chưa có)**
  - *Trên Ubuntu / Linux:*
    ```bash
    sudo apt update && sudo apt install -y docker.io docker-compose-v2 curl git python3
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
    newgrp docker
    ```
  - *Trên Windows:* Cài đặt **Docker Desktop** và đảm bảo Docker Engine đang chạy.

* **Bước 2: Di chuyển vào thư mục dự án (Clone từ GitHub hoặc giải nén ZIP)**
  ```bash
  # Cách 1: Clone từ GitHub
  git clone https://github.com/dtc245180068-droid/billing-management-system.git
  cd billing-management-system
  # Cách 2: Nếu có sẵn thư mục
  cd e:\Trienkhai_quantri_hethongpm
  ```

* **Bước 3: Thiết lập tệp cấu hình bảo mật `.env`**
  ```bash
  # Linux:
  cp .env.example .env
  chmod 600 .env

  # Windows PowerShell:
  Copy-Item .env.example .env
  ```

* **Bước 4: Sinh chứng chỉ số SSL tự ký cho Nginx HTTPS (nếu cần sinh lại)**
  ```bash
  # Linux:
  chmod +x nginx/ssl/generate-ssl.sh && ./nginx/ssl/generate-ssl.sh
  # Windows PowerShell:
  powershell -ExecutionPolicy Bypass -File nginx/ssl/generate-ssl.ps1
  ```

* **Bước 5: Khởi chạy toàn bộ hệ thống dịch vụ bằng Docker Compose**
  ```bash
  docker compose up -d --build
  docker compose ps  # Kiểm tra toàn bộ 11 container đều ở trạng thái Up hoặc healthy
  ```

* **Bước 6: Kiểm tra hồi quy toàn diện hệ thống (PASS 100%)**
  ```bash
  python scripts/check_regression.py
  ```

---

### PHẦN 3: CÁC LỆNH BẢO TRÌ & QUẢN TRỊ HỆ THỐNG THƯỜNG DÙNG

* **Xem trạng thái các container:**
  ```bash
  docker compose ps
  ```
* **Xem nhật ký log thời gian thực của ứng dụng web:**
  ```bash
  docker logs -f billing-app
  ```
* **Khởi động lại một container khi cập nhật cấu hình:**
  ```bash
  docker compose restart billing-app
  docker compose restart nginx
  ```
* **Chạy kịch bản mô phỏng tấn công Brute-force kiểm chứng Rate Limit Nginx:**
  ```bash
  python scripts/simulate_bruteforce.py
  ```
* **Chạy lệnh kiểm chứng 6 biện pháp Hardening phục vụ làm báo cáo:**
  - *Trên Linux:*
    ```bash
    chmod +x scripts/hardening_evidence.sh && ./scripts/hardening_evidence.sh
    ```
  - *Trên Windows PowerShell:*
    ```powershell
    powershell -ExecutionPolicy Bypass -File scripts/hardening_evidence.ps1
    ```
* **Tạm dừng hệ thống (vẫn bảo toàn nguyên vẹn CSDL):**
  ```bash
  docker compose stop
  ```
* **Bật lại hệ thống:**
  ```bash
  docker compose start
  ```
* **Dừng và giải phóng container (dữ liệu trong volumes vẫn được bảo vệ an toàn):**
  ```bash
  docker compose down
  ```

---

### PHẦN 4: HƯỚNG DẪN XỬ LÝ SỰ CỐ NHANH (TROUBLESHOOTING)

* **Sự cố 1: Grafana báo Unauthorized hoặc No Data:**
  - *Nguyên nhân:* Do đồng hồ máy tính/máy ảo bị lệch giờ (Clock drift).
  - *Khắc phục:* Chạy lệnh đồng bộ thời gian NTP trên máy chủ:
    ```bash
    sudo timedatectl set-ntp true && sudo systemctl restart systemd-timesyncd
    ```
* **Sự cố 2: Trình duyệt cảnh báo "Kết nối của bạn không an toàn":**
  - *Nguyên nhân:* Nginx sử dụng chứng chỉ số SSL tự ký (Self-signed Certificate). Đây là tính năng bảo mật hoàn toàn bình thường trong môi trường lab hoặc intranet.
  - *Khắc phục:* Nhấp vào nút **Nâng cao (Advanced)** trên trình duyệt -> Chọn **Tiếp tục truy cập localhost (Proceed to localhost)**.
* **Sự cố 3: Cổng 80 hoặc 443 bị báo "address already in use":**
  - *Nguyên nhân:* Đang có dịch vụ khác (ví dụ IIS, Apache hoặc Skype) chiếm cổng.
  - *Khắc phục:* Trong tệp `.env`, hệ thống đã cấu hình sẵn biến `HTTP_PORT=8080` để chuyển tiếp cổng 8080 tránh xung đột. Nếu cổng 443 bị chiếm, kiểm tra tiến trình bằng `netstat -ano | findstr :443` và tắt dịch vụ chiếm cổng.

---

### PHẦN BỔ SUNG: KHỞI ĐỘNG NHANH CONTAINER
Khi muốn khởi động nhanh hệ thống sau khi bật máy:
```bash
cd e:\Trienkhai_quantri_hethongpm
docker compose up -d
```
Mở trình duyệt truy cập: **`https://localhost`** và đăng nhập bằng tài khoản `admin / admin123` để bắt đầu quản trị!
