# AHG Steam Unlocker - Online-Fix.me Scraper
# Target: Add 848 more online-fix.me fixes to reach 2,614

$ErrorActionPreference = "SilentlyContinue"
$fixes = @()

Write-Output "Starting scrape of online-fix.me pages 1-62..."
Write-Output "This will take several minutes..."
Write-Output ""

$baseUrl = "https://online-fix.me/games/page"

for ($page = 1; $page -le 62; $page++) {
    Write-Host "Processing page $page..." -NoNewline
    
    $url = "$baseUrl/$page/"
    $response = Invoke-WebRequest -Uri $url -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -TimeoutSec 30
    
    if ($response.StatusCode -eq 200) {
        $content = $response.Content
        
        # Extract game links - pattern: /games/[category]/[id]-[name].html
        $gameMatches = [regex]::Matches($content, 'href="(/games/[^"]+)"')
        
        $seenUrls = @{}
        $pageCount = 0
        
        foreach ($match in $gameMatches) {
            $gameUrl = $match.Groups[1].Value
            
            # Skip non-game links
            if ($gameUrl -match '/games/(page|tag|cat|search|index|auth|register|login|lostpassword|terms|privacy|faq|programs|guides|coop|multi|upload)') {
                continue
            }
            
            # Check for duplicates
            if ($seenUrls.ContainsKey($gameUrl)) { continue }
            $seenUrls[$gameUrl] = $true
            
            # Extract game name and ID from URL
            # Format: /games/category/id-name.html
            if ($gameUrl -match '/games/[^/]+/\d+-(.+)\.html') {
                $name = $matches[1]
                $name = $name -replace '-po-seti', ''
                $name = $name -replace '-', ' '
                $name = [System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ToTitleCase($name.ToLower())
                
                # Extract appid from the link or try to find it
                if ($gameUrl -match '/(\d+)-') {
                    $appid = $matches[1]
                } else {
                    $appid = "0"
                }
                
                # Build download URL pattern
                # We need to visit the game page to get the actual download link
                
                $fixEntry = @{
                    appid = $appid
                    name = $name
                    badges = @("Online")
                    fix_count = 1
                    download_url = ""  # Will be filled when we visit the game page
                    download_urls = @()
                    source = "online-fix.me"
                    game_url = "https://online-fix.me$gameUrl"
                }
                
                $fixes += $fixEntry
                $pageCount++
            }
        }
        
        Write-Host " - Found $pageCount games" -ForegroundColor Green
    } else {
        Write-Host " - Error: $($response.StatusCode)" -ForegroundColor Red
    }
    
    # Small delay to be respectful
    Start-Sleep -Milliseconds 500
}

Write-Output ""
Write-Output "Total games scraped: $($fixes.Count)"

# Save to file for now
$fixes | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\USER\Downloads\filesOPENCODE\scraped_games.json" -Encoding UTF8