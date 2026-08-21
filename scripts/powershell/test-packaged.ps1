$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$errLog = "$env:TEMP\electron_err.log"
$outLog = "$env:TEMP\electron_out.log"
$proc = Start-Process $exePath -ArgumentList "--disable-gpu","--no-sandbox","--enable-logging","--v=1" -PassThru -RedirectStandardError $errLog -RedirectStandardOutput $outLog
Start-Sleep 5
if ($proc.HasExited) {
    Write-Host "[EXIT] Exit code: $($proc.ExitCode)"
}
if (Test-Path $errLog) {
    $errContent = Get-Content $errLog -Raw
    if ($errContent) { Write-Host "[STDERR]`n$errContent" }
}
if (Test-Path $outLog) {
    $outContent = Get-Content $outLog -Raw
    if ($outContent) { Write-Host "[STDOUT]`n$outContent" }
}
if (!$proc.HasExited) {
    Stop-Process $proc.Id -Force -EA SilentlyContinue
}
Remove-Item $errLog, $outLog -EA SilentlyContinue