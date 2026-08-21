$g = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\games.json' -Raw | ConvertFrom-Json
Write-Host "Total games:" $g.Count

$withHeader = $g | Where-Object { $_.header_image -ne $null -and $_.header_image -ne "" }
Write-Host "Games with header_image:" $withHeader.Count

# Show first 5 with header
$g[0..10] | ForEach-Object {
    $has = -not ([string]::IsNullOrEmpty($_.header_image))
    Write-Host "AppID:" $_.appid "Name:" $_.name.Substring(0, [Math]::Min(30, $_.name.Length)) "HasHeader:" $has
}