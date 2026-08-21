$f = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$g = $f | Group-Object -Property source | Select-Object Name, Count
Write-Output $g
Write-Output ""
Write-Output ("Total fixes: " + $f.Count)