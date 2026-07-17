#!/bin/sh
# SeaweedFS single-node S3 for ECS media (replaces MinIO).
# Starts master+volume+filer+S3, then ensures the media bucket exists.
set -eu

DATA_DIR="${SEAWEED_DATA_DIR:-/data}"
S3_PORT="${SEAWEED_S3_PORT:-8333}"
FILER_PORT="${SEAWEED_FILER_PORT:-8888}"
BUCKET="${S3_BUCKET:-ecs-media}"
S3_CONFIG="${SEAWEED_S3_CONFIG:-/etc/seaweedfs/s3.json}"
ALLOWED_ORIGINS="${S3_ALLOWED_ORIGINS:-*}"

mkdir -p "$DATA_DIR"

# -ip must be a reachable hostname for master/volume gRPC (container name on compose network).
IP_NAME="${SEAWEED_IP:-seaweedfs}"

# shellcheck disable=SC2086
weed server \
  -dir="$DATA_DIR" \
  -ip="$IP_NAME" \
  -ip.bind=0.0.0.0 \
  -filer \
  -s3 \
  -s3.port="$S3_PORT" \
  -s3.config="$S3_CONFIG" \
  -s3.allowedOrigins="$ALLOWED_ORIGINS" \
  -filer.port="$FILER_PORT" \
  -volume.max=100 \
  &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# Wait for S3 + filer, then create the bucket path (Seaweed S3 buckets live under /buckets/).
i=0
while [ "$i" -lt 60 ]; do
  if wget -q -O /dev/null "http://127.0.0.1:${FILER_PORT}/" 2>/dev/null \
    && wget -q -O /dev/null "http://127.0.0.1:${S3_PORT}/" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

# Filer mkdir is idempotent enough for bootstrap (ignore failures if already present).
wget -q -O /dev/null --method=POST "http://127.0.0.1:${FILER_PORT}/buckets/" 2>/dev/null || true
wget -q -O /dev/null --method=POST "http://127.0.0.1:${FILER_PORT}/buckets/${BUCKET}/" 2>/dev/null || true

echo "seaweedfs ready: s3=:${S3_PORT} bucket=${BUCKET}"

wait "$SERVER_PID"
