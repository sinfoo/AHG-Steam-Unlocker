$packages = @(
  "@modelcontextprotocol/server-sequential-thinking",
  "@wonderwhy-er/desktop-commander",
  "imagesorcery-mcp",
  "@21st-dev/magic",
  "@praeses/steam-mcp",
  "markitdown-mcp",
  "@modelcontextprotocol/server-filesystem",
  "repomix",
  "@cyanheads/git-mcp-server",
  "semgrep-mcp",
  "@ui-layouts/mcp",
  "@react-aria/mcp",
  "@react-spectrum/mcp",
  "@johndoe20012/ui-expert-mcp",
  "@modelcontextprotocol/server-memory",
  "@modelcontextprotocol/server-puppeteer",
  "mcp-sqlite",
  "@mcpcentral/mcp-time",
  "with-context-mcp",
  "shadcn",
  "@magicuidesign/mcp",
  "firecrawl-mcp"
)

Write-Host "=== Checking npm packages ==="
foreach ($pkg in $packages) {
  $result = npm view $pkg version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS  $pkg -> $result"
  } else {
    Write-Host "FAIL  $pkg -> NOT FOUND on npm"
  }
}

Write-Host ""
Write-Host "=== Checking uvx tools ==="
$uvxTools = @("imagesorcery-mcp", "markitdown-mcp", "semgrep-mcp")
foreach ($tool in $uvxTools) {
  $result = uvx --version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "PASS  uvx is available"
  } else {
    Write-Host "FAIL  uvx is NOT installed"
  }
}

Write-Host ""
Write-Host "=== Checking Python packages (semgrep) ==="
pip show semgrep-mcp 2>$null | Select-String "Name:|Version:" -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) { Write-Host "PASS  semgrep-mcp (pip)" } else { Write-Host "FAIL  semgrep-mcp (pip) not installed" }

pip show markitdown-mcp 2>$null | Select-String "Name:|Version:" -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) { Write-Host "PASS  markitdown-mcp (pip)" } else { Write-Host "FAIL  markitdown-mcp (pip) not installed" }
