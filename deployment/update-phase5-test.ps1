param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$files=@(
  'src/App.tsx','src/dialog-layer.tsx','src/notifications.tsx','src/ui.tsx','src/overlays.tsx','src/attachments.tsx',
  'src/settings-pages.tsx','src/mobile-actions.tsx','src/use-mobile-layout.ts','src/styles.css',
  'server/migrations/005_notification_reads.sql','server/src/notifications/notifications.controller.ts',
  'server/src/app.module.ts','deployment/test/compose.yaml','deployment/test/verify-phase5.cjs'
)
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try {
  $stamp=Get-Date -Format yyyyMMdd-HHmmss
  Invoke-Command -Session $session -ArgumentList $stamp,$files -ScriptBlock {
    param($Stamp,$Files)
    $root='D:\BusinessManagementAppTesting'
    if (!(Test-Path "$root\source\deployment\test\.env")) { throw 'Prepared QA environment is missing' }
    if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory -lt 2GB/1KB) { throw 'Insufficient memory headroom' }
    foreach($file in $Files) {
      $source=Join-Path "$root\source" $file
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $source) | Out-Null
      if (Test-Path -LiteralPath $source) {
        $backup=Join-Path "$root\rollback\$Stamp" $file
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
        Copy-Item -LiteralPath $source -Destination $backup
      }
    }
    foreach($service in @('api','web')) {
      docker tag "business-management-test-${service}:baseline" "business-management-test-${service}:pre-phase5-$Stamp"
      if ($LASTEXITCODE -ne 0) { throw 'QA image rollback tag failed' }
    }
    docker exec business-management-test-db-1 pg_dump -U business_test -d business_management_test -Fc -f "/tmp/pre-phase5-$Stamp.dump"
    if ($LASTEXITCODE -ne 0) { throw 'QA database backup failed' }
    docker cp "business-management-test-db-1:/tmp/pre-phase5-$Stamp.dump" "$root\rollback\$Stamp\database.dump"
    if ($LASTEXITCODE -ne 0) { throw 'QA database backup copy failed' }
    Get-FileHash -Algorithm SHA256 "$root\rollback\$Stamp\database.dump"
    Write-Output "QA rollback snapshot: $root\rollback\$Stamp"
  }
  foreach($file in $files) { Copy-Item -LiteralPath (Join-Path $workspace $file) -Destination "D:\BusinessManagementAppTesting\source\$file" -ToSession $session }
  Invoke-Command -Session $session -ScriptBlock {
    Set-Location 'D:\BusinessManagementAppTesting\source\deployment\test'
    docker compose --project-name business-management-test --env-file .env -f compose.yaml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'QA Compose validation failed' }
    $ErrorActionPreference='Continue'
    foreach($service in @('api','web')) {
      docker compose --project-name business-management-test --env-file .env -f compose.yaml build $service 2>&1 | ForEach-Object { "$_" }
      if ($LASTEXITCODE -ne 0) { throw "QA $service build failed" }
    }
    docker compose --project-name business-management-test --env-file .env -f compose.yaml up -d --no-deps --wait --wait-timeout 180 api web 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'QA startup failed' }
    docker compose --project-name business-management-test --env-file .env -f compose.yaml exec -T api node /app/test-verify-phase5.cjs 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'Phase 5 API regression failed' }
  }
} finally { Remove-PSSession $session }
