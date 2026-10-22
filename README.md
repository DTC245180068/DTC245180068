# ĐỀ 18: HỆ THỐNG QUẢN LÝ HÓA ĐƠN & THANH TOÁN (BILLING MANAGEMENT SYSTEM)
### Môn học: Triển khai và Quản trị Hệ thống Phần mềm
**Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) - Khoa Công nghệ Thông tin**
* **Sinh viên thực hiện:** Vũ Hồng Dũng
* **Mã số sinh viên (MSSV):** DTC245180068
* **Lớp / Khóa:** KTPM K23B

[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Nginx](https://img.shields.io/badge/Nginx-Reverse_Proxy_SSL-009639?logo=nginx&logoColor=white)](https://nginx.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Alpine-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Monitoring-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-Dashboards-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![Loki](https://img.shields.io/badge/Loki-Centralized_Logs-FF7800)](https://grafana.com/oss/loki/)
[![Hardening](https://img.shields.io/badge/Security-Hardened_CIS-success)](docs/HARDENING_CHECKLIST.md)

---

## 1. Giới thiệu Dự án

Dự án triển khai một hệ sinh thái hoàn chỉnh cho **Đề 18: Hệ thống Quản lý Hóa đơn / Billing** với đầy đủ các thành phần theo tiêu chuẩn DevOps & Quản trị hệ thống hiện đại, sẵn sàng vận hành thực tế 100%:
- **Phần mềm triển khai:** Ứng dụng web Quản lý Hóa đơn, Khách hàng, Thanh toán, In ấn hóa đơn VAT và Bảng điều khiển tài chính (Node.js/Express MVC, Bootstrap 5, Chart.js), tích hợp hệ thống xác thực người dùng phân quyền (`ADMIN`, `ACCOUNTANT`, `CUSTOMER`).
- **Cơ sở dữ liệu:** PostgreSQL 16 Alpine với 5 bảng thực thể chuẩn hóa (`users`, `customers`, `invoices`, `invoice_items`, `payments`), tài khoản đặc quyền tối thiểu (`monitoring_user`) + công cụ quản trị trực quan pgAdmin 4.
- **Reverse Proxy:** Nginx cấu hình SSL tự ký RSA 2048-bit (HTTPS), tự động chuyển hướng HTTP sang HTTPS, tích hợp bộ Security Headers chuẩn OWASP và Rate Limiting chống DoS / Brute-force.
- **Giám sát (Monitoring):** Cụm Prometheus + Grafana với các dashboards tự động nạp sẵn cho Container, Web Server, Cơ sở dữ liệu và Chỉ số Kinh doanh (Business Metrics doanh thu live, phân bổ hóa đơn).
- **Gom Log tập trung (Centralized Logging):** Loki + Promtail thu thập log có cấu trúc JSON, hỗ trợ truy vấn LogQL chuyên sâu và điều tra an toàn thông tin.
- **Làm cứng hệ thống (Hardening):** Non-root container (UID 10001), phân tách mạng 3 lớp (`frontend-net`, `backend-net`, `monitoring-net`), giới hạn tài nguyên (CPU/RAM limits), cấm leo thang đặc quyền (`no-new-privileges: true`).

---

## 2. Kiến trúc Tổng thể Hệ thống

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

---

## 3. Cấu trúc Thư mục Dự án

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

## 4. Danh mục Dịch vụ, Cổng & Tài khoản Đăng nhập

| Dịch vụ | Tên Container | Cổng Host | Tài khoản / Mật khẩu mặc định | Mô tả chức năng |
|---|---|---|---|---|
| **Website Hóa đơn (Admin)** | `billing-nginx` | **443** (HTTPS)<br>**8080** (HTTP) | User: `admin`<br>Pass: `admin123` | **Quản Trị Viên (Vũ Hồng Dũng):** Toàn quyền lập hóa đơn, thu tiền, xem doanh thu live |
| **Website Hóa đơn (Kế toán)** | `billing-nginx` | **443** (HTTPS) | User: `ketoan1`<br>Pass: `123456` | **Kế Toán Trưởng:** Lập hóa đơn GTGT, đối soát công nợ, in ấn hóa đơn tài chính |
| **Website Hóa đơn (Khách 1)** | `billing-nginx` | **443** (HTTPS) | User: `khachhang1`<br>Pass: `123456` | **Khách hàng đối tác:** Công ty Alpha Tech (KH001). Xem hóa đơn của tôi, in PDF |
| **Website Hóa đơn (Khách 2)** | `billing-nginx` | **443** (HTTPS) | User: `khachhang2`<br>Pass: `123456` | **Khách hàng đối tác:** Tập đoàn Beta Group (KH002). Xem hóa đơn của tôi, đối soát |
| **PostgreSQL Database** | `billing-postgres` | *Nội bộ: 5432* | User: `billing_user`<br>Pass: `StrongBillingPass_2026!#`<br>DB: `billing_db` | CSDL quan hệ (Cách ly trong `backend-net`, không mở cổng ra ngoài) |
| **PostgreSQL (Least Privilege)** | `billing-postgres` | *Nội bộ: 5432* | User: `monitoring_user`<br>Pass: `Monitor_2026_ReadOnly99!` | Tài khoản chỉ đọc cho exporter (Quyền `pg_monitor`, cấm `DROP TABLE`) |
| **pgAdmin 4** | `billing-pgadmin` | **5050** | Email: `admin@billing.com`<br>Pass: `AdminPass_2026!#` | Giao diện đồ họa quản trị CSDL PostgreSQL 16 |
| **Prometheus TSDB** | `billing-prometheus` | **9090** | *Không yêu cầu đăng nhập* | Thu thập metrics, giám sát 5 targets UP và quản lý alert rules |
| **Grafana Dashboards** | `billing-grafana` | **3001** | User: `admin`<br>Pass: `GrafanaAdmin_2026!#` | Trực quan hóa 3 Dashboards: Billing Overview, Containers, PostgreSQL |
| **Grafana Loki** | `billing-loki` | **3100** | *API nội bộ* | Máy chủ lưu trữ và lập chỉ mục log tập trung |
| **Promtail** | `billing-promtail` | *Nội bộ: 9080* | *Daemon* | Agent đọc log Nginx, App và đẩy về Loki |
| **Postgres Exporter** | `billing-postgres-exporter` | *Nội bộ: 9187* | *Prometheus scrape* | Trích xuất metrics PostgreSQL bằng user `monitoring_user` |
| **Nginx Exporter** | `billing-nginx-exporter` | *Nội bộ: 9113* | *Prometheus scrape* | Trích xuất metrics HTTP Nginx từ `/nginx_status` |
| **cAdvisor** | `billing-cadvisor` | *Nội bộ: 8080* | *Prometheus scrape* | Giám sát CPU/RAM/Network từng container thời gian thực |

---

## 5. Hướng dẫn Khởi chạy Nhanh

### Yêu cầu tiên quyết:
- Đã cài đặt **Docker** và **Docker Compose v2+** (hoặc Docker Desktop trên Windows).
- Đã cài đặt **Python 3** (phục vụ chạy test tự động).

### Các bước khởi chạy:

#### Bước 1: Di chuyển vào thư mục dự án
```bash
cd e:\Trienkhai_quantri_hethongpm
```

#### Bước 2: Thiết lập tệp cấu hình môi trường `.env`
Tệp `.env` đã được cấu hình sẵn trong kho mã nguồn. Nếu cần sinh lại:
```powershell
# Windows PowerShell:
Copy-Item .env.example .env

# Linux:
cp .env.example .env && chmod 600 .env
```

#### Bước 3: Khởi chạy toàn bộ hệ thống bằng Docker Compose
```bash
docker compose up -d --build
```

#### Bước 4: Kiểm tra trạng thái hoạt động của các container
```bash
docker compose ps
```
*Tất cả 11 container cần hiển thị trạng thái `running` hoặc `healthy`.*

#### Bước 5: Chạy kịch bản kiểm tra hồi quy tự động (PASS 100%)
```bash
python scripts/check_regression.py
```
*Kết quả sẽ hiển thị 10/10 tests PASS hoàn hảo.*

---

## 6. Hướng dẫn Kiểm thử & Trải nghiệm (Demo Walkthrough)

### 1. Trải nghiệm Website Quản lý Hóa đơn
- Mở trình duyệt và truy cập: **`https://localhost`**
  *(Lưu ý: Do sử dụng chứng chỉ SSL tự ký, trình duyệt sẽ cảnh báo "Kết nối của bạn không an toàn" -> Nhấp **Advanced (Nâng cao)** -> Chọn **Proceed to localhost (Tiếp tục truy cập)**)*.
- **Tính năng đăng nhập phân quyền:**
  - Bấm **Đăng nhập** (hoặc vào `/login`), chọn nút điền nhanh tài khoản:
    - `admin / admin123`: Vào Bảng điều khiển quản trị, lập hóa đơn mới, quản lý khách hàng, ghi nhận thanh toán.
    - `khachhang1 / 123456`: Vào phân hệ khách hàng Alpha Tech, xem danh sách hóa đơn của tôi, in hóa đơn VAT.
- **Nghiệp vụ cốt lõi:**
  1. **Bảng điều khiển (Dashboard):** Xem doanh thu thực thu, tiền chờ thanh toán, biểu đồ trạng thái hóa đơn.
  2. **Lập Hóa đơn Mới:** Thêm khách hàng, thêm dòng hàng hóa dịch vụ động, tự động tính tiền hàng, thuế GTGT (8%, 10%), chiết khấu và tổng thanh toán.
  3. **Xem Chi tiết & In Hóa đơn:** Định dạng chuẩn hóa đơn GTGT, nhấp nút **"In hóa đơn (PDF)"** để xuất hóa đơn in ấn chuyên nghiệp.
  4. **Quản lý Khách hàng:** Xem hồ sơ đối tác, mã số thuế, thêm khách hàng mới.
  5. **Quản lý Thanh toán:** Ghi nhận tiền thu cho hóa đơn, tự động chuyển trạng thái sang `PAID` khi thanh toán đủ.
  6. **Endpoint Health & Metrics:**
     - Health check JSON: `https://localhost/api/health`
     - Prometheus Scrape: `https://localhost/metrics`

### 2. Kịch bản Thực nghiệm An toàn Thông tin: Mô phỏng Tấn công Brute-Force
Chạy kịch bản mô phỏng gửi 20 yêu cầu sai mật khẩu liên tiếp:
```bash
python scripts/simulate_bruteforce.py
```
- Các yêu cầu đầu tiên bị ứng dụng từ chối với HTTP `401 Unauthorized` và ghi log `AUTH_LOGIN_FAILED`.
- Khi vượt ngưỡng, Nginx Rate Limiting can thiệp chặn đứng các yêu cầu tiếp theo với HTTP `429 Too Many Requests`.
- Quy tắc cảnh báo `BruteForceLoginDetected` trên Prometheus (`http://localhost:9090/alerts`) chuyển sang trạng thái `FIRING`.

### 3. Giám sát Hệ thống với Prometheus & Grafana
- **Prometheus UI:** Truy cập `http://localhost:9090` -> Vào menu **Status** -> **Targets** để kiểm tra cả 5 targets đều hiển thị màu xanh **UP (1/1)**.
- **Grafana Dashboards:** Truy cập `http://localhost:3001` (User: `admin` / Pass: `GrafanaAdmin_2026!#`)
  1. *Billing System - Executive & Performance Overview:* Doanh thu thực thu, tổng hóa đơn, HTTP latency p50/p95, request rate.
  2. *Docker Containers Resource Monitoring:* Mức tiêu thụ CPU %, RAM bytes, Network RX/TX từng container.
  3. *PostgreSQL Database Performance Monitoring:* Số kết nối hoạt động, giao dịch commit/s, tỷ lệ cache hit.

### 4. Quản trị Log Tập Trung với Loki & LogQL
- Truy cập Grafana: `http://localhost:3001` -> Nhấp **Explore** (la bàn) -> Chọn Datasource **Loki**.
- Thực hiện các câu truy vấn LogQL mẫu:
  - Xem log đăng nhập thất bại:
    ```logql
    {container="billing-app"} |= "AUTH_LOGIN_FAILED"
    ```
  - Xem log sự kiện tạo hóa đơn & thanh toán:
    ```logql
    {container="billing-app"} |~ "(Created new invoice|Recorded payment)"
    ```
  - Xem log lỗi HTTP qua Nginx:
    ```logql
    {container="billing-nginx"} | json | status >= 400
    ```

### 5. Xuất Bằng chứng 6 Biện pháp Hardening Bảo mật
- **Trên Windows PowerShell:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/hardening_evidence.ps1
  ```
- **Trên Linux:**
  ```bash
  chmod +x scripts/hardening_evidence.sh && ./scripts/hardening_evidence.sh
  ```

---

## 7. Lịch sử Commit Tuân thủ Yêu cầu Đề Bài

Kho mã nguồn được tổ chức và commit tuần tự theo từng giai đoạn phát triển chính xác theo đề bài yêu cầu:

1. **Commit 1:** `commit 1: Cau hinh Nginx lam reverse proxy (co HTTPS tu ky va security headers co ban)`
   - Xây dựng ứng dụng Web Quản lý Hóa đơn (Node.js/Express MVC, EJS, Controllers, REST API, Auth).
   - Thiết kế CSDL PostgreSQL và script khởi tạo `init.sql`.
   - Cấu hình pgAdmin 4 tự động kết nối qua `servers.json`.
   - Cấu hình Nginx reverse proxy với HTTPS tự ký (RSA 2048-bit), HTTP->HTTPS redirect, security headers và rate limiting.
2. **Commit 2:** `Commit 2: Tich hop Prometheus + Grafana de giam sat container, web server va database`
   - Cấu hình máy chủ Prometheus thu thập metrics hệ thống, container, web app và database.
   - Tích hợp các Exporters: `postgres-exporter` (dùng tài khoản least privilege `monitoring_user`), `nginx-exporter`, `cadvisor`.
   - Thiết lập Grafana tự động nạp Datasource và 3 bộ Dashboard chuyên sâu.
3. **Commit 3:** `commit 3: Trien khai he thong log tap trung Loki + Promtail, truy van log bang LogQL`
   - Triển khai cụm Grafana Loki lưu trữ nhật ký tập trung.
   - Cấu hình Promtail daemon đọc log Nginx, log ứng dụng JSON và log container Docker.
   - Tài liệu hướng dẫn truy vấn LogQL với 5 câu truy vấn chi tiết.
4. **Commit 4:** `docs & security: apply container hardening, complete documentation and full 10-page project report`
   - Hoàn thiện làm cứng hệ thống: non-root container, network isolation, least privilege DB, resource limits.
   - Biên soạn Báo cáo tổng hợp môn học định dạng học thuật chuẩn tại [`docs/BAO_CAO_TONG_HOP.md`](docs/BAO_CAO_TONG_HOP.md).

---

## 8. Tài liệu Báo cáo Chi tiết
Vui lòng xem báo cáo đầy đủ tại: **[`docs/BAO_CAO_TONG_HOP.md`](docs/BAO_CAO_TONG_HOP.md)**.
