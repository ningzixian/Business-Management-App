param([Parameter(Mandatory=$true)][pscredential]$Credential,
 [Parameter(Mandatory=$true)][ValidatePattern('^\d{8}-\d{6}$')][string]$Stamp,
 [Parameter(Mandatory=$true)][ValidateSet('Stage','Test','Publish')][string]$Phase)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$session=New-PSSession -ComputerName 192.168.0.253 -Credential $Credential
try {
 if($Phase -eq 'Stage') {
  $archive=Join-Path $root ".preparation/v026-$Stamp.zip"
  tar.exe -a -cf $archive --exclude=node_modules --exclude=.test-dist --exclude=.env --exclude=.env.* src public server deployment dist Dockerfile.web package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts .dockerignore
  if($LASTEXITCODE -ne 0){throw 'Archive failed'}
  $hash=(Get-FileHash $archive).Hash
  $lock=(Get-FileHash server/package-lock.json).Hash
  Invoke-Command -Session $session -ArgumentList $Stamp,$lock -ScriptBlock {
   param($Stamp,$Lock)
   $dir="D:\BusinessManagementApp\releases\release-$Stamp"
   if(Test-Path $dir){throw 'Release directory already exists'}
   if((Get-FileHash 'D:\BusinessManagementAppTesting\source\server\package-lock.json').Hash -ne $Lock){throw 'Runtime dependency lock mismatch'}
   New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Copy-Item -LiteralPath $archive -ToSession $session -Destination "D:\BusinessManagementApp\releases\release-$Stamp\source.zip"
  Invoke-Command -Session $session -ArgumentList $Stamp,$hash -ScriptBlock {
   param($Stamp,$Hash)
   $ErrorActionPreference='Stop'; $dir="D:\BusinessManagementApp\releases\release-$Stamp"
   if((Get-FileHash "$dir\source.zip").Hash -ne $Hash){throw 'Transfer hash mismatch'}
   New-Item -ItemType Directory "$dir\source" | Out-Null
   tar.exe -xf "$dir\source.zip" -C "$dir\source"
   if($LASTEXITCODE -ne 0){throw 'Extract failed'}
   Set-Location "$dir\source"
   foreach($service in @('api','web')) {
    $old=docker inspect "business-management-$service-1" --format '{{.Image}}'
    if($LASTEXITCODE -ne 0){throw 'Old image missing'}
    docker tag $old "business-management-${service}:pre-$Stamp"
    if($LASTEXITCODE -ne 0){throw 'Rollback tag failed'}
    $ErrorActionPreference='Continue'
    docker build --pull=false -t "business-management-${service}:release-$Stamp" -f "deployment/Dockerfile.release-$service" . 2>&1 | ForEach-Object {"$_"}
    if($LASTEXITCODE -ne 0){throw 'Build failed'}
    $ErrorActionPreference='Stop'
   }
   foreach($prefix in @('release','pre')) {
    [IO.File]::WriteAllText("$dir\$prefix.yaml", "services:`n  api:`n    image: business-management-api:${prefix}-$Stamp`n  web:`n    image: business-management-web:${prefix}-$Stamp`n")
   }
   Write-Output "STAGED $dir"
  }
 }
 if($Phase -eq 'Test') {
  Invoke-Command -Session $session -ArgumentList $Stamp -ScriptBlock {
   param($Stamp)
   $ErrorActionPreference='Stop';$dir="D:\BusinessManagementApp\releases\release-$Stamp"
   Set-Location 'D:\BusinessManagementAppTesting\source\deployment\test'
   if(!(Test-Path '.env')){throw 'QA environment missing'}
   $ErrorActionPreference='Continue'
   docker compose -p business-management-test --env-file .env -f compose.yaml -f "$dir\release.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 api web 2>&1 | ForEach-Object {"$_"}
   if($LASTEXITCODE -ne 0){throw 'QA activation failed'}
   $ErrorActionPreference='Stop'
   # Keep test scripts ephemeral; the API filesystem is read-only except /tmp.
   foreach($test in @('verify-v026.cjs','verify-phase3.cjs','verify-phase4.cjs')) {
    if($test -ne 'verify-v026.cjs'){Start-Sleep -Seconds 60}
    $OutputEncoding=[System.Text.UTF8Encoding]::new($false)
    $ErrorActionPreference='Continue'
    Get-Content -Encoding UTF8 -Raw "$dir\source\deployment\test\$test" | docker exec -i business-management-test-api-1 node 2>&1 | ForEach-Object {"$_"}
    if($LASTEXITCODE -ne 0){throw "QA test failed: $test"}
    $ErrorActionPreference='Stop'
   }
   [IO.File]::WriteAllText("$dir\qa-passed.txt",(Get-Date -Format o))
   Write-Output 'PASS QA real API/database/storage gates'
  }
 }
 if($Phase -eq 'Publish') {
  Invoke-Command -Session $session -ArgumentList $Stamp -ScriptBlock {
   param($Stamp)
   $ErrorActionPreference='Stop';$dir="D:\BusinessManagementApp\releases\release-$Stamp";$backup="D:\BusinessManagementApp\backups\preparation\$Stamp"
   if(!(Test-Path "$dir\qa-passed.txt")){throw 'QA gate missing'}
   foreach($entry in (Get-Content "$backup\manifest.json" -Raw | ConvertFrom-Json)) {
    $file=[IO.Path]::GetFullPath((Join-Path $backup $entry.file))
    if(!$file.StartsWith($backup+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Backup path invalid'}
    if((Get-FileHash $file).Hash -ne $entry.sha256){throw 'Backup hash mismatch'}
   }
   $protected=@('business-management-db-1','business-management-storage-1','business-management-db-backup-1','business-management-storage-backup-1','cp-data-system-frontend','cp-data-system-backend','postgis-prod','mysql-prod','business-management-test-web-1','business-management-test-api-1','business-management-test-db-1','business-management-test-storage-1')
   $before=docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
   if($LASTEXITCODE -ne 0){throw 'Isolation baseline failed'}
   [IO.File]::WriteAllLines("$dir\protected-before.txt",[string[]]$before)
   Set-Location 'D:\BusinessManagementApp\app'
   $base=@('compose','-p','business-management','--env-file','D:\BusinessManagementApp\.env','-f','compose.yaml')
   docker @base -f "$dir\release.yaml" config --quiet
   if($LASTEXITCODE -ne 0){throw 'Compose validation failed'}
   try {
    $ErrorActionPreference='Continue'
    foreach($service in @('api','web')) {
     docker @base -f "$dir\release.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 $service 2>&1 | ForEach-Object {"$_"}
     if($LASTEXITCODE -ne 0){throw 'Activation failed'}
    }
    $ErrorActionPreference='Stop'
    $ready=Invoke-RestMethod 'http://127.0.0.1:8088/api/v1/health/ready'
    if($ready.status -ne 'ready'){throw 'Readiness failed'}
    $metadata=Invoke-RestMethod 'http://127.0.0.1:8088/downloads/android.json'
    if($metadata.versionCode -ne 8 -or $metadata.path -ne '/downloads/department-steward-0.2.6.apk'){throw 'Wrong Android metadata'}
    Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8088$($metadata.path)" -OutFile "$dir\verified-download.apk"
    if((Get-FileHash "$dir\verified-download.apk").Hash -ne $metadata.sha256 -or (Get-Item "$dir\verified-download.apk").Length -ne $metadata.size){throw 'Download mismatch'}
    $after=docker inspect @protected --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
    if(@(Compare-Object $before $after).Count){throw 'Protected container changed; inspect concurrent activity'}
    [IO.File]::WriteAllLines("$dir\protected-after.txt",[string[]]$after)
    foreach($file in (Get-ChildItem "$dir\source" -Recurse -File)) {
     $relative=$file.FullName.Substring(("$dir\source").Length+1)
     $target=[IO.Path]::GetFullPath((Join-Path 'D:\BusinessManagementApp\app' $relative))
     if(!$target.StartsWith('D:\BusinessManagementApp\app\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source path invalid'}
     New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
     Copy-Item -LiteralPath $file.FullName -Destination $target
    }
    foreach($service in @('api','web')) {docker tag "business-management-${service}:release-$Stamp" "business-management-${service}:0.2.0";if($LASTEXITCODE -ne 0){throw 'Image alias failed'}}
    $result=@{publishedAt=(Get-Date -Format o);version='0.2.6';ready=$ready.status;apkSha256=$metadata.sha256;protectedUnchanged=$true;backup=$backup}
    [IO.File]::WriteAllText("$dir\published.json",($result|ConvertTo-Json));$result|ConvertTo-Json
   } catch {
    $failure=$_;$ErrorActionPreference='Continue'
    docker @base -f "$dir\pre.yaml" up -d --no-deps --no-build --wait --wait-timeout 180 api web 2>&1 | ForEach-Object {"$_"}
    if($LASTEXITCODE -ne 0){Write-Output 'ATTENTION rollback failed'}
    throw $failure
   }
  }
 }
} finally {Remove-PSSession $session}
