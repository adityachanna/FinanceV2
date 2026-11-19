param(
  [string]$FrontendUrl = 'http://127.0.0.1:5173',
  [string]$BackendUrl = 'http://127.0.0.1:5000',
  [string]$PythonUrl = 'http://127.0.0.1:4000'
)

$ErrorActionPreference = 'Stop'

function Check-Json($label, $url) {
  try {
    $result = Invoke-RestMethod -Uri $url -TimeoutSec 90
    Write-Host "[OK] $label" -ForegroundColor Green
    return $result
  } catch {
    Write-Host "[FAIL] $label - $($_.Exception.Message)" -ForegroundColor Red
    throw
  }
}

try {
  $page = Invoke-WebRequest -UseBasicParsing -Uri $FrontendUrl -TimeoutSec 15
  if ($page.StatusCode -ne 200) { throw "Frontend returned HTTP $($page.StatusCode)" }
  Write-Host '[OK] Frontend' -ForegroundColor Green
  $python = Check-Json 'Python HSMM service' "$PythonUrl/api/market/regimes"
  if (($python.regimes | Measure-Object).Count -ne 3) { throw 'Expected three explicit-duration HSMM states' }
  $health = Check-Json 'Express API' "$BackendUrl/health"
  $condition = Check-Json 'Regime classification through Express' "$BackendUrl/api/market/condition"
  if (-not $condition.data.regime.label) { throw 'Regime label missing from Express response' }
  $pulse = Check-Json 'Macro Pulse through Express' "$BackendUrl/api/market/macro-pulse"
  $available = @($pulse.data.instruments | Where-Object { $_.status -eq 'live' -and $null -ne $_.price })
  if ($available.Count -ne 4) { throw "Macro Pulse returned $($available.Count) of 4 prices" }
  $stocks = Check-Json 'Stock search' "$BackendUrl/api/stocks/search?q=AAPL"
  if (-not $stocks.data.results) { throw 'Stock search returned no results' }
  $news = Check-Json 'Company news' "$BackendUrl/api/stocks/AAPL/news?max_news=3"
  if (-not $news.data.news_data) { throw 'Company news returned no articles' }
  if (@($news.data.news_data | Where-Object { -not $_.url -or -not $_.published_at }).Count) {
    throw 'Company news is missing article links or publication dates'
  }
  $snapshot = Check-Json 'Risk scenarios' "$BackendUrl/api/research/snapshot?horizon=21"
  if (-not $snapshot.data.snapshot_id) { throw 'Snapshot identifier missing' }
  $replay = Check-Json 'Historical replay' "$BackendUrl/api/research/replay?as_of=2020-03-16&horizon=21"
  if ($replay.data.outcome) { throw 'Replay revealed the outcome before requested' }
  if ($replay.data.training_end -ge $replay.data.as_of) { throw 'Replay model was trained after the selected observation' }
  $evaluation = Check-Json 'Model evaluation' "$BackendUrl/api/research/evaluation"
  if ($evaluation.data.status -ne 'complete') { throw 'Model evaluation is incomplete' }
  if (-not $evaluation.data.fit_diagnostics) { throw 'Model fitting diagnostics are missing' }
  if (@($evaluation.data.fit_diagnostics | Where-Object { $_.iteration_budget_reached }).Count) {
    throw 'An evaluated model exhausted its fitting iteration budget'
  }
  Write-Host 'All local checks passed.' -ForegroundColor Green
} catch {
  Write-Host "Local check failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
