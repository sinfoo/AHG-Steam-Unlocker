# Start Vite, wait, run Playwright test, cleanup
$viteDir = "C:\Users\USER\Downloads\filesOPENCODE"

Write-Output "Starting Vite dev server..."
$vite = Start-Process -NoNewWindow -FilePath "npx.cmd" -ArgumentList "vite --port 5173" -WorkingDirectory $viteDir -PassThru -RedirectStandardOutput "$viteDir\vite.log" -RedirectStandardError "$viteDir\vite.err"

# Wait for "ready in" message in log
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 1000
    if (Test-Path "$viteDir\vite.log") {
        $log = Get-Content "$viteDir\vite.log" -Tail 5 -ErrorAction SilentlyContinue
        if ($log -match "ready in|Local:") {
            $ready = $true
            break
        }
    }
}

if ($ready) {
    Write-Output "Vite ready! Running Playwright test..."
    node e2e/nav-test.mjs 2>&1
    $exitCode = $LASTEXITCODE
    Write-Output "Playwright exit code: $exitCode"
} else {
    Write-Output "Vite failed to start in time"
    Get-Content "$viteDir\vite.log" -ErrorAction SilentlyContinue
    Get-Content "$viteDir\vite.err" -ErrorAction SilentlyContinue
}

Write-Output "Cleaning up..."
Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
Remove-Item "$viteDir\vite.log" -Force -ErrorAction SilentlyContinue
Remove-Item "$viteDir\vite.err" -Force -ErrorAction SilentlyContinue
