$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$proc = Start-Process $exePath -PassThru
Start-Sleep 6
if ($proc.HasExited) {
    Write-Host "[EXIT] $($proc.ExitCode)"
} else {
    Write-Host "[OK] Running PID: $($proc.Id)"
    $title = (Get-Process -Id $proc.Id).MainWindowTitle
    Write-Host "[TITLE] $title"
    Start-Sleep 3
    Stop-Process $proc.Id -Force -EA SilentlyContinue
}