# Resolves the newest bundled Claude Code CLI and runs `setup-token` interactively.
# Run this in your OWN terminal (it opens a browser to authorize).
$root = Join-Path $env:APPDATA "Claude\claude-code"
$exe = Get-ChildItem $root -Directory |
  Sort-Object { [version]($_.Name) } -Descending |
  ForEach-Object { Join-Path $_.FullName "claude.exe" } |
  Where-Object { Test-Path $_ } |
  Select-Object -First 1

if (-not $exe) {
  Write-Host "Could not find claude.exe under $root" -ForegroundColor Red
  exit 1
}

Write-Host "Using: $exe" -ForegroundColor Cyan
Write-Host "A browser will open. Authorize, then copy the token it prints below." -ForegroundColor Yellow
Write-Host "Then paste it at http://localhost:3737/settings -> Subscription token -> Save." -ForegroundColor Yellow
Write-Host ""

# Clear the host's API key so it doesn't interfere with the OAuth flow.
$env:ANTHROPIC_API_KEY = $null
& $exe setup-token
