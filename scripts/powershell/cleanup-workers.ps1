<#
.SYNOPSIS
  Clean up orphaned/stale Node.js worker processes that cause "Worker has been terminated" errors.

.DESCRIPTION
  The "Worker has been terminated" error occurs when OpenCode cannot spawn subagent workers
  because too many Node.js processes (orphaned npx wrappers, stale vite instances, duplicate MCPs)
  are consuming process slots and system handles.
  
  This script:
  1. Identifies all node processes and their command lines
  2. Kills orphaned processes whose parent is dead
  3. Kills stale Vite duplicates (keeps only the active one)
  4. Reports what was cleaned up

.EXAMPLE
  .\scripts\powershell\cleanup-workers.ps1

.NOTES
  Safe to run at any time — kills ONLY orphans and duplicates, never the active MCPs or OpenCode itself.
#>

$ErrorActionPreference = "Stop"
$host.ui.RawUI.WindowTitle = "Worker Cleanup"

Write-Host "[SCAN] Scanning for orphaned/stale Node.js processes..." -ForegroundColor Cyan

# Helper: get command line for a process
function Get-CommandLine($proc) {
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
    return $cim.CommandLine
}

# Get all node processes
$allNodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue
Write-Host "  Total node processes found: $($allNodeProcs.Count)" -ForegroundColor Gray

# Classify each process
$categorized = @{ npxWrappers = @{}; npxChildren = @{}; direct = @{}; vite = @{} }
$killed = @()

foreach ($p in $allNodeProcs) {
    $cmd = Get-CommandLine $p
    if (-not $cmd) { continue }
    
    if ($cmd -match 'npx-cli\.js') {
        $categorized.npxWrappers[$p.Id] = $p
    } elseif ($cmd -match '_npx\\.+\\node_modules') {
        $categorized.npxChildren[$p.Id] = $p
    } elseif ($cmd -match 'vite') {
        $categorized.vite[$p.Id] = $p
    } else {
        $categorized.direct[$p.Id] = $p
    }
}

Write-Host "  npx wrappers: $($categorized.npxWrappers.Count)" -ForegroundColor Gray
Write-Host "  npx children: $($categorized.npxChildren.Count)" -ForegroundColor Gray
Write-Host "  direct: $($categorized.direct.Count)" -ForegroundColor Gray
Write-Host "  vite: $($categorized.vite.Count)" -ForegroundColor Gray

# Kill npx wrappers whose parent (OpenCode) is dead
foreach ($id in $categorized.npxWrappers.Keys) {
    $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue).ParentProcessId
    if (-not $parentPid) { continue }
    $parentAlive = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
    $isOrphan = -not $parentAlive -or ($parentAlive.ProcessName -notlike '*opencode*' -and $parentAlive.ProcessName -ne 'node')
    
    if ($isOrphan) {
        Write-Host "  [WARN] Orphaned npx wrapper PID $id (parent PID $parentPid is dead/unrelated)" -ForegroundColor Yellow
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        $killed += $id
    }
}

# Kill npx children whose parent (npx wrapper) is already dead
foreach ($id in $categorized.npxChildren.Keys) {
    $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue).ParentProcessId
    if (-not $parentPid) { continue }
    $parentAlive = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
    
    if (-not $parentAlive) {
        Write-Host "  [WARN] Orphaned npx child PID $id (parent PID $parentPid is dead)" -ForegroundColor Yellow
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        $killed += $id
    }
}

# Kill stale Vite duplicates (keep the one with most handles)
if ($categorized.vite.Count -gt 1) {
    $activeVite = $categorized.vite.Values | Sort-Object HandleCount -Descending | Select-Object -First 1
    foreach ($id in $categorized.vite.Keys) {
        if ($id -ne $activeVite.Id) {
            $v = $categorized.vite[$id]
            $vMem = [math]::Round($v.WorkingSet64 / 1MB, 1)
            Write-Host "  [WARN] Stale Vite PID $id ($vMem MB, handles: $($v.HandleCount)) - keeping PID $($activeVite.Id)" -ForegroundColor Yellow
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
            $killed += $id
        }
    }
}

# Summary
Write-Host ""
if ($killed.Count -gt 0) {
    Write-Host "[DONE] Killed $($killed.Count) orphaned/stale process(es): $($killed -join ', ')" -ForegroundColor Red
} else {
    Write-Host "[OK] No orphaned/stale processes found" -ForegroundColor Green
}

Write-Host ""
$remaining = Get-Process -Name node -ErrorAction SilentlyContinue
Write-Host "[STATUS] Post-cleanup status:" -ForegroundColor Cyan
Write-Host "  Remaining node processes: $($remaining.Count)" -ForegroundColor White
$totalMem = [math]::Round(($remaining | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB, 1)
Write-Host "  Total node memory: $totalMem MB" -ForegroundColor White
Write-Host ""
Write-Host "[TIP] Run this script at the START of each session to prevent 'Worker has been terminated'." -ForegroundColor Green
