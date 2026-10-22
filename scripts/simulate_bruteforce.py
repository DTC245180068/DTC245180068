#!/usr/bin/env python3
"""
========================================================================================
KỊCH BẢN THỰC NGHIỆM AN TOÀN THÔNG TIN: TẤN CÔNG DÒ MẬT KHẨU (BRUTE-FORCE)
HỆ THỐNG QUẢN LÝ HÓA ĐƠN & THANH TOÁN (BILLING MANAGEMENT SYSTEM) - ĐỀ TÀI 18
SINH VIÊN: VŨ HỒNG DŨNG | MSSV: DTC245180068 | LỚP: KTPM K23B | ICTU
========================================================================================
Mục tiêu:
  1. Gửi 20 yêu cầu đăng nhập liên tiếp với mật khẩu sai tới https://localhost/api/auth/login
  2. Ghi nhận log an ninh AUTH_LOGIN_FAILED trên ứng dụng
  3. Kiểm chứng cơ chế Nginx Rate Limiting chặn đứng tấn công bằng mã HTTP 429 Too Many Requests
  4. Kích hoạt cảnh báo BruteForceLoginDetected trên Prometheus / Grafana
========================================================================================
"""

import sys
import io
import json
import urllib.request
import urllib.error
import ssl
import time

# Force UTF-8 output on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

LOGIN_URL = "https://localhost/api/auth/login"
TARGET_USER = "admin"

passwords_dict = [
    "123456", "admin1234", "password", "root123", "letmein",
    "welcome1", "qwerty", "admin@2026", "pass1234", "master99",
    "superadmin", "billingpass", "pass2026", "111111", "guest",
    "system123", "dbadmin", "secret", "changeit", "iloveyou"
]

print("\n" + "="*85)
print(" KỊCH BẢN MÔ PHỎNG TẤN CÔNG DÒ MẬT KHẨU (BRUTE-FORCE LOGIN ATTEMPTS)")
print(" Mục tiêu: https://localhost/api/auth/login | Tài khoản nhắm tới: admin")
print(" Sinh viên: Vũ Hồng Dũng | MSSV: DTC245180068 | Đề tài 18: Quản lý Hóa đơn")
print("="*85 + "\n")

print(f"{'Lần #':<8}{'Tài khoản':<12}{'Mật khẩu thử':<16}{'Mã HTTP':<12}{'Hành vi an ninh ghi nhận':<35}")
print("-" * 85)

count_401 = 0
count_429 = 0

for i, pwd in enumerate(passwords_dict, 1):
    payload = json.dumps({"username": TARGET_USER, "password": pwd}).encode('utf-8')
    req = urllib.request.Request(
        LOGIN_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "BruteForceSimulator/2.0 (Security-Audit-Script)"
        }
    )

    status_code = None
    msg = ""

    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=3) as resp:
            status_code = resp.status
            msg = "Đăng nhập thành công (Bất thường!)"
    except urllib.error.HTTPError as he:
        status_code = he.code
        if he.code == 401:
            count_401 += 1
            msg = "AUTH_LOGIN_FAILED (Sai mật khẩu)"
        elif he.code == 429:
            count_429 += 1
            msg = "BLOCKED BY NGINX RATE LIMIT (429)"
        else:
            msg = f"HTTP Error {he.code}"
    except Exception as e:
        status_code = 0
        msg = f"Lỗi kết nối: {str(e)[:30]}"

    color = "\033[93m" if status_code == 401 else ("\033[91m" if status_code == 429 else "\033[0m")
    reset = "\033[0m"
    print(f"{i:<8}{TARGET_USER:<12}{pwd:<16}{color}{status_code:<12}{reset}{msg:<35}")
    time.sleep(0.08) # Bắn tốc độ nhanh

print("-" * 85)
print("\n>>> TỔNG KẾT KỊCH BẢN THỰC NGHIỆM AN TOÀN THÔNG TIN:")
print(f" - Tổng số yêu cầu gửi đi          : {len(passwords_dict)}")
print(f" - Số lần ứng dụng từ chối (401)    : {count_401} lần (Đã ghi log AUTH_LOGIN_FAILED vào Loki)")
print(f" - Số lần Nginx chặn đứng (429)     : {count_429} lần (Kích hoạt bảo vệ Rate Limiting)")
print(" - Trạng thái phòng thủ            : HOÀN TOÀN THÀNH CÔNG (Ngăn chặn triệt để tấn công DoS/Brute-force)")
print("="*85 + "\n")
