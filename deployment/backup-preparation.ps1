param([Parameter(Mandatory=$true)][pscredential]$Credential,
      [Parameter(Mandatory=$true)][ValidatePattern('^\d{8}-\d{6}$')][string]$Stamp)
$ErrorActionPreference = 'Stop'
Invoke-Command -ComputerName 192.168.0.253 -Credential $Credential -ArgumentList $Stamp -ScriptBlock {
  param($Stamp)
  $ErrorActionPreference = 'Stop'
  $directory = "D:\BusinessManagementApp\backups\preparation\$Stamp"
  if (Test-Path -LiteralPath $directory) { throw 'Backup target already exists; refusing overwrite' }
  New-Item -ItemType Directory -Path $directory | Out-Null
  icacls.exe $directory /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Backup ACL failed' }
  $containers = @('business-management-web-1','business-management-api-1','business-management-db-1','business-management-storage-1','cp-data-system-frontend','cp-data-system-backend','postgis-prod','mysql-prod')
  $before = docker inspect @containers --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
  if ($LASTEXITCODE -ne 0) { throw 'Baseline inspect failed' }
  [IO.File]::WriteAllLines((Join-Path $directory 'containers-before.txt'), [string[]]$before)
  # Only these business backup containers and their /backups mount are used.
  $ErrorActionPreference = 'Continue'
  docker exec business-management-db-backup-1 sh -c 'set -eu; dir=/tmp/preparation-$1; mkdir -p $dir; pg_dump --format=custom --no-owner --no-privileges --file=$dir/database.dump; pg_restore --list $dir/database.dump > $dir/database-toc.txt; sha256sum $dir/database.dump' sh $Stamp 2>&1 | ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) { throw 'Database backup failed' }
  # Docker Desktop archive-copy cannot see this tmpfs reliably; transfer bytes via base64.
  $encoded = docker exec business-management-db-backup-1 base64 "/tmp/preparation-$Stamp/database.dump"
  if ($LASTEXITCODE -ne 0) { throw 'Database transfer failed' }
  [IO.File]::WriteAllBytes((Join-Path $directory 'database.dump'), [Convert]::FromBase64String(($encoded -join '')))
  $toc = docker exec business-management-db-backup-1 cat "/tmp/preparation-$Stamp/database-toc.txt"
  if ($LASTEXITCODE -ne 0) { throw 'Database TOC transfer failed' }
  [IO.File]::WriteAllLines((Join-Path $directory 'database-toc.txt'), [string[]]$toc)
  docker exec business-management-storage-backup-1 sh -c 'set -eu; dir=/tmp/preparation-$1/attachments; mkdir -p $dir; mc mirror business-storage/$MINIO_BUCKET $dir' sh $Stamp 2>&1 | ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) { throw 'Attachment snapshot failed' }
  $encoded = docker exec business-management-storage-backup-1 sh -c 'tar -C /tmp/preparation-$1/attachments -cf - . | base64' sh $Stamp
  if ($LASTEXITCODE -ne 0) { throw 'Attachment transfer failed' }
  [IO.File]::WriteAllBytes((Join-Path $directory 'attachments.tar'), [Convert]::FromBase64String(($encoded -join '')))
  New-Item -ItemType Directory -Path (Join-Path $directory 'attachments') | Out-Null
  tar.exe -xf (Join-Path $directory 'attachments.tar') -C (Join-Path $directory 'attachments')
  if ($LASTEXITCODE -ne 0) { throw 'Attachment archive verification failed' }
  $ErrorActionPreference = 'Stop'
  tar.exe -a -c -f (Join-Path $directory 'deployed-source.zip') --exclude=node_modules --exclude=.git --exclude=dist --exclude=build --exclude=.env --exclude=.preparation -C D:\BusinessManagementApp\app .
  if ($LASTEXITCODE -ne 0) { throw 'Deployed source archive failed' }
  Copy-Item -LiteralPath D:\BusinessManagementApp\.env -Destination (Join-Path $directory 'production.env')
  $webImage = docker inspect business-management-web-1 --format '{{.Image}}'
  $apiImage = docker inspect business-management-api-1 --format '{{.Image}}'
  docker image save -o (Join-Path $directory 'business-runtime-images.tar') $webImage $apiImage
  if ($LASTEXITCODE -ne 0) { throw 'Business runtime image backup failed' }
  $inventory = Get-ChildItem -LiteralPath $directory -Recurse -File | ForEach-Object {
    [pscustomobject]@{file=$_.FullName.Substring($directory.Length+1);bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash}
  }
  [IO.File]::WriteAllText((Join-Path $directory 'manifest.json'), ($inventory | ConvertTo-Json -Depth 4))
  $after = docker inspect @containers --format '{{.Name}}|{{.Id}}|{{.Image}}|{{.RestartCount}}|{{.State.StartedAt}}|{{json .HostConfig.PortBindings}}'
  if ($LASTEXITCODE -ne 0) { throw 'Post backup inspect failed' }
  [IO.File]::WriteAllLines((Join-Path $directory 'containers-after.txt'), [string[]]$after)
  $changed = @(Compare-Object $before $after)
  [pscustomobject]@{backup=$directory;files=$inventory.Count;containerChanges=$changed.Count;databaseBytes=(Get-Item (Join-Path $directory 'database.dump')).Length;attachmentFiles=@(Get-ChildItem (Join-Path $directory 'attachments') -Recurse -File).Count}
  if ($changed.Count) { throw 'Container identity/state changed concurrently; inspect before proceeding' }
}
