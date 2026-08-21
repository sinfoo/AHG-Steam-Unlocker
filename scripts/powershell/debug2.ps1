$exePath = "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\AHG Unlocker.exe"
$proc = Start-Process $exePath -ArgumentList "--remote-debugging-port=9223" -PassThru
Start-Sleep 4
if ($proc.HasExited) {
    Write-Host "[EXIT] $($proc.ExitCode)"
    exit
}
Write-Host "[OK] Running"
try {
    $debugInfo = Invoke-RestMethod "http://localhost:9223/json" -TimeoutSec 3
    $page = $debugInfo[0]
    Write-Host "[PAGE] $($page.url)"
    Write-Host "[TITLE] $($page.title)"
    Write-Host "[WEBENG] $($page.webSocketDebuggerUrl)"
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync($page.webSocketDebuggerUrl, $ct).Wait()
    if ($ws.State -eq 'Open') {
        '{"id":1,"method":"Runtime.enable"}','{"id":2,"method":"Log.enable"}' | ForEach-Object {
            $bytes = [Text.Encoding]::UTF8.GetBytes($_)
            $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $ct).Wait()
        }
        $buf = [byte[]]::new(32768)
        $end = (Get-Date).AddSeconds(3)
        while ((Get-Date) -lt $end -and $ws.State -eq 'Open') {
            $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, $ct)
            if ($r.Wait(500) -and $r.Result.Count -gt 0) {
                $msg = [Text.Encoding]::UTF8.GetString($buf,0,$r.Result.Count) | ConvertFrom-Json -EA SilentlyContinue
                if ($msg.method -match "Runtime.consoleThrown|exceptionThrown|logAdded") {
                    Write-Host "[JS] $($msg.method)"
                    if ($msg.params) {
                        $msg.params | ConvertTo-Json -Compress | Write-Host
                    }
                }
            }
        }
        $ws.CloseAsync('NormalClosure', "", $ct).Wait()
    }
} catch {
    Write-Host "[ERROR] $_"
}
Stop-Process $proc.Id -Force -EA SilentlyContinue