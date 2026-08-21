$ErrorActionPreference = "SilentlyContinue"

Write-Output "=== Scraping online-fix.me game IDs ==="
Write-Output ""

$gamelist = @()
$seenIds = @{}
$baseUrl = "https://online-fix.me/games/page"

# Get known IDs from existing fixes
$existing = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
foreach ($e in $existing) { $seenIds[$e.appid] = $true }
Write-Output "Existing fixes: $($existing.Count)"

# Fetch all pages
for ($p = 1; $p -le 62; $p++) {
    Write-Host "Page $p..." -NoNewline
    
    $html = curl -s -L -A "Mozilla/5.0" "$baseUrl/$p/"
    
    # Extract game IDs - pattern: /games/category/ID-name.html
    $ids = [regex]::Matches($html, '/games/[^/]+/(\d+)-')
    
    $newCount = 0
    foreach ($m in $ids) {
        $id = $m.Groups[1].Value
        if (-not $seenIds.ContainsKey($id)) {
            $seenIds[$id] = $true
            $newCount++
        }
    }
    
    if ($newCount -gt 0) {
        Write-Host "+$newCount" -ForegroundColor Green
    } else {
        Write-Host "(done)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 200
}

Write-Output ""
Write-Output "Total unique game IDs found: $($seenIds.Count)"
Write-Output "Target: 3104"
Write-Output "Need $(3104 - $seenIds.Count) more"