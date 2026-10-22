#!/usr/bin/env python3
import urllib.request
import ssl
import json
import http.cookiejar
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

def parse_table_invoices(html):
    table_match = re.search(r'<table[^>]*id=["\']invoices-table["\'][^>]*>(.*?)</table>', html, re.DOTALL)
    if not table_match:
        return []
    table_html = table_match.group(1)
    return list(dict.fromkeys(re.findall(r'INV-2026-\d{4}', table_html)))

# 1. Admin
admin_cj = http.cookiejar.CookieJar()
admin_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx), urllib.request.HTTPCookieProcessor(admin_cj))
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
admin_opener.open(urllib.request.Request('https://localhost/api/auth/login', data=data, headers={'Content-Type': 'application/json'}))
html_admin = admin_opener.open('https://localhost/invoices?status=SENT').read().decode()
admin_invs = parse_table_invoices(html_admin)
print('ADMIN /invoices?status=SENT ->', admin_invs, f'(Tổng cộng: {len(admin_invs)} hóa đơn)')

# 2. Cust 1
c1_cj = http.cookiejar.CookieJar()
c1_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx), urllib.request.HTTPCookieProcessor(c1_cj))
data = json.dumps({'username': 'khachhang1', 'password': '123456'}).encode()
c1_opener.open(urllib.request.Request('https://localhost/api/auth/login', data=data, headers={'Content-Type': 'application/json'}))
html_c1 = c1_opener.open('https://localhost/portal?u=khachhang1&status=SENT').read().decode()
c1_invs = parse_table_invoices(html_c1)
print('CUSTOMER 1 /portal?u=khachhang1&status=SENT ->', c1_invs, f'(Tổng cộng: {len(c1_invs)} hóa đơn)')

# 3. Cust 2
c2_cj = http.cookiejar.CookieJar()
c2_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx), urllib.request.HTTPCookieProcessor(c2_cj))
data = json.dumps({'username': 'khachhang2', 'password': '123456'}).encode()
c2_opener.open(urllib.request.Request('https://localhost/api/auth/login', data=data, headers={'Content-Type': 'application/json'}))
html_c2 = c2_opener.open('https://localhost/portal?u=khachhang2&status=SENT').read().decode()
c2_invs = parse_table_invoices(html_c2)
print('CUSTOMER 2 /portal?u=khachhang2&status=SENT ->', c2_invs, f'(Tổng cộng: {len(c2_invs)} hóa đơn)')

assert admin_invs == ['INV-2026-0014', 'INV-2026-0013', 'INV-2026-0011'], f'Unexpected admin invoices: {admin_invs}'
assert c1_invs == ['INV-2026-0014', 'INV-2026-0013'], f'Unexpected c1 invoices: {c1_invs}'
assert c2_invs == ['INV-2026-0011'], f'Unexpected c2 invoices: {c2_invs}'
assert len(c1_invs) + len(c2_invs) == len(admin_invs), 'Sum of customer invoices must equal admin invoices'

print('\n' + '=' * 75)
print(' KẾT QUẢ: 100% TRÙNG KHỚP TUYỆT ĐỐI!')
print(' - Admin có đúng 3 hóa đơn chờ thanh toán: INV-2026-0014, INV-2026-0013, INV-2026-0011')
print(' - Khách hàng 1 có đúng 2 hóa đơn: INV-2026-0014, INV-2026-0013')
print(' - Khách hàng 2 có đúng 1 hóa đơn: INV-2026-0011')
print(' - 2 + 1 = 3 hóa đơn, không còn bất kỳ hóa đơn rác nào!')
print('=' * 75)
