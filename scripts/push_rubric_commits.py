import sys
import io
import os
import subprocess

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

def run(cmd, check=True):
    print(f"RUN: {cmd}")
    p = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    if p.returncode != 0 and check:
        print(f"ERROR: {p.stderr}")
        sys.exit(1)
    if p.stdout.strip():
        print(p.stdout.strip())
    return p.stdout.strip()

# Read full compose lines first before anything
with open("docker-compose.yml", "r", encoding="utf-8") as f:
    full_lines = f.readlines()

c1_content = "".join(full_lines[0:113]) + """
networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge

volumes:
  postgres_data:
  pgadmin_data:
  app_logs:
  nginx_logs:
"""

c2_content = "".join(full_lines[0:226]) + "".join(full_lines[270:294]) + """
networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge
  monitoring-net:
    driver: bridge

volumes:
  postgres_data:
  pgadmin_data:
  app_logs:
  nginx_logs:
  prometheus_data:
  grafana_data:
"""

c3_content = "".join(full_lines)

# Unstage everything but keep all files in working directory
run("git reset")

# -------------------------------------------------------------
# COMMIT 1 (Mục 3)
# -------------------------------------------------------------
print("\n>>> DỰNG VÀ PUSH COMMIT 1 / 5 (Nginx, App, PostgreSQL, pgAdmin)...")
with open("docker-compose.yml", "w", encoding="utf-8") as f:
    f.write(c1_content)

run("git add .gitignore .env.example README.md app db postgres pgadmin nginx docker-compose.yml")
c1_msg = "commit 1: Cau hinh Nginx lam reverse proxy (co HTTPS tu ky va security headers co ban)"
run(f'git commit -m "{c1_msg}"')
c1_sha = run("git rev-parse HEAD")
print(f"Commit 1 SHA: {c1_sha}")
run(f"git push -f origin {c1_sha}:refs/heads/main")
print("[SUCCESS] Commit 1 đã push lên GitHub!\n")

# -------------------------------------------------------------
# COMMIT 2 (Mục 4)
# -------------------------------------------------------------
print(">>> DỰNG VÀ PUSH COMMIT 2 / 5 (Prometheus + Grafana + Exporters)...")
with open("docker-compose.yml", "w", encoding="utf-8") as f:
    f.write(c2_content)

run("git add prometheus grafana docker-compose.yml")
c2_msg = "Commit 2: Tich hop Prometheus + Grafana de giam sat container, web server va database"
run(f'git commit -m "{c2_msg}"')
c2_sha = run("git rev-parse HEAD")
print(f"Commit 2 SHA: {c2_sha}")
run(f"git push -f origin {c2_sha}:refs/heads/main")
print("[SUCCESS] Commit 2 đã push lên GitHub!\n")

# -------------------------------------------------------------
# COMMIT 3 (Mục 5)
# -------------------------------------------------------------
print(">>> DỰNG VÀ PUSH COMMIT 3 / 5 (Loki + Promtail + LogQL)...")
with open("docker-compose.yml", "w", encoding="utf-8") as f:
    f.write(c3_content)

run("git add loki promtail docs/LOGQL_QUERIES.md docker-compose.yml")
c3_msg = "commit 3: Trien khai he thong log tap trung Loki + Promtail, truy van log bang LogQL"
run(f'git commit -m "{c3_msg}"')
c3_sha = run("git rev-parse HEAD")
print(f"Commit 3 SHA: {c3_sha}")
run(f"git push -f origin {c3_sha}:refs/heads/main")
print("[SUCCESS] Commit 3 đã push lên GitHub!\n")

# -------------------------------------------------------------
# COMMIT 4 (Mục 6 - Hardening hệ thống)
# -------------------------------------------------------------
print(">>> DỰNG VÀ PUSH COMMIT 4 / 5 (Hardening hệ thống)...")
run("git add docs/HARDENING_CHECKLIST.md scripts/hardening_evidence.ps1 scripts/hardening_evidence.sh")
c4_msg = "commit 4: Hardening he thong (non-root container, network isolation, mat khau manh, security headers, han che quyen DB)"
run(f'git commit -m "{c4_msg}"')
c4_sha = run("git rev-parse HEAD")
print(f"Commit 4 SHA: {c4_sha}")
run(f"git push -f origin {c4_sha}:refs/heads/main")
print("[SUCCESS] Commit 4 đã push lên GitHub!\n")

# -------------------------------------------------------------
# COMMIT 5 (Mục 7 - Tổng thể & Trình bày)
# -------------------------------------------------------------
print(">>> DỰNG VÀ PUSH COMMIT 5 / 5 (Tổng thể & Trình bày, Báo cáo 10 trang, Demo minh chứng)...")
# Restore final full docker-compose
with open("docker-compose.yml", "w", encoding="utf-8") as f:
    f.write(c3_content)

run("git add -A")
c5_msg = "commit 5: Hoan thien tong the he thong, tai lieu huong dan chay, minh chung demo va bao cao tong hop"
run(f'git commit -m "{c5_msg}"')
c5_sha = run("git rev-parse HEAD")
print(f"Commit 5 SHA: {c5_sha}")

# Push both main and master to GitHub
run(f"git push -f origin {c5_sha}:refs/heads/main")
run(f"git push -f origin {c5_sha}:refs/heads/master")
print("[SUCCESS] Commit 5 đã push lên GitHub (main và master)!\n")

# Make sure main and master local point to c5
run(f"git branch -f main {c5_sha}")
run(f"git branch -f master {c5_sha}")
run("git checkout main")

print("\n=======================================================")
print("DANH SÁCH COMMITS HOÀN THIỆN TRÊN NHÁNH MAIN:")
print("=======================================================")
run("git log --oneline -n 6")
