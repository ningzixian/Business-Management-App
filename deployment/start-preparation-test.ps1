param([Parameter(Mandatory=$true)][pscredential]$Credential,
      [Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = 'Stop'
$archivePath=(Resolve-Path -LiteralPath $Archive).Path
$checksum=(Get-FileHash -LiteralPath $archivePath).Hash
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try {
  Invoke-Command -Session $session -ArgumentList $checksum -ScriptBlock {
    param($ExpectedHash)
    $ErrorActionPreference='Stop'
    if (!(Test-Path 'D:\BusinessManagementApp\backups\preparation\20260908-132500\manifest.json')) { throw 'Verified preparation backup must exist before test setup' }
    $root='D:\BusinessManagementAppTesting'
    if (Test-Path "$root\source") { throw 'Test source already exists; inspect before resuming' }
    if (Get-NetTCPConnection -LocalPort 18088 -State Listen -ErrorAction SilentlyContinue) { throw 'Test port already in use' }
    $existing=docker ps -aq --filter label=com.docker.compose.project=business-management-test
    if ($existing) { throw 'Test project already exists; inspect before resuming' }
    if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory -lt 3GB/1KB) { throw 'Insufficient host memory headroom' }
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    [IO.File]::WriteAllText("$root\expected-source-sha256.txt",$ExpectedHash)
  }
  Copy-Item -LiteralPath $archivePath -Destination 'D:\BusinessManagementAppTesting\source-baseline.zip' -ToSession $session
  Invoke-Command -Session $session -ArgumentList $checksum -ScriptBlock {
    param($ExpectedHash)
    $ErrorActionPreference='Stop'
    $root='D:\BusinessManagementAppTesting'
    if ((Get-FileHash "$root\source-baseline.zip").Hash -ne $ExpectedHash) { throw 'Uploaded source checksum mismatch' }
    Expand-Archive -LiteralPath "$root\source-baseline.zip" -DestinationPath "$root\source"
    Set-Location "$root\source\deployment\test"
    ./initialize-credentials.ps1
    docker compose --project-name business-management-test --env-file .env -f compose.yaml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Test Compose validation failed' }
    $ErrorActionPreference='Continue'
    foreach($service in @('api','web')) {
      docker compose --project-name business-management-test --env-file .env -f compose.yaml build $service 2>&1 | ForEach-Object { "$_" }
      if ($LASTEXITCODE -ne 0) { throw "Test $service build failed" }
    }
    docker compose --project-name business-management-test --env-file .env -f compose.yaml up -d --wait --wait-timeout 180 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'Test startup failed; inspect test-only services' }
    docker compose --project-name business-management-test --env-file .env -f compose.yaml exec -T api node /app/test-seed.cjs 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic fixture creation failed' }
    docker compose --project-name business-management-test --env-file .env -f compose.yaml exec -T api node /app/test-verify.cjs 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'Test preparation smoke verification failed' }
    docker compose --project-name business-management-test --env-file .env -f compose.yaml ps
    if ($LASTEXITCODE -ne 0) { throw 'Test status check failed' }
  }
} finally { Remove-PSSession $session }
