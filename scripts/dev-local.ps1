# Run an AdsPilot service in the single-user local model (Windows).
#   .\scripts\dev-local.ps1                 # adscenter on 127.0.0.1:8080
#   .\scripts\dev-local.ps1 aicore 8082     # aicore on 127.0.0.1:8082
param(
    [string]$Service = "adscenter",
    [int]$Port = 8080
)

Set-Location (Join-Path $PSScriptRoot "..")

# Load KEY=VALUE lines from the repo-root .env (gitignored; see .env.example).
# This is where Google Ads credentials live in the local model.
if (Test-Path ".env") {
    foreach ($line in Get-Content ".env") {
        $line = $line.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { continue }
        $k, $v = $line.Split("=", 2)
        $v = $v.Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($k.Trim(), $v, "Process")
    }
}

# Script parameters win over .env for these two.
$env:ADSPILOT_LOCAL = "1"
$env:PORT = "$Port"

go run "./services/$Service"
