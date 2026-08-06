[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDirectory = Join-Path $repoRoot 'logs'
$modelKey = 'google/gemma-4-e4b'
$websiteUrl = 'http://127.0.0.1:5173/admin/scan'

function Test-LocalPort {
    param(
        [Parameter(Mandatory)]
        [int]$Port
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(500)) {
            return $false
        }

        $client.EndConnect($connection)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Wait-LocalPort {
    param(
        [Parameter(Mandatory)]
        [int]$Port,

        [Parameter(Mandatory)]
        [string]$Name,

        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalPort -Port $Port) {
            Write-Host "[OK] $Name is ready on port $Port" -ForegroundColor Green
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "$Name did not become ready on port $Port within $TimeoutSeconds seconds."
}

Set-Location $repoRoot
New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null

$null = Get-Command node -ErrorAction Stop
$npmCommand = Get-Command npm.cmd -ErrorAction Stop
$null = Get-Command lms -ErrorAction Stop

if (-not (Test-Path (Join-Path $repoRoot '.env'))) {
    throw 'The root .env file is missing. UFO Atlas cannot connect to its configured services.'
}

Write-Host 'Starting UFO Atlas...' -ForegroundColor Cyan

if (-not (Test-LocalPort -Port 1234)) {
    Write-Host 'Starting the LM Studio API and loading Gemma 4 E4B...'
    & lms server start --port 1234 | Out-Host
}
else {
    Write-Host '[OK] LM Studio API is already running.' -ForegroundColor Green
}

$loadedModels = (& lms ps --json 2>$null) -join ''
if ($loadedModels -notmatch [regex]::Escape($modelKey)) {
    & lms load $modelKey --identifier $modelKey --yes | Out-Host
}
else {
    Write-Host '[OK] Gemma 4 E4B is already loaded.' -ForegroundColor Green
}
Wait-LocalPort -Port 1234 -Name 'LM Studio API'

if (-not (Test-LocalPort -Port 3005)) {
    Write-Host 'Starting the UFO Atlas API...'
    Start-Process `
        -FilePath $npmCommand.Source `
        -ArgumentList @('run', 'api') `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logsDirectory 'api.log') `
        -RedirectStandardError (Join-Path $logsDirectory 'api.error.log') | Out-Null
}
else {
    Write-Host '[OK] UFO Atlas API is already running.' -ForegroundColor Green
}
Wait-LocalPort -Port 3005 -Name 'UFO Atlas API'

if (-not (Test-LocalPort -Port 5173)) {
    Write-Host 'Starting the UFO Atlas website...'
    Start-Process `
        -FilePath $npmCommand.Source `
        -ArgumentList @('--prefix', 'website', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173') `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logsDirectory 'website.log') `
        -RedirectStandardError (Join-Path $logsDirectory 'website.error.log') | Out-Null
}
else {
    Write-Host '[OK] UFO Atlas website is already running.' -ForegroundColor Green
}
Wait-LocalPort -Port 5173 -Name 'UFO Atlas website'

try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/v1/models' -TimeoutSec 10
    Write-Host '[OK] Gemma API responded.' -ForegroundColor Green
}
catch {
    throw "LM Studio is listening, but its models API did not respond: $($_.Exception.Message)"
}

try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:3005/api/system/status' -TimeoutSec 15
    Write-Host '[OK] UFO Atlas API responded.' -ForegroundColor Green
}
catch {
    throw "The UFO Atlas API is listening, but its status check failed: $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'UFO Atlas is ready.' -ForegroundColor Green
Write-Host $websiteUrl

if (-not $NoBrowser) {
    Start-Process $websiteUrl
}
