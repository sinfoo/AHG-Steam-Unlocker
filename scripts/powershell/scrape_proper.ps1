$ErrorActionPreference = "SilentlyContinue"

Write-Output "=== SCRAPING WITH BIG-LINK CLASS ==="
Write-Output ""

$existing = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$existingIds = @{}
foreach ($e in $existing) { $existingIds[$e.appid] = $true }

Write-Output "Existing fixes: $($existing.Count)"

# Fetch all pages
$allGames = @()
$seenUrls = @{}

for ($p = 1; $p -le 62; $p++) {
    Write-Host "Page $p..." -NoNewline
    
    $html = curl -s -L -A "Mozilla/5.0" "https://online-fix.me/games/page/$p/"
    
    # Extract game links with big-link class
    $matches = [regex]::Matches($html, 'href="(https://online-fix\.me/games/[^"]+)"')
    
    $added = 0
    foreach ($m in $matches) {
        $url = $m.Groups[1].Value
        
        # Skip duplicates
        if ($seenUrls.ContainsKey($url)) { continue }
        
        # Pattern: /games/category/ID-name.html
        if ($url -match '/games/[^/]+/(\d+)-(.+)\.html') {
            $id = $matches[1]
            $slug = $matches[2]
            
            $seenUrls[$url] = $true
            
            # Skip if already in fixes
            if ($existingIds.ContainsKey($id)) { continue }
            
            # Clean name
            $name = $slug -replace '-po-seti', '' -replace '-', ' '
            $name = [System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ToTitleCase($name.ToLower())
            
            # Build URL like current fixes format
            # https://uploads.online-fix.me:2053/uploads/{slug}/Fix%20Repair/{slug}_Fix_Repair_Steam_Generic.rar
            
            $g = @{
                appid = $id
                name = $name
                badges = @("Online")
                fix_count = 1
                download_url = "https://uploads.online-fix.me:2053/uploads/$slug/Fix%20Repair/$([uri]::EscapeDataString($slug))_Fix_Repair_Steam_Generic.rar"
                download_urls = @("https://uploads.online-fix.me:2053/uploads/$slug/Fix%20Repair/$([uri]::EscapeDataString($slug))_Fix_Repair_Steam_Generic.rar")
                source = "online-fix.me"
                game_url = $url
            }
            
            $allGames += $g
            $added++
        }
    }
    
    if ($added -gt 0) {
        Write-Host "+$added" -ForegroundColor Green
    } else {
        Write-Host "(done)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 200
}

Write-Output ""
Write-Output "NEW fixes found: $($allGames.Count)"

if ($allGames.Count -gt 0) {
    # Merge
    $merged = @($existing) + @($allGames)
    
    Write-Output "Merging..."
    
    # Save
    $merged | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json" -Encoding UTF8
    
    Write-Output "Saved! Total: $($merged.Count)"
} else {
    Write-Output "No new fixes to add."
}