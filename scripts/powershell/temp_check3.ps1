$fixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json

Write-Output "=== DOWNLOAD_URLS ARRAY ANALYSIS ==="
Write-Output ""

$allUrls = @{}
foreach ($fix in $fixes) {
    if ($fix.download_urls) {
        foreach ($url in $fix.download_urls) {
            if ($url -match 'https?://([^/]+)') {
                $domain = $matches[1]
                if (-not $allUrls.ContainsKey($domain)) { $allUrls[$domain] = 0 }
                $allUrls[$domain]++
            }
        }
    }
}

Write-Output "All domains in download_urls arrays:"
$allUrls.GetEnumerator() | Sort-Object Value -Descending | Format-Table -AutoSize

Write-Output ""
Write-Output "=== FIXES WITH MULTIPLE URLS ==="
$multiUrl = $fixes | Where-Object { $fix.download_urls.Count -gt 1 }
Write-Output ("Fixes with multiple download URLs: " + $multiUrl.Count)

Write-Output ""
Write-Output "=== FIX_COUNT SUMMARY ==="
$fixCounts = $fixes | Group-Object -Property fix_count | Select-Object Name, Count
$fixCounts | Format-Table -AutoSize