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

# Unstage everything first
run("git reset")

# -------------------------------------------------------------
# STEP 1: COMMIT 1
# -------------------------------------------------------------
print("\n>>> PREPARING AND PUSHING COMMIT 1 / 3...")
# Use Commit 1 compose
with open("docker-compose.c1.tmp", "r", encoding="utf-8") as f:
    c1_content = f.read()

with open("docker-compose.yml", "w", encoding="utf-8") as f:
    f.write(c1_content)

run("git add .gitignore .env.example README.md app db postgres pgadmin nginx docker-compose.yml")

c1_msg = "commit 1: Cau hinh Nginx lam reverse proxy (co HTTPS tu ky va security headers co ban)"
run(f'git commit -m "{c1_msg}"')
c1_sha = run("git rev-parse HEAD")
print(f"Commit 1 SHA: {c1_sha}")

print(">>> Pushing Commit 1 to GitHub (origin main)...")
run(f"git push -f origin {c1_sha}:refs/heads/main")
print(" [SUCCESS] Push Commit 1 completed!\n")

# -------------------------------------------------------------
# STEP 2: COMMIT 2
# -------------------------------------------------------------
print(">>> PREPARING AND PUSHING COMMIT 2 / 3...")
with open("docker-compose.c2.tmp", "r", encoding="utf-8") as f:
    c2_content = f.read()

with open("docker-compose.yml", "w", encoding="utf-8") as f:
    f.write(c2_content)

run("git add prometheus grafana docker-compose.yml")

c2_msg = "Commit 2: Tich hop Prometheus + Grafana de giam sat container, web server va database"
run(f'git commit -m "{c2_msg}"')
c2_sha = run("git rev-parse HEAD")
print(f"Commit 2 SHA: {c2_sha}")

print(">>> Pushing Commit 2 to GitHub (origin main)...")
run(f"git push -f origin {c2_sha}:refs/heads/main")
print(" [SUCCESS] Push Commit 2 completed!\n")

# -------------------------------------------------------------
# STEP 3: COMMIT 3
# -------------------------------------------------------------
print(">>> PREPARING AND PUSHING COMMIT 3 / 3...")
run("git checkout backup-master-full -- docker-compose.yml")

if os.path.exists("docker-compose.c1.tmp"):
    os.remove("docker-compose.c1.tmp")
if os.path.exists("docker-compose.c2.tmp"):
    os.remove("docker-compose.c2.tmp")

run("git add loki promtail docs BANG_TAI_KHOAN_DANG_NHAP.md scripts docker-compose.yml")

c3_msg = "commit 3: Trien khai he thong log tap trung Loki + Promtail, truy van log bang LogQL"
run(f'git commit -m "{c3_msg}"')
c3_sha = run("git rev-parse HEAD")
print(f"Commit 3 SHA: {c3_sha}")

print(">>> Pushing Commit 3 to GitHub (origin main and origin master)...")
run(f"git push -f origin {c3_sha}:refs/heads/main")
run(f"git push -f origin {c3_sha}:refs/heads/master")
print(" [SUCCESS] Push Commit 3 completed!\n")

# Verify final status
diff_out = run("git diff backup-master-full HEAD")
if not diff_out.strip():
    print("VERIFIED: Commit 3 codebase matches 100% with completed work!")
else:
    print("DIFF:", diff_out[:300])

print("\nCOMMITS ON BRANCH MAIN:")
run("git log --oneline -n 5")
