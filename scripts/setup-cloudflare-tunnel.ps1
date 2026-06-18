# Expose local Ollama (11434) and/or Hermes API (8642) for Render prod.
# Requires: cloudflared installed (winget install Cloudflare.cloudflared)
# Usage:
#   pwsh -File scripts/setup-cloudflare-tunnel.ps1 -Service ollama
#   pwsh -File scripts/setup-cloudflare-tunnel.ps1 -Service hermes
# Copy the printed https://*.trycloudflare.com URL into Render env:
#   OLLAMA_BASE_URL=https://xxx.trycloudflare.com/v1   (ollama)
#   HERMES_API_URL=https://yyy.trycloudflare.com       (hermes)

param(
  [ValidateSet("ollama", "hermes")]
  [string]$Service = "ollama"
)

$port = if ($Service -eq "hermes") { 8642 } else { 11434 }
$label = if ($Service -eq "hermes") { "HERMES_API_URL" } else { "OLLAMA_BASE_URL (append /v1)"

Write-Host "Starting Cloudflare quick tunnel -> localhost:$port ($Service)"
Write-Host "Set Render env: $label = <printed URL>"
Write-Host ""

& cloudflared tunnel --url "http://127.0.0.1:$port"
