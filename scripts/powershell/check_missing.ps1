$ErrorActionPreference = "SilentlyContinue"

Write-Output "=== CHECKING FOR NEW GAMES ==="
Write-Output ""

$existing = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$existingIds = @{}
$existingUrls = @{}
foreach ($e in $existing) { 
    $existingIds[$e.appid] = $true 
    if ($e.game_url) { $existingUrls[$e.game_url] = $true }
}

Write-Output "Current unique IDs: $($existingIds.Count)"

# Fetch ALL pages and collect ALL unique games
$siteIds = @{}
$siteUrls = @{}
$baseUrl = "https://online-fix.me/games/page"

for ($p = 1; $p -le 62; $p++) {
    $html = curl -s -L -A "Mozilla/5.0" "$baseUrl/$p/"
    
    $matches = [regex]::Matches($html, 'href="(https://online-fix\.me/games/[^"]+)"')
    
    foreach ($m in $matches) {
        $url = $m.Groups[1].Value
        
        if ($url -match '/games/[^/]+/(\d+)-(.+)\.html') {
            $id = $matches[1]
            $siteIds[$id] = $true
            $siteUrls[$url] = $true
        }
    }
}

Write-Output "Unique IDs ON SITE: $($siteIds.Count)"
Write-Output ""

# Find what's on site but NOT in fixes.json
$newIds = @()
foreach ($id in $siteIds.Keys) {
    if (-not $existingIds.ContainsKey($id)) {
        $newIds += $id
    }
}

Write-Output "IDs on site but NOT in fixes: $($newIds.Count)"

if ($newIds.Count -gt 0 -and $newIds.Count -lt 100) {
    Write-Output "Missing IDs: $($newIds -join ', ')"
}