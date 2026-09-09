param(
    [Parameter(Mandatory=$true)][pscredential]$Credential,
    [Parameter(Mandatory=$true)][string]$ExpectedServiceOrigin
)
$ErrorActionPreference = 'Stop'
# Publication is a separate, explicit action. Reject QA-address, wrong-signature and mismatched artifacts before contacting the server.
$release = Get-Content "$PSScriptRoot/../public/downloads/android.json" -Raw -Encoding UTF8 | ConvertFrom-Json
if ($release.path -notmatch '^/downloads/[A-Za-z0-9._-]+\.apk$' -or [int]$release.versionCode -lt 4) { throw 'Prepare a verified versionCode >= 4 release manifest first' }
$candidate = Join-Path "$PSScriptRoot/../public" $release.path.TrimStart('/')
if ($ExpectedServiceOrigin -match '10\.0\.2\.2|localhost|127\.0\.0\.1') { throw 'Do not publish emulator/local-test artifacts to the company download service' }
$verified = & "$PSScriptRoot/verify-android-artifact.ps1" -ApkPath $candidate -ExpectedOrigin $ExpectedServiceOrigin -ExpectedVersionCode $release.versionCode
if ($verified.size -ne $release.size -or $verified.sha256 -ne $release.sha256) { throw 'APK bytes do not match the release manifest' }
$session = New-PSSession -ComputerName 192.168.0.253 -Authentication Negotiate -Credential $Credential
try {
    Invoke-Command -Session $session -ScriptBlock {
        $ErrorActionPreference = 'Stop'
        $backup = 'D:\BusinessManagementApp\releases\downloads-' + (Get-Date -Format yyyyMMdd-HHmmss)
        New-Item -ItemType Directory -Path $backup | Out-Null
        Copy-Item -LiteralPath 'D:\BusinessManagementApp\app\deployment\nginx\default.conf' -Destination $backup
        if (Test-Path 'D:\BusinessManagementApp\app\public\downloads') { Copy-Item 'D:\BusinessManagementApp\app\public\downloads' $backup -Recurse }
        New-Item -ItemType Directory -Force -Path 'D:\BusinessManagementApp\app\public\downloads' | Out-Null
        docker ps --format '{{.Names}}|{{.Status}}'
    }
    Copy-Item -Path "$PSScriptRoot\..\public\downloads\*" -Destination 'D:\BusinessManagementApp\app\public\downloads' -ToSession $session
    Copy-Item -LiteralPath "$PSScriptRoot\nginx\default.conf" -Destination 'D:\BusinessManagementApp\app\deployment\nginx\default.conf' -ToSession $session
    Invoke-Command -Session $session -ScriptBlock {
        Set-Location 'D:\BusinessManagementApp\app'
        $release = Get-Content public/downloads/android.json -Raw -Encoding UTF8 | ConvertFrom-Json
        $apk = Join-Path public ($release.path.TrimStart('/'))
        if ((Get-FileHash $apk).Hash -ne $release.sha256) { throw 'APK hash mismatch' }
        $ErrorActionPreference = 'Continue'
        docker compose --project-name business-management --env-file ..\.env -f compose.yaml build web 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
        docker compose --project-name business-management --env-file ..\.env -f compose.yaml up -d --no-deps web 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) { throw 'Deploy failed' }
    }
} finally { Remove-PSSession $session }
