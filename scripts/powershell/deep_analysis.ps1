$ErrorActionPreference = "SilentlyContinue"

Write-Output "=== DEEP ANALYSIS ==="
Write-Output ""

# Get ALL IDs from each page (including duplicates)
$allIds = @{}
$baseUrl = "https://online-fix.me/games/page"
$totalScraped = 0

for ($p = 1; $p -le 62; $p++) {
    $html = curl -s -L -A "Mozilla/5.0" "$baseUrl/$p/"
    
    # Extract ALL game IDs on page
    $ids = [regex]::Matches($html, '/games/[^/]+/(\d+)-')
    
    foreach ($m in $ids) {
        $id = $m.Groups[1].Value
        if (-not $allIds.ContainsKey($id)) { $allIds[$id] = 0 }
        $allIds[$id]++
        $totalScraped++
    }
    
    Start-Sleep -Milliseconds 100
}

Write-Output "Total ID occurrences on pages: $totalScraped"
Write-Output "Unique game IDs: $($allIds.Count)"
Write-Output ""
Write-Output "=== COMPARISON WITH CURRENT ==="

$existing = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json

# Current breakdown
$currentOnline = $existing | Where-Object { $_.source -eq "online-fix.me" }
$existingOnlineIds = @{}
foreach ($e in $currentOnline) { $existingOnlineIds[$e.appid] = $true }

Write-Output "Current online-fix.me fixes: $($currentOnline.Count)"
Write-Output "Current unique IDs: $($existingOnlineIds.Count)"
Write-Output ""
Write-Output "=== MISSING ANALYSIS ==="

# What IDs are in pages but not in fixes
$missing = @()
foreach ($id in $allIds.Keys) {
    if (-not $existingOnlineIds.ContainsKey($id)) {
        $missing += $id
    }
}

Write-Output "IDs on site but NOT in fixes.json: $($missing.Count)"
Write-Output "Expected target: 2614 online-fix.me"
Write-Output "Available on site: $($allIds.Count)"