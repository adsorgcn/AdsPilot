# Run an AdsPilot service in the single-user local model (Windows).
#   .\scripts\dev-local.ps1                 # adscenter on 127.0.0.1:8080
#   .\scripts\dev-local.ps1 aicore 8082     # aicore on 127.0.0.1:8082
param(
    [string]$Service = "adscenter",
    [int]$Port = 8080
)

$env:ADSPILOT_LOCAL = "1"
$env:PORT = "$Port"

Set-Location (Join-Path $PSScriptRoot "..")
go run "./services/$Service"
