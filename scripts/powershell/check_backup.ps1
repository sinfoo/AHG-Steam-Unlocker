$fixes = Get-Content $args[0] -Raw | ConvertFrom-Json
$total = $fixes.Count
$online = ($fixes | Where-Object { $_.source -eq 'online-fix.me' }).Count
Write-Host "File: $($args[0])"
Write-Host "Total: $total, online-fix.me: $online"