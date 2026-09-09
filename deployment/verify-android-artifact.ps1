param(
  [Parameter(Mandatory=$true)][string]$ApkPath,
  [Parameter(Mandatory=$true)][string]$ExpectedOrigin,
  [string]$BaselineApkPath="$PSScriptRoot/../public/downloads/department-steward-0.2.1.apk",
  [int]$ExpectedVersionCode=4
)
$ErrorActionPreference='Stop'
$apk=(Resolve-Path -LiteralPath $ApkPath).Path
$baseline=(Resolve-Path -LiteralPath $BaselineApkPath).Path
$sdk=if ($env:ANDROID_HOME) {$env:ANDROID_HOME} else {'D:/Android/Sdk'}
$buildTools=Get-ChildItem "$sdk/build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
function Get-Signer([string]$File) {
  $result=& "$($buildTools.FullName)/apksigner.bat" verify --print-certs $File
  if ($LASTEXITCODE -ne 0) { throw 'APK cryptographic signature verification failed' }
  $hash=[regex]::Match(($result -join "`n"),'certificate SHA-256 digest: ([0-9a-f]{64})').Groups[1].Value
  if (!$hash) { throw 'APK signer missing' }
  return $hash
}
$signer=Get-Signer $apk
if ($signer -ne (Get-Signer $baseline)) { throw 'New and old APK signing certificates differ' }
$badging=& "$($buildTools.FullName)/aapt.exe" dump badging $apk
if ($LASTEXITCODE -ne 0) { throw 'APK manifest could not be read' }
if (!(($badging -join "`n") -match "package: name='com.company.departmentsteward' versionCode='$ExpectedVersionCode'")) { throw 'APK application ID or versionCode mismatch' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($apk)
try {
  if ($zip.Entries | Where-Object { $_.FullName -match '\.apk$' }) { throw 'Nested APK found inside the mobile package; rebuild with the mobile profile' }
  $entry=$zip.GetEntry('assets/public/service-config.json')
  if (!$entry) { throw 'Shared service configuration missing from APK' }
  $reader=[IO.StreamReader]::new($entry.Open())
  try { $service=$reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  if ($service.origin -ne $ExpectedOrigin -or $service.apiBase -ne "$ExpectedOrigin/api/v1") { throw 'APK points at an unexpected service; do not publish' }
  $nativeEntry=$zip.GetEntry('assets/capacitor.config.json')
  if (!$nativeEntry) { throw 'Native bridge configuration missing' }
  $nativeReader=[IO.StreamReader]::new($nativeEntry.Open())
  try { $native=$nativeReader.ReadToEnd() | ConvertFrom-Json } finally { $nativeReader.Dispose() }
  if ([bool]$native.android.allowMixedContent -ne $ExpectedOrigin.StartsWith('http://')) { throw 'WebView mixed-content setting does not match the service environment' }
} finally { $zip.Dispose() }
[pscustomobject]@{apk=$apk;applicationId='com.company.departmentsteward';versionCode=$ExpectedVersionCode;origin=$service.origin;size=(Get-Item -LiteralPath $apk).Length;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $apk).Hash;signerSha256=$signer;matchesOldSignature=$true}
