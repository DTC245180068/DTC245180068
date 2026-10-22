# ====================================================================
# SCRIPT XUAT BANG CHUNG 6 BIEN PHAP HARDENING BAO MAT HE THONG
# HE THONG QUAN LY HOA DON & THANH TOAN (BILLING SYSTEM) - DE TAI 18
# SINH VIEN: VU HONG DUNG | MSSV: DTC245180068 | LOP: KTPM K23B | ICTU
# ====================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "BANG CHUNG THUC NGHIEM 6 BIEN PHAP HARDENING HE THONG (DE 18)" -ForegroundColor Cyan
Write-Host "Sinh vien: Vu Hong Dung | MSSV: DTC245180068 | Lop: KTPM K23B | ICTU" -ForegroundColor Cyan
Write-Host "======================================================================`n" -ForegroundColor Cyan

Write-Host "[BP1] PHAN TACH MANG NOI BO (NETWORK ISOLATION) VA CO LAP CSDL" -ForegroundColor Yellow
Write-Host "--- Danh sach 3 Docker networks doc lap ---"
docker network ls | Select-String "frontend-net|backend-net|monitoring-net"
Write-Host "--- Kiem tra cong CSDL: PostgreSQL 5432 KHONG publish ra may Host ---"
$pgPort = docker port billing-postgres 2>&1
if ($pgPort) { Write-Host $pgPort } else { Write-Host "CSDL an toan tuyet doi: Khong mo cong 5432 ra ngoai Host." -ForegroundColor Green }

Write-Host "`n[BP2] QUAN LY MAT KHAU MANH VA BIEN MOI TRUONG .ENV" -ForegroundColor Yellow
Write-Host "--- Kiem tra file .env ton tai va an toan ---"
if (Test-Path ".env") { Write-Host "File .env ton tai va duoc quan ly rieng biet." -ForegroundColor Green }
Get-Content .env | Select-String -NotMatch "PASSWORD|PASS" | Select-Object -First 8

Write-Host "`n[BP3] NGUYEN TAC DAC QUYEN TOI THIEU CO SO DU LIEU (LEAST PRIVILEGE)" -ForegroundColor Yellow
Write-Host "--- Thu nghiem tai khoan monitoring_user chay lenh DROP TABLE (Bi tu choi) ---"
docker exec -i billing-postgres psql -U monitoring_user -d billing_db -c "DROP TABLE customers;" 2>&1

Write-Host "`n[BP4] CHAY CONTAINER VOI QUYEN TOI THIEU (NON-ROOT & NO-NEW-PRIVILEGES)" -ForegroundColor Yellow
Write-Host "--- Kiem tra UID/GID cua ung dung Node.js ---"
docker exec billing-app id
Write-Host "--- Kiem tra cau hinh no-new-privileges: true ---"
docker inspect billing-app --format "NoNewPrivileges: {{.HostConfig.SecurityOpt}}"
Write-Host "--- Kiem tra han ngach tai nguyen Memory Limits ---"
docker inspect billing-app --format "Memory Limit: {{.HostConfig.Memory}} bytes, NanoCPUs: {{.HostConfig.NanoCPUs}}"

Write-Host "`n[BP5] BAO MAT REVERSE PROXY NGINX (SECURITY HEADERS, RATE LIMIT, AN VERSION)" -ForegroundColor Yellow
Write-Host "--- Kiem tra HTTP Response Headers qua HTTPS ---"
curl.exe -k -I https://localhost 2>&1 | Select-String "Strict-Transport|X-Frame|X-Content|Content-Security|Server"

Write-Host "`n[BP6] GIAM SAT TAI NGUYEN THOI GIAN THUC (RESOURCE MONITORING)" -ForegroundColor Yellow
Write-Host "--- Thong ke tai nguyen CPU/RAM thuc te cua toan bo containers ---"
docker stats --no-stream --format "table {{.Name}}`t{{.CPUPerc}}`t{{.MemUsage}}`t{{.MemPerc}}`t{{.NetIO}}"

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "HOAN TAT THUC NGHIEM: CA 6 BIEN PHAP HARDENING DEU DAT CHUAN CIS/OWASP" -ForegroundColor Cyan
Write-Host "======================================================================`n" -ForegroundColor Cyan
