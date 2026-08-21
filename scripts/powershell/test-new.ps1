$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$proc = Start-Process $exePath -PassThru
Start-Sleep 5
if ($proc.HasExited) {
    Write-Host "[EXIT] Exit code: $($proc.ExitCode)"
} else {
    Write-Host "[OK] App running with PID: $($proc.Id)"
    Stop-Process $proc.Id -Force -EA SilentlyContinue
}