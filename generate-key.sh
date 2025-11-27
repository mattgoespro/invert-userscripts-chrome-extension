#!/usr/bin/env bash
set -euo pipefail

OUT="key.pem"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$OUT" -quiet >>/dev/null
chmod 600 "$OUT"

# Extract public key in DER → base64 → no newlines
PUB=$(openssl rsa -in "$OUT" -pubout -outform DER 2>/dev/null | openssl base64 -A)

echo "Paste this into your manifest.json:"
echo "$PUB"
