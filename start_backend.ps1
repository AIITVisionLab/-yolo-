param(
    [string]$ListenHost = "127.0.0.1",
    [int]$Port = 7800
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot "plantbackend"

if (-not (Test-Path $backendDir)) {
    Write-Error "Backend directory not found: $backendDir"
    exit 1
}

$pythonCandidates = @(
    (Join-Path $projectRoot ".venv-train\Scripts\python.exe"),
    (Join-Path $backendDir ".venv-train\Scripts\python.exe"),
    (Join-Path $projectRoot ".backend-venv\Scripts\python.exe"),
    (Join-Path $projectRoot ".venv\Scripts\python.exe"),
    (Join-Path $backendDir ".venv\Scripts\python.exe")
)

$pythonExe = $null
foreach ($candidate in $pythonCandidates) {
    if (-not (Test-Path $candidate)) {
        continue
    }

    & $candidate -c "import fastapi, uvicorn" *> $null
    if ($LASTEXITCODE -eq 0) {
        $pythonExe = $candidate
        break
    }
}

if (-not $pythonExe) {
    $requirementsPath = Join-Path $backendDir "requirements.txt"
    Write-Host "No usable Python environment with uvicorn was found." -ForegroundColor Yellow
    Write-Host "Checked:" -ForegroundColor Yellow
    foreach ($candidate in $pythonCandidates) {
        Write-Host "  $candidate" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Install dependencies with one of these commands:" -ForegroundColor Cyan
    foreach ($candidate in $pythonCandidates) {
        Write-Host "  $candidate -m pip install -r $requirementsPath" -ForegroundColor Cyan
    }
    exit 1
}

function Test-PortAvailable {
    param(
        [int]$CandidatePort
    )

    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($ListenHost), $CandidatePort)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

$portCandidates = @($Port, ($Port + 1), ($Port + 2), 8000, 8001) | Select-Object -Unique
$selectedPort = $null
foreach ($candidatePort in $portCandidates) {
    if (Test-PortAvailable -CandidatePort $candidatePort) {
        $selectedPort = $candidatePort
        break
    }
}

if (-not $selectedPort) {
    Write-Error "No available backend port was found. Tried: $($portCandidates -join ', ')"
    exit 1
}

Write-Host "Using Python:" -ForegroundColor Green
Write-Host "  $pythonExe" -ForegroundColor Green
if ($selectedPort -ne $Port) {
    Write-Host "Port $Port is unavailable, falling back to $selectedPort." -ForegroundColor Yellow
}
Write-Host "Starting backend on http://$ListenHost`:$selectedPort" -ForegroundColor Green

Push-Location $backendDir
try {
    & $pythonExe -m uvicorn asgi:app --host $ListenHost --port $selectedPort
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
