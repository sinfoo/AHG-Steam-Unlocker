$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$errLog = "$env:TEMP\electron_err_$PID.log"
$outLog = "$env:TEMP\electron_out_$PID.log"
$proc = Start-Process $exePath -ArgumentList "--disable-gpu","--no-sandbox","--enable-logging","--v=1" -PassThru -RedirectStandardError $errLog -RedirectStandardOutput $outLog
Start-Sleep 5
$errContent = ""
$outContent = ""
if (Test-Path $errLog) { $errContent = Get-Content $errLog -Raw }
if (Test-Path $outLog) { $outContent = Get-Content $outLog -Raw }
if ($errContent) { Write-Host "[STDERR]`n$errContent" }
if ($outContent) { Write-Host "[STDOUT]`n$outContent" }
if (!$errContent -and !$outContent) { Write-Host "[NO OUTPUT]" }
if ($proc.HasExited) { Write-Host "[EXIT] $($proc.ExitCode)" }
Stop-Process $proc.Id -Force -EA SilentlyContinue
Remove-Item $errLog, $outLog -EA SilentlyContinue