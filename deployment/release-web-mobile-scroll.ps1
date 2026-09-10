param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$archive = Join-Path $root ".preparation/web-mobile-scroll-$stamp.zip"

tar.exe -a -cf $archive dist public/downloads src/dialog-layer.tsx src/styles.css android/app/build.gradle deployment/Dockerfile.release-web deployment/Dockerfile.release-web.dockerignore deployment/nginx/default.conf
if ($LASTEXITCODE -ne 0) { throw 'Archive failed' }
$hash = (Get-FileHash $archive).Hash
$session = New-PSSession -ComputerName 192.168.0.253 -Authentication Negotiate -Credential $Credential
try {
  Invoke-Command -Session $session -ArgumentList $stamp -ScriptBlock {
    param($Stamp)
    $dir = "D:\BusinessManagementApp\releases\web-mobile-scroll-$Stamp"
    if (Test-Path $dir) { throw 'Release already exists' }
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Copy-Item -LiteralPath $archive -ToSession $session -Destination "D:\BusinessManagementApp\releases\web-mobile-scroll-$stamp\bundle.zip"
  Invoke-Command -Session $session -ArgumentList $stamp,$hash -ScriptBlock {
    param($Stamp,$Hash)
    $ErrorActionPreference = 'Stop'
    $dir = "D:\BusinessManagementApp\releases\web-mobile-scroll-$Stamp"
    if ((Get-FileHash "$dir\bundle.zip").Hash -ne $Hash) { throw 'Transfer hash mismatch' }
    tar.exe -xf "$dir\bundle.zip" -C $dir
    if ($LASTEXITCODE -ne 0) { throw 'Extract failed' }

    $candidate = Get-Content "$dir\public\downloads\android.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($candidate.versionCode -ne 9 -or $candidate.path -ne '/downloads/department-steward-0.2.7.apk') { throw 'Unexpected Android release metadata' }
    $candidateApk = Join-Path "$dir\public" $candidate.path.TrimStart('/')
    if ((Get-Item $candidateApk).Length -ne $candidate.size -or (Get-FileHash $candidateApk).Hash -ne $candidate.sha256) { throw 'Candidate APK mismatch' }
    $current = Invoke-RestMethod 'http://127.0.0.1:8088/downloads/android.json'
    if ($current.versionCode -ne 8) { throw "Expected current Android versionCode 8, found $($current.versionCode)" }

    $protected = @(docker ps --format '{{.Names}}' | Where-Object { $_ -ne 'business-management-web-1' })
    if ($LASTEXITCODE -ne 0 -or !$protected.Count) { throw 'Cannot establish isolation baseline' }
    $before = docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
    if ($LASTEXITCODE -ne 0) { throw 'Protected container inspection failed' }
    [IO.File]::WriteAllLines("$dir\protected-before.txt", [string[]]$before)

    $old = docker inspect business-management-web-1 --format '{{.Image}}'
    if ($LASTEXITCODE -ne 0) { throw 'Current Web image unavailable' }
    docker tag $old "business-management-web:pre-scroll-$Stamp"
    if ($LASTEXITCODE -ne 0) { throw 'Rollback tag failed' }
    Set-Location $dir
    $ErrorActionPreference = 'Continue'
    docker build --pull=false -t "business-management-web:scroll-$Stamp" -f deployment/Dockerfile.release-web . 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw 'Web image build failed' }
    $ErrorActionPreference = 'Stop'
    [IO.File]::WriteAllText("$dir\release.yaml", "services:`n  web:`n    image: business-management-web:scroll-$Stamp`n")
    [IO.File]::WriteAllText("$dir\rollback.yaml", "services:`n  web:`n    image: business-management-web:pre-scroll-$Stamp`n")

    Set-Location 'D:\BusinessManagementApp\app'
    $base = @('compose','-p','business-management','--env-file','D:\BusinessManagementApp\.env','-f','compose.yaml')
    try {
      $ErrorActionPreference = 'Continue'
      docker @base -f "$dir\release.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 web 2>&1 | ForEach-Object { "$_" }
      if ($LASTEXITCODE -ne 0) { throw 'Web activation failed' }
      $ErrorActionPreference = 'Stop'
      if ((Invoke-RestMethod 'http://127.0.0.1:8088/api/v1/health/ready').status -ne 'ready') { throw 'API readiness failed' }
      $published = Invoke-RestMethod 'http://127.0.0.1:8088/downloads/android.json'
      if ($published.versionCode -ne 9 -or $published.sha256 -ne $candidate.sha256) { throw 'Published Android metadata mismatch' }
      Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8088$($published.path)" -OutFile "$dir\verified-download.apk"
      if ((Get-Item "$dir\verified-download.apk").Length -ne $candidate.size -or (Get-FileHash "$dir\verified-download.apk").Hash -ne $candidate.sha256) { throw 'Published APK mismatch' }
      $html = (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8088/').Content
      $built = Get-Content "$dir\dist\index.html" -Raw -Encoding UTF8
      $script = [regex]::Match($built, '/assets/index-[^" ]+\.js').Value
      if (!$script -or !$html.Contains($script)) { throw 'Published HTML is not the candidate build' }
      $after = docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
      if (@(Compare-Object $before $after).Count) { throw 'A protected container changed during deployment' }
      [IO.File]::WriteAllLines("$dir\protected-after.txt", [string[]]$after)

      foreach ($source in @('dist','public\downloads','src\dialog-layer.tsx','src\styles.css','android\app\build.gradle')) {
        $sourcePath = Join-Path $dir $source
        if (Test-Path $sourcePath -PathType Container) {
          foreach ($file in Get-ChildItem $sourcePath -Recurse -File) {
            $relative = $file.FullName.Substring($dir.Length + 1)
            $target = [IO.Path]::GetFullPath((Join-Path 'D:\BusinessManagementApp\app' $relative))
            New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $target
          }
        } else {
          $target = Join-Path 'D:\BusinessManagementApp\app' $source
          New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
          Copy-Item -LiteralPath $sourcePath -Destination $target
        }
      }
      docker tag "business-management-web:scroll-$Stamp" business-management-web:0.2.0
      $result = @{ publishedAt=(Get-Date -Format o); release=$dir; script=$script; androidVersion='0.2.7'; androidSha256=$candidate.sha256; protectedUnchanged=$true; apiRestarted=$false }
      [IO.File]::WriteAllText("$dir\verification.json", ($result | ConvertTo-Json))
      $result | ConvertTo-Json
    } catch {
      $failure = $_
      $ErrorActionPreference = 'Continue'
      docker @base -f "$dir\rollback.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 web 2>&1 | ForEach-Object { "$_" }
      throw $failure
    }
  }
} finally {
  Remove-PSSession $session
}
