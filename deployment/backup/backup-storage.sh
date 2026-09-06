#!/bin/sh
set -eu

backup_dir=/backups/attachments
interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$backup_dir"

until mc alias set business-storage "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo "[$(date -u +%FT%TZ)] waiting for attachment storage"
  sleep 5
done

while true; do
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  snapshot_dir="$backup_dir/$timestamp"
  mkdir -p "$snapshot_dir"

  if mc mirror --overwrite "business-storage/$MINIO_BUCKET" "$snapshot_dir"; then
    echo "[$(date -u +%FT%TZ)] attachment snapshot completed: $snapshot_dir"
    find "$backup_dir" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -exec rm -rf -- {} +
  else
    echo "[$(date -u +%FT%TZ)] attachment snapshot failed" >&2
  fi

  sleep "$interval_seconds"
done
