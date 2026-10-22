# ====================================================================
# SSL SELF-SIGNED CERTIFICATE GENERATOR (POWERSHELL)
# ====================================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$opensslPath = "openssl"
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\Git\usr\bin\openssl.exe") {
        $opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
    } else {
        Write-Error "OpenSSL not found. Please install OpenSSL or Git for Windows."
        exit 1
    }
}

Write-Host "Generating Self-Signed SSL Certificate using $opensslPath..." -ForegroundColor Cyan

& $opensslPath req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout "$scriptDir\key.pem" `
  -out "$scriptDir\cert.pem" `
  -subj "/C=VN/ST=HaNoi/L=HaNoi/O=BillingMaster/OU=IT/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,DNS:billing.local,IP:127.0.0.1"

Write-Host "SSL certificate generation finished!" -ForegroundColor Green
Write-Host "Cert: $scriptDir\cert.pem"
Write-Host "Key:  $scriptDir\key.pem"
