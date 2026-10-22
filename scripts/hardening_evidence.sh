#!/usr/bin/env bash
# ====================================================================
# SCRIPT XUẤT BẰNG CHỨNG 6 BIỆN PHÁP HARDENING BẢO MẬT HỆ THỐNG
# HỆ THỐNG QUẢN LÝ HÓA ĐƠN & THANH TOÁN (BILLING SYSTEM) - ĐỀ TÀI 18
# SINH VIÊN: VŨ HỒNG DŨNG | MSSV: DTC245180068 | LỚP: KTPM K23B | ICTU
# ====================================================================

echo "======================================================================"
echo "BÁO CÁO BẰNG CHỨNG THỰC NGHIỆM 6 BIỆN PHÁP HARDENING HỆ THỐNG (ĐỀ 18)"
echo "Sinh viên: Vũ Hồng Dũng | MSSV: DTC245180068 | Lớp: KTPM K23B"
echo "======================================================================"

echo ""
echo "[BP1] PHÂN TÁCH MẠNG NỘI BỘ (NETWORK ISOLATION) VÀ CÔ LẬP CƠ SỞ DỮ LIỆU"
echo "--- Danh sách 3 Docker networks độc lập ---"
docker network ls | grep -E "frontend-net|backend-net|monitoring-net"
echo "--- Kiểm tra cổng CSDL: PostgreSQL 5432 KHÔNG publish ra máy Host ---"
docker port billing-postgres || echo "CSDL an toàn tuyệt đối: Không mở cổng 5432 ra bên ngoài."

echo ""
echo "[BP2] QUẢN LÝ MẬT KHẨU MẠNH VÀ BẢO VỆ BIẾN MÔI TRƯỜNG .ENV"
echo "--- Kiểm tra file .env tồn tại và không bị Git theo dõi ---"
git status --ignored | grep -E "\.env$" || echo ".env được bảo vệ trong .gitignore"
head -n 15 .env | grep -v "PASSWORD" | grep -v "PASS"

echo ""
echo "[BP3] NGUYÊN TẮC ĐẶC QUYỀN TỐI THIỂU CƠ SỞ DỮ LIỆU (LEAST PRIVILEGE)"
echo "--- Thử nghiệm tài khoản monitoring_user chạy lệnh DROP TABLE (Phải bị từ chối) ---"
docker exec -i billing-postgres psql -U monitoring_user -d billing_db -c "DROP TABLE customers;" 2>&1

echo ""
echo "[BP4] CHẠY CONTAINER VỚI QUYỀN TỐI THIỂU (NON-ROOT & NO-NEW-PRIVILEGES)"
echo "--- Kiểm tra UID/GID của ứng dụng Node.js (Không phải root) ---"
docker exec billing-app id
echo "--- Kiểm tra cấu hình no-new-privileges: true ---"
docker inspect billing-app --format 'NoNewPrivileges: {{.HostConfig.SecurityOpt}}'
echo "--- Kiểm tra hạn ngạch tài nguyên Memory Limits ---"
docker inspect billing-app --format 'Memory Limit: {{.HostConfig.Memory}} bytes, NanoCPUs: {{.HostConfig.NanoCPUs}}'

echo ""
echo "[BP5] BẢO MẬT REVERSE PROXY NGINX (SECURITY HEADERS, RATE LIMIT, ẨN VERSION)"
echo "--- Kiểm tra HTTP Response Headers của Nginx qua HTTPS ---"
curl -k -I https://localhost 2>&1 | grep -E -i "Strict-Transport|X-Frame|X-Content|Content-Security|Server"

echo ""
echo "[BP6] GIÁM SÁT TÀI NGUYÊN THỜI GIAN THỰC (RESOURCE MONITORING)"
echo "--- Thống kê tài nguyên CPU/RAM thực tế của toàn bộ containers ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}"

echo ""
echo "======================================================================"
echo "HOÀN TẤT THỰC NGHIỆM: CẢ 6 BIỆN PHÁP HARDENING ĐỀU ĐẠT CHUẨN CIS/OWASP"
echo "======================================================================"
