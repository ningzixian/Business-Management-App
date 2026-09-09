$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$output = Join-Path $root ".preparation/$stamp"
New-Item -ItemType Directory -Path $output | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @(git ls-files --cached --others --exclude-standard | Sort-Object -Unique)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate Git workspace' }
$zipPath = Join-Path $output 'source-baseline.zip'
$archive = [IO.Compression.ZipFile]::Open($zipPath, 'Create')
$manifest = @()
try {
  foreach ($file in $files) {
    $full = Join-Path $root $file
    if (!(Test-Path -LiteralPath $full -PathType Leaf)) { continue }
    if ($file -match '(^|/)(\.env$|\.env\..*\.local$)|\.(keystore|jks)$') { continue }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $full, $file.Replace('\','/')) | Out-Null
    $manifest += [pscustomobject]@{ path=$file; sha256=(Get-FileHash -LiteralPath $full).Hash }
  }
} finally { $archive.Dispose() }
[IO.File]::WriteAllText((Join-Path $output 'files.json'), ($manifest | ConvertTo-Json -Depth 4))
[IO.File]::WriteAllText((Join-Path $output 'git-status.txt'), ((git status --short) -join "`n"))
[IO.File]::WriteAllText((Join-Path $output 'git-diff.patch'), ((git diff --binary HEAD) -join "`n"))
$metadata = [ordered]@{ timestamp=$stamp; commit=(git rev-parse HEAD); branch=(git branch --show-current); archiveSha256=(Get-FileHash $zipPath).Hash; files=$manifest.Count; webVersion=(Get-Content package.json -Raw | ConvertFrom-Json).version; apiVersion=(Get-Content server/package.json -Raw | ConvertFrom-Json).version }
if (Test-Path public/downloads/android.json) { $metadata.androidRelease=Get-Content public/downloads/android.json -Raw | ConvertFrom-Json }
$apk = 'public/downloads/department-steward-0.2.1.apk'
if (Test-Path $apk) { Copy-Item -LiteralPath $apk -Destination $output; $metadata.apkSha256=(Get-FileHash $apk).Hash }
[IO.File]::WriteAllText((Join-Path $output 'baseline.json'), ($metadata | ConvertTo-Json -Depth 6))
[pscustomobject]@{ directory=$output; files=$manifest.Count; archiveSha256=$metadata.archiveSha256; commit=$metadata.commit }
