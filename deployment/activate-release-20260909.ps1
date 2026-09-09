param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try{
 Copy-Item -LiteralPath "$PSScriptRoot/rollback-20260909.override.yaml" -ToSession $session -Destination 'D:\BusinessManagementApp\releases\release-20260909-143000\rollback.override.yaml'
 Invoke-Command -Session $session -ScriptBlock {
  $ErrorActionPreference='Stop'
  $release='D:\BusinessManagementApp\releases\release-20260909-143000'
  $backup='D:\BusinessManagementApp\backups\preparation\20260909-143000'
  foreach($item in (Get-Content "$backup\manifest.json" -Raw | ConvertFrom-Json)){
   $file=[IO.Path]::GetFullPath((Join-Path $backup $item.file))
   if(!$file.StartsWith($backup+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Backup path invalid'}
   if((Get-FileHash -LiteralPath $file).Hash -ne $item.sha256){throw 'Backup hash mismatch'}
  }
  $protected=@('business-management-db-1','business-management-storage-1','business-management-db-backup-1','business-management-storage-backup-1','cp-data-system-frontend','cp-data-system-backend','postgis-prod','mysql-prod','business-management-test-web-1','business-management-test-api-1','business-management-test-db-1','business-management-test-storage-1')
  $before=docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
  if($LASTEXITCODE -ne 0){throw 'Isolation baseline failed'}
  [IO.File]::WriteAllLines("$release\protected-before.txt",[string[]]$before)
  Set-Location 'D:\BusinessManagementApp\app'
  $base=@('compose','--project-name','business-management','--env-file','D:\BusinessManagementApp\.env','-f','compose.yaml')
  $new=@('-f',"$release\source\deployment\release-20260909.override.yaml")
  docker @base @new config --quiet
  if($LASTEXITCODE -ne 0){throw 'Compose validation failed'}
  foreach($name in @('api','web')){docker image inspect "business-management-${name}:release-20260909-143000" --format '{{.Id}}';if($LASTEXITCODE -ne 0){throw 'Release image missing'}}
  try{
   $ErrorActionPreference='Continue'
   docker @base @new up -d --no-deps --no-build --wait --wait-timeout 180 api 2>&1 | ForEach-Object {"$_"}
   if($LASTEXITCODE -ne 0){throw 'API activation failed'}
   docker @base @new up -d --no-deps --no-build --wait --wait-timeout 120 web 2>&1 | ForEach-Object {"$_"}
   if($LASTEXITCODE -ne 0){throw 'Web activation failed'}
   $ErrorActionPreference='Stop'
   $ready=Invoke-RestMethod 'http://127.0.0.1:8088/api/v1/health/ready'
   if($ready.status -ne 'ready'){throw 'Readiness failed'}
   $metadata=Invoke-RestMethod 'http://127.0.0.1:8088/downloads/android.json'
   if($metadata.versionCode -ne 7){throw 'Published version mismatch'}
   Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8088$($metadata.path)" -OutFile "$release\download-verified.apk"
   if((Get-FileHash "$release\download-verified.apk").Hash -ne $metadata.sha256){throw 'HTTP download checksum mismatch'}
   $after=docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
   if(@(Compare-Object $before $after).Count){throw 'Protected container changed; inspect concurrent activity'}
   [IO.File]::WriteAllLines("$release\protected-after.txt",[string[]]$after)
   # Keep the standard deployment checkout/build path current; environment and Compose stay untouched.
   $sourceRoot="$release\source"
   foreach($file in (Get-ChildItem -LiteralPath $sourceRoot -Recurse -File)){
    $relative=$file.FullName.Substring($sourceRoot.Length+1)
    $target=[IO.Path]::GetFullPath((Join-Path 'D:\BusinessManagementApp\app' $relative))
    if(!$target.StartsWith('D:\BusinessManagementApp\app\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source copy path invalid'}
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $target
   }
   foreach($name in @('api','web')){
    docker tag "business-management-${name}:release-20260909-143000" "business-management-${name}:0.2.0"
    if($LASTEXITCODE -ne 0){throw 'Standard image alias update failed'}
   }
   $result=@{checkedAt=(Get-Date -Format o);ready=$ready.status;androidVersion=$metadata.versionName;androidSha256=$metadata.sha256;protectedContainersUnchanged=$true;source="$release\source"}
   [IO.File]::WriteAllText("$release\release-verification.json",($result|ConvertTo-Json))
   $result|ConvertTo-Json
  }catch{
   $failure=$_
   $ErrorActionPreference='Continue'
   docker @base -f "$release\rollback.override.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 api web 2>&1 | ForEach-Object {"$_"}
   if($LASTEXITCODE -ne 0){Write-Output 'ATTENTION: application rollback failed; do not restore old DB automatically'}
   throw $failure
  }
 }
}finally{Remove-PSSession $session}
