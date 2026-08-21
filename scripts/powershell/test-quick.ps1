$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$proc = Start-Process $exePath -PassThru
Start-Sleep 4
if ($proc.HasExited) {
    Write-Host "[EXIT] $($proc.ExitCode)"
} else {
    Write-Host "[OK] Running PID: $($proc.Id)"
    Start-Sleep 2
    Stop-Process $proc.Id -Force -EA SilentlyContinue
}