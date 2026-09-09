param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$files=@(
  'src/attachments.tsx','src/attachment-files.ts','src/mobile-actions.tsx','src/settings-pages.tsx','deployment/nginx/default.conf','server/migrations/004_attachment_cleanup.sql','server/src/attachments/file-policy.ts','server/src/attachments/attachments.controller.ts','server/src/attachments/attachments.service.ts','server/src/storage/storage.service.ts','src/visit-draft.ts','server/src/business-items/dto/business-item.dto.ts','src/business-clock.tsx','src/business-metrics.ts','src/live-reports.tsx','src/task-preview.tsx','deployment/test/verify-phase4.cjs',
  'src/App.tsx','src/api.ts','src/api-adapters.ts','src/types.ts','src/client-actions.ts','src/write-access.tsx',
  'src/pages.tsx','src/mobile-pages.tsx','src/master-data-pages.tsx','src/overlays.tsx','src/styles.css',
  'server/src/common/contact-visibility.ts','server/src/organizations/organizations.service.ts',
  'server/src/business-items/business-items.service.ts','deployment/test/compose.yaml','deployment/test/verify-phase1.cjs'
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
      if (Test-Path -LiteralPath $source) {
        $backup=Join-Path "$root\rollback\$Stamp" $file
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
        Copy-Item -LiteralPath $source -Destination $backup
      }
    }
    foreach($service in @('api','web')) {
      docker tag "business-management-test-${service}:baseline" "business-management-test-${service}:pre-phase4-$Stamp"
      if ($LASTEXITCODE -ne 0) { throw 'QA image rollback tag failed' }
    }
    docker exec business-management-test-db-1 pg_dump -U business_test -d business_management_test -Fc -f "/tmp/pre-phase4-$Stamp.dump"
    if ($LASTEXITCODE -ne 0) { throw 'QA database backup failed' }
    docker cp "business-management-test-db-1:/tmp/pre-phase4-$Stamp.dump" "$root\rollback\$Stamp\database.dump"
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
    docker compose --project-name business-management-test --env-file .env -f compose.yaml exec -T api node /app/test-verify-phase4.cjs 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'Phase 4 API regression failed' }
  }
} finally { Remove-PSSession $session }
