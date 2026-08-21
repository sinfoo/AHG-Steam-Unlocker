$ErrorActionPreference = "SilentlyContinue"

function Get-CurlContent {
    param($url)
    # Use raw curl via call operator
    $output = & curl -s -L -A "Mozilla/5.0" $url
    return $output
}

Write-Output "=== SCRAPING WITH REAL CURL ==="
Write-Output ""

$existing = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json
$existingIds = @{}
foreach ($e in $existing) { $existingIds[$e.appid] = $true }
Write-Output "Existing: $($existing.Count)"

$allUrls = @{}

for ($p = 1; $p -le 62; $p++) {
    if ($p % 10 -eq 1) { Write-Host "Page $p..." -NoNewline }
    
    $html = Get-CurlContent "https://online-fix.me/games/page/$p/"
    
    $pattern = [regex]::new('href="(https://online-fix\.me/games/[^"]+)"')
    $matches = $pattern.Matches($html)
    
    foreach ($m in $matches) {
        $url = $m.Groups[1].Value
        
        if ($url -match '/games/(page|tag|cat|search|index|auth|register|login|lostpassword)') {
            continue
        }
        
        if (-not $allUrls.ContainsKey($url)) {
            $allUrls[$url] = $true
        }
    }
    
    if ($p % 10 -eq 0) { 
        Write-Host " $($allUrls.Count)" -ForegroundColor Cyan 
    }
    Start-Sleep -Milliseconds 200
}

Write-Host " final: $($allUrls.Count)" -ForegroundColor Cyan
Write-Output ""
Write-Output "=== PROCESSING URLs ==="

$newFixes = @()

foreach ($url in $allUrls.Keys) {
    if ($url -match '/games/[^/]+/(\d+)-(.+)\.html') {
        $id = $matches[1]
        $slug = $matches[2] -replace '-po-seti$', ''
        
        if ($existingIds.ContainsKey($id)) {
            continue
        }
        
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

Write-Output "New games: $($newFixes.Count)"

if ($newFixes.Count -gt 0) {
    $merged = @($existing) + @($newFixes)
    
    Write-Output "Saving..."
    $merged | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json" -Encoding UTF8
    
    $finalCount = (Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json).Count
    Write-Output "Done! Total: $finalCount"
} else {
    Write-Output "Nothing new."
}