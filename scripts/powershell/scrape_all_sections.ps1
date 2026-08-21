$ErrorActionPreference = "SilentlyContinue"

Write-Output "=== SCRAPING ALL SECTIONS ==="
Write-Output ""

$existing = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$existingIds = @{}
foreach ($e in $existing) { $existingIds[$e.appid] = $true }
Write-Output "Existing: $($existing.Count)"

# All possible sections on online-fix.me
$sections = @(
    "/games/",          # Main page
    "/games/arcade/",
    "/games/survival/",
    "/games/racing/",
    "/games/fighting/",
    "/games/sandbox/",
    "/games/rpg/",
    "/games/simulator/",
    "/games/strategy/",
    "/games/horror/",
    "/games/shooter/",
    "/games/puzzles/",
    "/games/adventures/",
    "/games/vr/",
    "/games/officialservers/",
    "/coop/",
    "/multi/"
)

$allGames = @{}
$seenUrls = @{}

foreach ($section in $sections) {
    Write-Host "$section..." -NoNewline
    
    # Try first 5 pages of each section
    for ($p = 1; $p -le 5; $p++) {
        $url = "https://online-fix.me$section" + "page/$p/"
        
        $html = curl -s -L -A "Mozilla/5.0" $url
        
        $matches = [regex]::Matches($html, 'href="(https://online-fix\.me/games/[^"]+)"')
        
        foreach ($m in $matches) {
            $link = $m.Groups[1].Value
            
            if ($link -match '/games/[^/]+/(\d+)-(.+)\.html') {
                $id = $matches[1]
                $seenUrls[$link] = $true
                
                if (-not $allGames.ContainsKey($id)) {
                    $allGames[$id] = $link
                }
            }
        }
    }
    
    Write-Host " $($allGames.Count) total" -ForegroundColor Cyan
    Start-Sleep -Milliseconds 200
}

Write-Output ""
Write-Output "=== SUMMARY ==="
Write-Output "Total unique IDs found: $($allGames.Count)"

# What's new
$newCount = 0
$newIds = @()
foreach ($id in $allGames.Keys) {
    if (-not $existingIds.ContainsKey($id)) {
        $newIds += $id
        $newCount++
    }
}

Write-Output "New games to add: $newCount"

# Only proceed if there are new games
if ($newCount -gt 0) {
    Write-Output ""
    Write-Output "=== ADDING NEW FIXES ==="
    
    $newFixes = @()
    foreach ($id in $newIds) {
        $url = $allGames[$id]
        
        if ($url -match '/games/[^/]+/\d+-(.+)\.html') {
            $slug = $matches[1] -replace '-po-seti$', ''
            $name = $slug -replace '-', ' '
            $name = [System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ToTitleCase($name.ToLower())
            
            $nf = @{
                appid = $id
                name = $name
                badges = @("Online")
                fix_count = 1
                download_url = "https://uploads.online-fix.me:2053/uploads/$slug/Fix%20Repair"
                download_urls = @("https://uploads.online-fix.me:2053/uploads/$slug/Fix%20Repair")
                source = "online-fix.me"
                game_url = $url
            }
            $newFixes += $nf
        }
    }
    
    # Merge
    $merged = @($existing) + @($newFixes)
    $merged | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json" -Encoding UTF8
    
    Write-Output "Saved! Total: $($merged.Count)"
} else {
    Write-Output "No new fixes needed."
}