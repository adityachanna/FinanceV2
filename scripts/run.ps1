# One-click setup and launch for AlphaSharp on Windows.
# Installs what is missing, starts the three services, opens the browser,
# and stops everything when the window is closed or a key is pressed.
param([switch]$NoBrowser, [switch]$NoWait)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$python = Join-Path $root 'Finance-v1'
$backend = Join-Path $root 'AlphaSharp/backend'
$frontend = Join-Path $root 'AlphaSharp/frontend'
$venvPython = Join-Path $python '.venv/Scripts/python.exe'

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) {
  Write-Host ""; Write-Host "Setup stopped: $text" -ForegroundColor Red
  Write-Host "Send a screenshot of this window to whoever shared AlphaSharp with you."
  if (-not $NoWait) { Read-Host 'Press Enter to close' | Out-Null }
  exit 1
}
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Find-Python {
  foreach ($candidate in @(@('py', '-3.13'), @('py', '-3.12'), @('py', '-3.14'), @('python'), @('python3'))) {
    $exe = Get-Command $candidate[0] -ErrorAction SilentlyContinue
    if (-not $exe) { continue }
    $probe = @($candidate | Select-Object -Skip 1) + @('-c', 'import sys; print(sys.version_info[0]*100+sys.version_info[1])')
    try { $version = [int](& $exe.Source @probe 2>$null) } catch { continue }
    if ($version -ge 312 -and $version -le 314) { return @{ Exe = $exe.Source; Args = @($candidate | Select-Object -Skip 1) } }
  }
  return $null
}
function Install-WithWinget($id, $label) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail "$label is not installed and winget is unavailable. Install $label yourself, then run this again."
  }
  Write-Host "Installing $label. Windows may ask for permission." -ForegroundColor Yellow
  winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements | Out-Host
  Refresh-Path
}
function Hash-File($path) { (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash }

Write-Host "AlphaSharp setup" -ForegroundColor Green
Write-Host "The first run downloads about 1 GB and takes 5-15 minutes. Later runs start in under a minute."

Step 'Checking Python'
$py = Find-Python
if (-not $py) { Install-WithWinget 'Python.Python.3.13' 'Python 3.13'; $py = Find-Python }
if (-not $py) { Fail 'Python 3.12-3.14 could not be found after installation. Restart the computer and run this again.' }
Write-Host "Using $($py.Exe) $($py.Args)"

Step 'Checking Node.js'
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  try { $nodeOk = [int]((node --version).Trim().TrimStart('v').Split('.')[0]) -ge 20 } catch { $nodeOk = $false }
}
if (-not $nodeOk) { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js could not be found after installation. Restart the computer and run this again.' }
Write-Host "Using Node $(node --version)"

Step 'Preparing the Python model service'
if (-not (Test-Path -LiteralPath $venvPython)) {
  & $py.Exe @($py.Args) -m venv (Join-Path $python '.venv')
  if ($LASTEXITCODE) { Fail 'Could not create the Python environment.' }
}
$requirements = Join-Path $python 'requirements.txt'
$stamp = Join-Path $python '.venv/requirements.sha256'
$wanted = Hash-File $requirements
if (-not (Test-Path -LiteralPath $stamp) -or (Get-Content -LiteralPath $stamp -Raw).Trim() -ne $wanted) {
  & $venvPython -m pip install --disable-pip-version-check -q --upgrade pip
  & $venvPython -m pip install --disable-pip-version-check -r $requirements
  if ($LASTEXITCODE) { Fail 'Installing Python packages failed. Check your internet connection and run this again.' }
  Set-Content -LiteralPath $stamp -Value $wanted
} else { Write-Host 'Python packages are up to date.' }

foreach ($app in @($backend, $frontend)) {
  $name = Split-Path -Leaf $app
  Step "Preparing the $name"
  $lock = Join-Path $app 'package-lock.json'
  $stamp = Join-Path $app 'node_modules/.alphasharp-lock.sha256'
  $wanted = Hash-File $lock
  if (-not (Test-Path -LiteralPath $stamp) -or (Get-Content -LiteralPath $stamp -Raw).Trim() -ne $wanted) {
    Push-Location $app
    npm ci --no-audit --no-fund --loglevel=error
    $code = $LASTEXITCODE
    Pop-Location
    if ($code) { Fail "Installing the $name packages failed. Check your internet connection and run this again." }
    Set-Content -LiteralPath $stamp -Value $wanted
  } else { Write-Host 'Packages are up to date.' }
}

Step 'Checking settings'
$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile) -and -not (Test-Path -LiteralPath (Join-Path $python '.env'))) {
  Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $envFile
  Write-Host 'Created .env. AlphaSharp works without an AI key and uses its built-in analyst.'
  Write-Host 'To turn on AI answers later, paste an OpenRouter key into the .env file in this folder.'
} else { Write-Host 'Using the existing .env file.' }

New-Item -ItemType Directory -Force -Path (Join-Path $root '.local-logs') | Out-Null
Step 'Fetching the latest market closes'
Push-Location $python
& $venvPython -m research.data *> (Join-Path $root '.local-logs/data-refresh.log')
if ($LASTEXITCODE) { Write-Host 'Could not refresh market data (offline?). Using the saved data.' -ForegroundColor Yellow } else { Write-Host 'Market data is up to date.' }
Pop-Location

Step 'Starting AlphaSharp'
try { & (Join-Path $root 'start-local.ps1') }
catch { Fail "$($_.Exception.Message) Logs are in the .local-logs folder." }

if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
Write-Host ""
Write-Host "AlphaSharp is running at http://127.0.0.1:5173" -ForegroundColor Green
if ($NoWait) { exit 0 }
Write-Host "Keep this window open while you use it. Press Enter here to stop AlphaSharp."
Read-Host | Out-Null
& (Join-Path $root 'stop-local.ps1')
