$fixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json

Write-Output "=== FIXES WITH 2 URLS (fix_count: 2) ==="
$multi = $fixes | Where-Object { $_.fix_count -eq 2 }
foreach ($m in $multi) {
    Write-Output ""
    Write-Output ($m.name + " (" + $m.appid + ")")
    Write-Output ("  download_url: " + $m.download_url)
    Write-Output ("  download_urls:")
    foreach ($url in $m.download_urls) {
        Write-Output ("    - " + $url)
    }
}

Write-Output ""
Write-Output "=== DOWNLOAD_URL STRUCTURE ==="
$sample = $fixes[0]
Write-Output ("First fix structure:")
Write-Output ("  appid: " + $sample.appid)
Write-Output ("  name: " + $sample.name)
Write-Output ("  badges: " + ($sample.badges -join ", "))
Write-Output ("  fix_count: " + $sample.fix_count)
Write-Output ("  download_url: " + $sample.download_url)
Write-Output ("  download_urls: " + ($sample.download_urls -join ", "))
Write-Output ("  source: " + $sample.source)