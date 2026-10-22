#!/bin/bash
# ====================================================================
# Script tự động tạo chứng chỉ SSL tự ký RSA 2048-bit cho Nginx
# ====================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CERTS_DIR="$DIR/certs"
mkdir -p "$CERTS_DIR"

echo "Đang tạo chứng chỉ SSL tự ký RSA 2048-bit..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=VN/ST=HaNoi/L=HaNoi/O=BillingMaster/OU=IT/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:billing.local,IP:127.0.0.1"

# Đồng bộ sang ssl/ để tương thích
mkdir -p "$DIR/ssl"
cp "$CERTS_DIR/server.crt" "$DIR/ssl/cert.pem"
cp "$CERTS_DIR/server.key" "$DIR/ssl/key.pem"

chmod 600 "$CERTS_DIR/server.key" "$DIR/ssl/key.pem"
chmod 644 "$CERTS_DIR/server.crt" "$DIR/ssl/cert.pem"

echo "Tạo chứng chỉ SSL thành công!"
echo "Cert: $CERTS_DIR/server.crt"
echo "Key:  $CERTS_DIR/server.key"
