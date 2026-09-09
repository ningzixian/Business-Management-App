$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $target) { throw 'Test credentials already exist; will not overwrite.' }
function New-TestSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return 'Qa!' + [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant() + 'Z9'
}
$content = @('QA_DB_PASSWORD=' + (New-TestSecret); 'QA_JWT_SECRET=' + (New-TestSecret); 'QA_STORAGE_PASSWORD=' + (New-TestSecret); 'QA_TEST_PASSWORD=' + (New-TestSecret)) -join "`n"
[IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
# Do not print credentials. Keep this ignored file on the test host only.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $target /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' 'BUILTIN\Administrators:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Credentials created but ACL restriction failed; fix before starting tests.' }
Write-Output 'Isolated test credentials created with restricted file permissions.'
