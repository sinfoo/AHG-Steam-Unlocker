$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$proc = Start-Process $exePath -ArgumentList "--remote-debugging-port=9222" -PassThru
Start-Sleep 3
if ($proc.HasExited) {
    Write-Host "[EXIT] Exit code: $($proc.ExitCode)"
} else {
    Write-Host "[PID] $($proc.Id)"
    try {
        $response = Invoke-RestMethod "http://localhost:9222/json" -TimeoutSec 3
        Write-Host "[DEBUG] Pages: $($response.Count)"
        $response | ForEach-Object { Write-Host "  - $($_.title) - $($_.url)" }
    } catch {
        Write-Host "[DEBUG] Could not connect"
    }
    Stop-Process $proc.Id -Force -EA SilentlyContinue
}