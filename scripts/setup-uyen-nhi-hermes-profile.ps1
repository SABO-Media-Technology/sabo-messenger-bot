# Setup Hermes profile "uyen-nhi" cho omnichannel Uyển Nhi
# Usage: pwsh -File scripts/setup-uyen-nhi-hermes-profile.ps1 [-HermesHome $env:USERPROFILE\.hermes]

param(
  [string]$HermesHome = "$env:USERPROFILE\.hermes",
  [string]$MonorepoRoot = "D:\0.PROJECTS"
)

$ErrorActionPreference = "Stop"
$profileDir = Join-Path $HermesHome "profiles\uyen-nhi"
$soulSrc = Join-Path $MonorepoRoot "10-AI-BRAIN\hermes\shared\souls\uyen_nhi.md"
$overlay = Join-Path $PSScriptRoot "..\hermes-profiles\uyen-nhi\SOUL.overlay.md"

if (-not (Test-Path $soulSrc)) {
  Write-Error "Missing soul SSoT: $soulSrc"
}

New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$soul = Get-Content $soulSrc -Raw
$extra = ""
if (Test-Path $overlay) {
  $extra = "`n`n" + (Get-Content $overlay -Raw)
}
Set-Content -Path (Join-Path $profileDir "SOUL.md") -Value ($soul + $extra) -Encoding utf8

$configYaml = @"
# Uyên Nhi — omnichannel sales (Messenger first)
model:
  provider: ollama
  model: qwen3.5:9b
  base_url: http://127.0.0.1:11434/v1

agent:
  max_iterations: 12

memory:
  provider: mem0

gateway:
  api_server:
    enabled: true
    port: 8643
    host: 127.0.0.1

terminal:
  cwd: $MonorepoRoot

display:
  skin: default
"@

Set-Content -Path (Join-Path $profileDir "config.yaml") -Value $configYaml -Encoding utf8

Write-Host "OK: uyen-nhi profile -> $profileDir"
Write-Host "Start gateway: hermes -p uyen-nhi gateway (API :8643) or add PM2 app hermes-uyen-nhi"
Write-Host "Messenger .env: HERMES_API_URL=http://127.0.0.1:8643 HERMES_ENABLED=true"
