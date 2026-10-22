#!/bin/bash
# ====================================================================
# SSL SELF-SIGNED CERTIFICATE GENERATOR FOR NGINX REVERSE PROXY
# ====================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Generating 2048-bit RSA Private Key and Self-Signed Certificate..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$DIR/key.pem" \
  -out "$DIR/cert.pem" \
  -subj "/C=VN/ST=HaNoi/L=HaNoi/O=BillingMaster/OU=IT/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:billing.local,IP:127.0.0.1"

chmod 600 "$DIR/key.pem"
chmod 644 "$DIR/cert.pem"

echo "Certificate generation completed successfully!"
echo "Cert: $DIR/cert.pem"
echo "Key:  $DIR/key.pem"
