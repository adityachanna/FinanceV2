$ErrorActionPreference = 'Stop'
$stateFile = Join-Path $PSScriptRoot '.local-logs/processes.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Host 'No services started by start-local.ps1 are recorded.'; exit }
$records = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
foreach ($service in $records) {
  $process = Get-Process -Id $service.pid -ErrorAction SilentlyContinue
  if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $service.started) {
    Stop-Process -Id $process.Id
    Write-Host "Stopped $($service.name)."
  }
}
