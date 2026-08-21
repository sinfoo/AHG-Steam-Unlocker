$fixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json

Write-Output "=== DOWNLOAD URL ANALYSIS ==="
Write-Output ""

# Group by source domain
$urlPatterns = @{}
foreach ($fix in $fixes) {
    $url = $fix.download_url
    if ($url -match 'https?://([^/]+)') {
        $domain = $matches[1]
        if (-not $urlPatterns.ContainsKey($domain)) { $urlPatterns[$domain] = 0 }
        $urlPatterns[$domain]++
    }
}

Write-Output "Domains in download_url:"
$urlPatterns.GetEnumerator() | Sort-Object Value -Descending | Format-Table -AutoSize

Write-Output ""
Write-Output "=== SOURCE BREAKDOWN ==="

# Check source field
$sourceGroups = @{}
foreach ($fix in $fixes) {
    $src = $fix.source
    if (-not $src) { $src = "(empty)" }
    if (-not $sourceGroups.ContainsKey($src)) { $sourceGroups[$src] = 0 }
    $sourceGroups[$src]++
}

Write-Output "Source field values:"
$sourceGroups.GetEnumerator() | Sort-Object Value -Descending | Format-Table -AutoSize

Write-Output ""
Write-Output "=== BADGE ANALYSIS ==="

# Count badges
$badges = @{}
foreach ($fix in $fixes) {
    if ($fix.badges) {
        foreach ($badge in $fix.badges) {
            if (-not $badges.ContainsKey($badge)) { $badges[$badge] = 0 }
            $badges[$badge]++
        }
    }
}

Write-Output "Badge counts:"
$badges.GetEnumerator() | Sort-Object Value -Descending | Format-Table -AutoSize

Write-Output ""
Write-Output "=== SAMPLE FIXES BY SOURCE ==="

# Show sample from each source
foreach ($src in @("ryuu.lol", "online-fix.me")) {
    Write-Output ""
    Write-Output "Sample from $src :"
    $samples = $fixes | Where-Object { $_.source -eq $src } | Select-Object -First 3
    foreach ($s in $samples) {
        Write-Output ("  - " + $s.name + " (" + $s.appid + ")")
        Write-Output ("    URL: " + $s.download_url.Substring(0, [Math]::Min(80, $s.download_url.Length)) + "...")
    }
}