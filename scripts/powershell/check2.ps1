$g = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\games.json' -Raw | ConvertFrom-Json

# Check first 50 most popular games
$POPULAR_GAMES = @('730', '570940', '374320', '105600', '294100', '582010', '1313140', '752590', '1817070', '1849900', '2136720', '1240440', '1797280', '1086940', '1332010', '236090', '228743', '620', '2906390', '2357570', '252490')

$POPULAR_GAMES | ForEach-Object {
    $appid = $_
    $game = $g | Where-Object { $_.appid -eq $appid } | Select-Object -First 1
    if ($game) {
        Write-Host "AppID:" $game.appid "URL:" $game.header_image
    }
}