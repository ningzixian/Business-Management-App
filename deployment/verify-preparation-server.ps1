param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference='Stop'
$result=Invoke-Command -ComputerName 192.168.0.253 -Credential $Credential -ScriptBlock {
  $ErrorActionPreference='Stop'
  $backup='D:\BusinessManagementApp\backups\preparation\20260908-132500'
  $manifest=Get-Content "$backup\manifest.json" -Raw | ConvertFrom-Json
  foreach($file in $manifest) {
    $path=[IO.Path]::GetFullPath((Join-Path $backup $file.file))
    if (!$path.StartsWith($backup+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path outside backup' }
    if ((Get-FileHash -LiteralPath $path).Hash -ne $file.sha256) { throw "Backup checksum mismatch: $($file.file)" }
  }
  if ((Get-FileHash "$backup\database.dump").Hash -ne 'DB3694B71B97C6749EF2AB93C74DF032F9147CBE89F5C8DB445043D7E164ED77') { throw 'Database export and transferred file differ' }
  $containers=@('business-management-web-1','business-management-api-1','business-management-db-1','business-management-storage-1','cp-data-system-frontend','cp-data-system-backend','postgis-prod','mysql-prod')
  $before=Get-Content "$backup\containers-before.txt"
  $after=docker inspect @containers --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
  if ($LASTEXITCODE -ne 0) { throw 'Production state read failed' }
  if (@(Compare-Object $before $after).Count) { throw 'Production/detection container state changed; inspect before accepting' }
  $ports=docker inspect business-management-test-web-1 --format '{{json .HostConfig.PortBindings}}' | ConvertFrom-Json
  if ($ports.'8080/tcp'[0].HostIp -ne '127.0.0.1' -or $ports.'8080/tcp'[0].HostPort -ne '18088') { throw 'Unexpected test web binding' }
  foreach($component in @('api','db','storage')) {
    $bindings=docker inspect "business-management-test-$component-1" --format '{{json .HostConfig.PortBindings}}'
    if ($bindings -notin @('{}','null')) { throw 'Unexpected test data/API published port' }
    $mounts=docker inspect "business-management-test-$component-1" --format '{{json .Mounts}}' | ConvertFrom-Json
    foreach($mount in $mounts) {
      if ($mount.Type -eq 'volume' -and !$mount.Name.StartsWith('business-management-test_')) { throw 'Non-test volume mounted' }
      if ($mount.Type -eq 'bind' -and ($mount.Source -notlike '*BusinessManagementAppTesting*' -or $mount.RW)) { throw 'Unexpected bind mount' }
    }
  }
  $network=docker network inspect business-management-test_qa --format '{{.Internal}}'
  if ($network -ne 'true') { throw 'Test network is not internal' }
  foreach($component in @('web','api','db','storage')) {
    $nets=docker inspect "business-management-test-$component-1" --format '{{json .NetworkSettings.Networks}}' | ConvertFrom-Json
    $expected=if($component -eq 'web'){@('business-management-test_entry','business-management-test_qa')}else{@('business-management-test_qa')}
    if (@(Compare-Object $expected @($nets.PSObject.Properties.Name)).Count) { throw 'Test service attached to unexpected network' }
  }
  $testReady=Invoke-RestMethod 'http://127.0.0.1:18088/api/v1/health/ready'
  $productionReady=Invoke-RestMethod 'http://127.0.0.1:8088/api/v1/health/ready'
  $web=Invoke-WebRequest 'http://127.0.0.1:18088/' -UseBasicParsing
  if ($web.StatusCode -ne 200 -or $testReady.status -ne 'ready' -or $productionReady.status -ne 'ready') { throw 'Readiness check failed' }
  $summary=[ordered]@{ checkedAt=(Get-Date).ToString('o'); backup=$backup; backupFilesVerified=@($manifest).Count; productionContainersUnchanged=$true; testNetworkInternal=$true; testBind='127.0.0.1:18088'; testWebStatus=$web.StatusCode; testReady=$testReady.status; productionReady=$productionReady.status; isolationVerified=$true }
  [IO.File]::WriteAllText('D:\BusinessManagementAppTesting\preparation-verification.json',($summary | ConvertTo-Json))
  docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}'
  docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}'
  $summary | ConvertTo-Json
}
$result
