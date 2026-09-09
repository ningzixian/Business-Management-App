param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$archive=(Join-Path (Get-Location) '.preparation/release-artifacts-20260909.zip')
tar.exe -a -cf $archive dist server/dist server/migrations deployment/Dockerfile.release-api deployment/Dockerfile.release-web deployment/nginx/default.conf
if($LASTEXITCODE -ne 0){throw 'Artifact archive failed'}
$hash=(Get-FileHash $archive).Hash
$lock=(Get-FileHash server/package-lock.json).Hash
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try{
 Invoke-Command -Session $session -ArgumentList $lock -ScriptBlock {
  param($Lock)
  if((Get-FileHash 'D:\BusinessManagementAppTesting\source\server\package-lock.json').Hash -ne $Lock){throw 'QA runtime dependency lock differs'}
 }
 Copy-Item -LiteralPath $archive -Destination 'D:\BusinessManagementApp\releases\release-20260909-143000\artifacts.zip' -ToSession $session
 Invoke-Command -Session $session -ArgumentList $hash -ScriptBlock {
  param($Hash)
  $dir='D:\BusinessManagementApp\releases\release-20260909-143000'
  if((Get-FileHash "$dir\artifacts.zip").Hash -ne $Hash){throw 'Artifact transfer hash mismatch'}
  New-Item -ItemType Directory "$dir\artifacts" -Force | Out-Null
  tar.exe -xf "$dir\artifacts.zip" -C "$dir\artifacts"
  if($LASTEXITCODE -ne 0){throw 'Artifact extract failed'}
  Set-Location "$dir\artifacts"
  $ErrorActionPreference='Continue'
  docker build --pull=false -t business-management-api:release-20260909-143000 -f deployment/Dockerfile.release-api . 2>&1 | ForEach-Object {"$_"}
  if($LASTEXITCODE -ne 0){throw 'API packaging failed'}
  docker build --pull=false -t business-management-web:release-20260909-143000 -f deployment/Dockerfile.release-web . 2>&1 | ForEach-Object {"$_"}
  if($LASTEXITCODE -ne 0){throw 'Web packaging failed'}
  Write-Output 'PASS: verified artifacts packaged with locked dependencies'
 }
}finally{Remove-PSSession $session}
