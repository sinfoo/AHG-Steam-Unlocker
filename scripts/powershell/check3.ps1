$g = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\games.json' -Raw | ConvertFrom-Json

# Check newest games (highest appid = newest)
$sorted = $g | Sort-Object { [int]$_.appid } -Descending | Select-Object -First 30

Write-Host "=== Newest 30 games ==="
$sorted | ForEach-Object {
    $hasHeader = -not ([string]::IsNullOrEmpty($_.header_image))
    Write-Host "AppID:" $_.appid "HasHeader:" $hasHeader "Name:" $_.name.Substring(0, [Math]::Min(25, $_.name.Length))
}