$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'Finance-v1/data/research/active_model.json'))) {
  throw 'The trained model is missing. Run: cd Finance-v1; python -m research.train'
}
$venvPython = Join-Path $projectRoot 'Finance-v1/.venv/Scripts/python.exe'
$pythonExe = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { (Get-Command python).Source }
$logDirectory = Join-Path $projectRoot '.local-logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$services = @(
  @{ Name='python'; Port=4000; Executable=$pythonExe; Directory='Finance-v1'; Arguments=@('-m','uvicorn','combined_api:app','--host','127.0.0.1','--port','4000') },
  @{ Name='api'; Port=5000; Executable=(Get-Command node).Source; Directory='AlphaSharp/backend'; Arguments=@('server.js') },
  @{ Name='frontend'; Port=5173; Executable=(Get-Command node).Source; Directory='AlphaSharp/frontend'; Arguments=@('node_modules/vite/bin/vite.js','--host','127.0.0.1') }
)
$started = @()
$stateFile = Join-Path $logDirectory 'processes.json'
if (Test-Path -LiteralPath $stateFile) {
  $records = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  foreach ($record in $records) {
    $running = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($running -and $running.StartTime.ToUniversalTime().ToString('o') -eq $record.started) { $started += $record }
  }
}
foreach ($service in $services) {
  if (Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue) {
    Write-Host "$($service.Name): port $($service.Port) is already listening. Using the running service."
    continue
  }
  $process = Start-Process -FilePath $service.Executable -ArgumentList $service.Arguments -WorkingDirectory (Join-Path $projectRoot $service.Directory) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "$($service.Name).log") -RedirectStandardError (Join-Path $logDirectory "$($service.Name).err.log")
  $started += @{ name=$service.Name; pid=$process.Id; started=$process.StartTime.ToUniversalTime().ToString('o') }
  Write-Host "$($service.Name): started on port $($service.Port)."
}
if ($started.Count) { $started | ConvertTo-Json | Set-Content $stateFile }
foreach ($service in $services) {
  $path = if ($service.Name -eq 'api') { '/health' } else { '/' }
  $deadline = [DateTime]::UtcNow.AddSeconds(120)
  $ready = $false
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$($service.Port)$path" -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ready) { throw "$($service.Name) did not become ready. Check .local-logs/$($service.Name).err.log" }
}
Write-Host 'Open http://127.0.0.1:5173. Logs are in .local-logs. Run check-local.ps1 after startup.'
