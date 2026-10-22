import base64
import re
import sys
import os

md_path = os.path.join(os.path.dirname(__file__), '..', 'docs', 'BAO_CAO_TONG_HOP.md')
html_path = os.path.join(os.path.dirname(__file__), '..', 'docs', 'view_report.html')

with open(md_path, 'r', encoding='utf-8') as f:
    md_content = f.read()

b64_str = base64.b64encode(md_content.encode('utf-8')).decode('ascii')

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

pattern = r'const embeddedB64 = "[^"]*";'
replacement = f'const embeddedB64 = "{b64_str}";'

new_html = re.sub(pattern, replacement, html_content)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print(f"Updated view_report.html successfully! Base64 payload size: {len(b64_str)} bytes.")
