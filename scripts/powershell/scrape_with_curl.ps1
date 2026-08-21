$ErrorActionPreference = "SilentlyContinue"

Write-Output "=== SCRAPING ONLINE-FIX.ME WITH CURL ==="
Write-Output ""

$newFixes = @()
$baseUrl = "https://online-fix.me/games/page"
$processedUrls = @{}

# First, get list of pages we already have in fixes.json
$existingFixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$existingUrls = @{}
foreach ($fix in $existingFixes) {
    if ($fix.game_url) {
        $existingUrls[$fix.game_url] = $true
    }
}
Write-Output "Existing online-fix.me fixes: $($existingFixes.Count)"

# Try pages 1-62
for ($page = 1; $page -le 62; $page++) {
    Write-Host "Page $page..." -NoNewline
    
    $url = "$baseUrl/$page/"
    $html = curl -s -L -A "Mozilla/5.0" $url
    
    if ($html.Length -lt 100) {
        Write-Host " Error (empty)" -ForegroundColor Red
        continue
    }
    
    # Extract game links: /games/category/id-name.html
    $gameLinks = [regex]::Matches($html, 'href="(https://online-fix\.me/games/[^"]+)"')
    
    $found = 0
    foreach ($match in $gameLinks) {
        $link = $match.Groups[1].Value
        
        # Skip non-game links
        if ($link -match '/games/(page|tag|cat|search|index|auth|register|login|lostpassword|terms|privacy|faq|programs|guides|coop|multi|upload)') {
            continue
        }
        
        # Skip if already processed
        if ($processedUrls.ContainsKey($link)) { continue }
        $processedUrls[$link] = $true
        
        # Skip if already in fixes
        if ($existingUrls.ContainsKey($link)) { continue }
        
        # Extract game ID and name
        # Format: /games/category/ID-name.html
        if ($link -match '/games/[^/]+/(\d+)-(.+)\.html') {
            $id = $matches[1]
            $nameSlug = $matches[2]
            $name = $nameSlug -replace '-po-seti', '' -replace '-', ' '
            
            # Clean up the name
            $name = $name -replace '³', '3' -replace '²', '2'
            $name = [System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ToTitleCase($name.ToLower())
            
            $fixEntry = @{
                appid = $id
                name = $name
                badges = @("Online")
                fix_count = 1
                download_url = "https://uploads.online-fix.me:2053/uploads/$nameSlug/Fix%20Repair"
                download_urls = @("https://uploads.online-fix.me:2053/uploads/$nameSlug/Fix%20Repair")
                source = "online-fix.me"
                game_url = $link
            }
            
            $newFixes += $fixEntry
            $found++
        }
    }
    
    if ($found -gt 0) {
        Write-Host " +$found new" -ForegroundColor Green
    } else {
        Write-Host " (done)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 300
}

Write-Output ""
Write-Output "Total NEW fixes found: $($newFixes.Count)"

# Only keep if we have new ones
if ($newFixes.Count -gt 0) {
    # Merge with existing
    $allFixes = @($existingFixes) + @($newFixes)
    
    Write-Output "Merging with existing fixes..."
    
    # Save merged
    $allFixes | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json" -Encoding UTF8
    
    Write-Output "Saved! Total fixes: $($allFixes.Count)"
} else {
    Write-Output "No new fixes to add."
}