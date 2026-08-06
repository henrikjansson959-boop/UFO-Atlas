[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Stop-PortListener {
    param(
        [Parameter(Mandatory)]
        [int]$Port,

        [Parameter(Mandatory)]
        [string]$Name
    )

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
        Write-Host "[OK] $Name is already stopped." -ForegroundColor Green
        return
    }

    $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Stopping $Name (PID $processId, $($process.ProcessName))..."
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
            }
            catch {
                if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
                    Write-Warning "Could not stop $Name process $processId`: $($_.Exception.Message)"
                }
                else {
                    Write-Host "[OK] $Name stopped while shutdown was in progress." -ForegroundColor Green
                }
            }
        }
    }
}

Write-Host 'Stopping UFO Atlas...' -ForegroundColor Cyan

Stop-PortListener -Port 5173 -Name 'UFO Atlas website'
Stop-PortListener -Port 3005 -Name 'UFO Atlas API'

try {
    & lms server stop | Out-Host
}
catch {
    Write-Warning "LM Studio server could not be stopped through lms: $($_.Exception.Message)"
}

Write-Host 'UFO Atlas is stopped.' -ForegroundColor Green
