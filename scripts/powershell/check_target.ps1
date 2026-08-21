# Check how many online-fix.me fixes we have
$fixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$onlineCount = ($fixes | Where-Object { $_.source -eq "online-fix.me" }).Count
Write-Output "Current online-fix.me fixes: $onlineCount"
Write-Output "Target: 2614"
Write-Output ("Need to add: " + (2614 - $onlineCount))