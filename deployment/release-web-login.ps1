param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$stamp=Get-Date -Format yyyyMMdd-HHmmss
$archive=".preparation/web-login-$stamp.zip"
tar.exe -a -cf $archive dist src/auth-page.tsx src/styles.css deployment/Dockerfile.release-web deployment/Dockerfile.release-web.dockerignore deployment/nginx/default.conf
if($LASTEXITCODE -ne 0){throw 'Archive failed'}
$hash=(Get-FileHash $archive).Hash
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try {
 Invoke-Command -Session $session -ArgumentList $stamp -ScriptBlock {
  param($Stamp)
  $dir="D:\BusinessManagementApp\releases\web-login-$Stamp"
  if(Test-Path $dir){throw 'Release already exists'}
  New-Item -ItemType Directory $dir | Out-Null
 }
 Copy-Item -LiteralPath $archive -ToSession $session -Destination "D:\BusinessManagementApp\releases\web-login-$stamp\bundle.zip"
 Invoke-Command -Session $session -ArgumentList $stamp,$hash -ScriptBlock {
  param($Stamp,$Hash)
  $ErrorActionPreference='Stop';$dir="D:\BusinessManagementApp\releases\web-login-$Stamp"
  if((Get-FileHash "$dir\bundle.zip").Hash -ne $Hash){throw 'Transfer mismatch'}
  tar.exe -xf "$dir\bundle.zip" -C $dir
  if($LASTEXITCODE -ne 0){throw 'Extract failed'}
  $protected=@(docker ps --format '{{.Names}}' | Where-Object {$_ -ne 'business-management-web-1'})
  if($LASTEXITCODE -ne 0 -or !$protected.Count){throw 'Cannot establish isolation baseline'}
  $before=docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
  if($LASTEXITCODE -ne 0){throw 'Inspect failed'}
  [IO.File]::WriteAllLines("$dir\protected-before.txt",[string[]]$before)
  $metadata=Invoke-RestMethod 'http://127.0.0.1:8088/downloads/android.json'
  $localMetadata=Get-Content "$dir\dist\downloads\android.json" -Encoding UTF8 -Raw | ConvertFrom-Json
  if($metadata.versionCode -ne $localMetadata.versionCode -or $metadata.sha256 -ne $localMetadata.sha256){throw 'Android metadata would change; refusing web-only deployment'}
  if((Get-FileHash "$dir\dist$($metadata.path)").Hash -ne $metadata.sha256){throw 'Bundled APK mismatch'}
  $old=docker inspect business-management-web-1 --format '{{.Image}}'
  if($LASTEXITCODE -ne 0){throw 'Old web image unavailable'}
  docker tag $old "business-management-web:pre-login-$Stamp"
  if($LASTEXITCODE -ne 0){throw 'Rollback tag failed'}
  Set-Location $dir;$ErrorActionPreference='Continue'
  docker build --pull=false -t "business-management-web:login-$Stamp" -f deployment/Dockerfile.release-web . 2>&1 | ForEach-Object {"$_"}
  if($LASTEXITCODE -ne 0){throw 'Web build failed'}
  $ErrorActionPreference='Stop'
  [IO.File]::WriteAllText("$dir\release.yaml","services:`n  web:`n    image: business-management-web:login-$Stamp`n")
  [IO.File]::WriteAllText("$dir\rollback.yaml","services:`n  web:`n    image: business-management-web:pre-login-$Stamp`n")
  Set-Location 'D:\BusinessManagementApp\app'
  $base=@('compose','-p','business-management','--env-file','D:\BusinessManagementApp\.env','-f','compose.yaml')
  try {
   $ErrorActionPreference='Continue'
   docker @base -f "$dir\release.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 web 2>&1 | ForEach-Object {"$_"}
   if($LASTEXITCODE -ne 0){throw 'Activation failed'}
   $ErrorActionPreference='Stop'
   $html=(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8088/').Content
   $built=Get-Content "$dir\dist\index.html" -Encoding UTF8 -Raw
   $script=[regex]::Match($built,'/assets/index-[^" ]+\.js').Value
   if(!$script -or !$html.Contains($script)){throw 'HTML is not the new build'}
   if((Invoke-RestMethod 'http://127.0.0.1:8088/api/v1/health/ready').status -ne 'ready'){throw 'API readiness failed'}
   $after=docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
   if(@(Compare-Object $before $after).Count){throw 'Protected container changed; inspect concurrent activity'}
   $published=Invoke-RestMethod 'http://127.0.0.1:8088/downloads/android.json'
   if($published.sha256 -ne $metadata.sha256 -or $published.versionCode -ne $metadata.versionCode){throw 'Android metadata changed'}
   foreach($folder in @('src','dist')) {
    foreach($file in (Get-ChildItem "$dir\$folder" -Recurse -File)) {
     $relative=$file.FullName.Substring($dir.Length+1)
     $target=[IO.Path]::GetFullPath((Join-Path 'D:\BusinessManagementApp\app' $relative))
     if(!$target.StartsWith('D:\BusinessManagementApp\app\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source path invalid'}
     New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
     Copy-Item -LiteralPath $file.FullName -Destination $target
    }
   }
   docker tag "business-management-web:login-$Stamp" business-management-web:0.2.0
   if($LASTEXITCODE -ne 0){throw 'Standard alias update failed'}
   [IO.File]::WriteAllLines("$dir\protected-after.txt",[string[]]$after)
   $result=@{publishedAt=(Get-Date -Format o);release=$dir;script=$script;protectedUnchanged=$true;androidUnchanged=$true}
   [IO.File]::WriteAllText("$dir\verification.json",($result|ConvertTo-Json));$result|ConvertTo-Json
  }catch {
   $failure=$_;$ErrorActionPreference='Continue'
   docker @base -f "$dir\rollback.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 web 2>&1 | ForEach-Object {"$_"}
   if($LASTEXITCODE -ne 0){Write-Output 'ATTENTION web rollback failed'}
   throw $failure
  }
 }
} finally {Remove-PSSession $session}
