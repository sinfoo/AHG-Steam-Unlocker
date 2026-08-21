$fixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json

$total = $fixes.Count
$online = ($fixes | Where-Object { $_.source -eq "online-fix.me" }).Count
$ryuu = ($fixes | Where-Object { $_.source -eq "ryuu.lol" }).Count

Write-Output "=== CURRENT FIXES ==="
Write-Output "Total: $total"
Write-Output "online-fix.me: $online"
Write-Output "ryuu.lol: $ryuu"
Write-Output ""
Write-Output "Target: 3104"
Write-Output "Need: $(3104 - $total)"