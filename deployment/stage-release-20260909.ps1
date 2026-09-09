param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$archive=Join-Path $root '.preparation/release-20260909-143000.zip'
Set-Location $root
tar.exe -a -cf $archive --exclude=node_modules --exclude=dist --exclude=.test-dist --exclude=.env --exclude=.env.* src public server deployment/nginx deployment/release-20260909.override.yaml deployment/release-preflight.cjs Dockerfile.web package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts .dockerignore
if($LASTEXITCODE -ne 0){throw 'Release archive failed'}
$hash=(Get-FileHash $archive).Hash
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try{
 Invoke-Command -Session $session -ScriptBlock {
  $dir='D:\BusinessManagementApp\releases\release-20260909-143000'
  if(Test-Path $dir){throw 'Release directory exists; inspect before retry'}
  New-Item -ItemType Directory -Path $dir | Out-Null
 }
 Copy-Item -LiteralPath $archive -Destination 'D:\BusinessManagementApp\releases\release-20260909-143000\source.zip' -ToSession $session
 Invoke-Command -Session $session -ArgumentList $hash -ScriptBlock {
  param($Hash)
  $ErrorActionPreference='Stop'
  $dir='D:\BusinessManagementApp\releases\release-20260909-143000'
  if((Get-FileHash "$dir\source.zip").Hash -ne $Hash){throw 'Source hash mismatch'}
  New-Item -ItemType Directory "$dir\source" | Out-Null
  tar.exe -xf "$dir\source.zip" -C "$dir\source"
  if($LASTEXITCODE -ne 0){throw 'Source extract failed'}
  foreach($service in @('web','api')){
   $old=docker inspect "business-management-$service-1" --format '{{.Image}}'
   docker tag $old "business-management-${service}:pre-20260909-143000"
   if($LASTEXITCODE -ne 0){throw 'Rollback tag failed'}
  }
  Set-Location "$dir\source"
  $ErrorActionPreference='Continue'
  docker build -t business-management-api:release-20260909-143000 -f server/Dockerfile server 2>&1 | ForEach-Object {"$_"}
  if($LASTEXITCODE -ne 0){throw 'API build failed'}
  docker build -t business-management-web:release-20260909-143000 -f Dockerfile.web . 2>&1 | ForEach-Object {"$_"}
  if($LASTEXITCODE -ne 0){throw 'Web build failed'}
  Write-Output 'PASS: new release images built without replacing running services'
 }
}finally{Remove-PSSession $session}
