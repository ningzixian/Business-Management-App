#!/bin/sh
set -eu

backup_dir=/backups/database
interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$backup_dir"

while true; do
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  partial_file="$backup_dir/business_management_${timestamp}.dump.in_progress"
  final_file="$backup_dir/business_management_${timestamp}.dump"

  if pg_dump --format=custom --no-owner --no-privileges --file="$partial_file"; then
    mv "$partial_file" "$final_file"
    sha256sum "$final_file" > "${final_file}.sha256"
    find "$backup_dir" -type f -mtime "+$retention_days" -delete
    echo "[$(date -u +%FT%TZ)] database backup completed: $final_file"
  else
    rm -f "$partial_file"
    echo "[$(date -u +%FT%TZ)] database backup failed" >&2
  fi

  sleep "$interval_seconds"
done
