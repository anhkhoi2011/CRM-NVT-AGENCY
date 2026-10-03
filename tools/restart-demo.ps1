# Restart only the local demo after saving its latest state.
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$listener = @(Get-NetTCPConnection -LocalPort 4173 -State Listen)
$processIds = @($listener | Select-Object -ExpandProperty OwningProcess -Unique)
if ($processIds.Count -ne 1) { throw 'Expected exactly one demo listening on port 4173.' }
$demoProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($processIds[0])"
if ($demoProcess.Name -ne 'node.exe' -or $demoProcess.CommandLine.Trim() -notmatch 'tools[/\\]demo-server\.cjs$') { throw 'Port 4173 is not the expected demo server.' }
$loginBody = @{ identifier = 'admin.demo@local.test'; password = 'AdminDemo2026!' } | ConvertTo-Json
$session = Invoke-RestMethod -Uri 'http://localhost:4173/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = "Bearer $($session.token)" }
$snapshot = Invoke-RestMethod -Uri 'http://localhost:4173/api/state' -Headers $headers
if ($null -eq $snapshot.state -or $null -eq $snapshot.state.orders) { throw 'Could not save demo state.' }
$allAccounts = @($snapshot.state.accounts)
if (@($allAccounts | Where-Object { $_.email -notlike '*.demo@local.test' }).Count -gt 0) { throw 'Custom demo accounts detected. Preserve their credentials before restarting.' }
if ($allAccounts.Count -gt 0) { $snapshot.state.members = $allAccounts }
$snapshotDir = Join-Path $workspace 'tmp'
[void](New-Item -ItemType Directory -Path $snapshotDir -Force)
$snapshotPath = Join-Path $snapshotDir ('demo-state-restart-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
[System.IO.File]::WriteAllText($snapshotPath, ($snapshot.state | ConvertTo-Json -Depth 100), (New-Object System.Text.UTF8Encoding($false)))
Stop-Process -Id $demoProcess.ProcessId
$previousStateFile = $env:DEMO_STATE_FILE
try {
  $env:DEMO_STATE_FILE = $snapshotPath
  Start-Process -FilePath (Get-Command node).Source -ArgumentList 'tools/demo-server.cjs' -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workspace 'demo-server.log') -RedirectStandardError (Join-Path $workspace 'demo-server-error.log')
} finally { $env:DEMO_STATE_FILE = $previousStateFile }
Write-Host "Demo restarting at http://localhost:4173. State saved to $snapshotPath"
