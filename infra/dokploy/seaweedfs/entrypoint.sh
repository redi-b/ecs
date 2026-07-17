#!/bin/sh
# Production SeaweedFS S3 bootstrap for Dokploy.
# Writes s3 identity config from env, starts weed server, ensures bucket exists.
set -eu

DATA_DIR="${SEAWEED_DATA_DIR:-/data}"
S3_PORT="${SEAWEED_S3_PORT:-8333}"
FILER_PORT="${SEAWEED_FILER_PORT:-8888}"
BUCKET="${MEDIA_S3_BUCKET:-${S3_BUCKET:-ecs-media}}"
ACCESS_KEY="${MEDIA_S3_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-ecs}}"
SECRET_KEY="${MEDIA_S3_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:?set MEDIA_S3_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY}}"
ALLOWED_ORIGINS="${MEDIA_S3_CORS_ALLOW_ORIGIN:-*}"
CONFIG_PATH="/etc/seaweedfs/s3.json"

mkdir -p "$DATA_DIR" /etc/seaweedfs

# Escape JSON string values (minimal).
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

ACCESS_ESC=$(json_escape "$ACCESS_KEY")
SECRET_ESC=$(json_escape "$SECRET_KEY")
ORIGINS_ESC=$(json_escape "$ALLOWED_ORIGINS")

cat > "$CONFIG_PATH" <<EOF
{
  "identities": [
    {
      "name": "anonymous",
      "actions": ["Read", "List"]
    },
    {
      "name": "ecs",
      "credentials": [
        {
          "accessKey": "${ACCESS_ESC}",
          "secretKey": "${SECRET_ESC}"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
EOF

# -ip must be a reachable hostname for master/volume gRPC (compose service name).
IP_NAME="${SEAWEED_IP:-seaweedfs}"

weed server \
  -dir="$DATA_DIR" \
  -ip="$IP_NAME" \
  -ip.bind=0.0.0.0 \
  -filer \
  -s3 \
  -s3.port="$S3_PORT" \
  -s3.config="$CONFIG_PATH" \
  -s3.allowedOrigins="$ORIGINS_ESC" \
  -filer.port="$FILER_PORT" \
  -volume.max=100 \
  &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup INT TERM

i=0
while [ "$i" -lt 90 ]; do
  if wget -q -O /dev/null "http://127.0.0.1:${FILER_PORT}/" 2>/dev/null \
    && wget -q -O /dev/null "http://127.0.0.1:${S3_PORT}/" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

wget -q -O /dev/null --method=POST "http://127.0.0.1:${FILER_PORT}/buckets/" 2>/dev/null || true
wget -q -O /dev/null --method=POST "http://127.0.0.1:${FILER_PORT}/buckets/${BUCKET}/" 2>/dev/null || true

echo "seaweedfs ready: s3=:${S3_PORT} bucket=${BUCKET}"

wait "$SERVER_PID"
