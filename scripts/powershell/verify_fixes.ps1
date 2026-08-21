$fixes = Get-Content 'C:\Users\USER\Downloads\filesOPENCODE\dist-electron\win-unpacked\resources\fixes.json' -Raw | ConvertFrom-Json

Write-Output "=== VERIFYING SAMPLE FIXES ==="
Write-Output ""

# Verify 10 random fixes from online-fix.me
Write-Output "Testing online-fix.me URLs..."
$onlineFixes = $fixes | Where-Object { $_.source -eq "online-fix.me" } | Select-Object -First 10

foreach ($fix in $onlineFixes) {
    try {
        $url = $fix.download_url
        $req = [System.Net.WebRequest]::Create($url)
        $req.Method = "HEAD"
        $req.UserAgent = "Mozilla/5.0"
        $req.Timeout = 5000
        $resp = $req.GetResponse()
        $status = $resp.StatusCode
        $resp.Close()
        Write-Output ("[OK] " + $fix.name + " - " + $status)
    } catch {
        $ex = $_.Exception
        Write-Output ("[FAIL] " + $fix.name + " - " + $ex.Message)
    }
}

Write-Output ""
Write-Output "Testing ryuu.lol URLs..."
$ryuuFixes = $fixes | Where-Object { $_.source -eq "ryuu.lol" } | Select-Object -First 10

foreach ($fix in $ryuuFixes) {
    try {
        $url = $fix.download_url
        $req = [System.Net.WebRequest]::Create($url)
        $req.Method = "HEAD"
        $req.UserAgent = "Mozilla/5.0"
        $req.Timeout = 5000
        $resp = $req.GetResponse()
        $status = $resp.StatusCode
        $resp.Close()
        Write-Output ("[OK] " + $fix.name + " - " + $status)
    } catch {
        $ex = $_.Exception
        Write-Output ("[FAIL] " + $fix.name + " - " + $ex.Message)
    }
}