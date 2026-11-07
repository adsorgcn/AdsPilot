[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$config = Join-Path $root "config/adspilot.json"
$runsDir = "runs"
if (Test-Path -LiteralPath $config) {
    $cfg = Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cfg.runs_dir) { $runsDir = $cfg.runs_dir }
}
if (![IO.Path]::IsPathRooted($runsDir)) { $runsDir = Join-Path $root $runsDir }
if (!(Test-Path -LiteralPath $runsDir -PathType Container)) { Write-Output "sentinel: no runs yet"; exit 0 }
$latest = Get-ChildItem -LiteralPath $runsDir -Directory |
    ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName "run.log") -ErrorAction SilentlyContinue } |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (!$latest) { Write-Output "sentinel: no runs yet"; exit 0 }
$age = ([datetime]::UtcNow - $latest.LastWriteTimeUtc).TotalHours
$last = Select-String -LiteralPath $latest.FullName -Pattern '::STATUS\{.*?\|exit:([0-9]+)\|' | Select-Object -Last 1
$code = if ($last) { $last.Matches[0].Groups[1].Value } else { "unknown" }
$message = "{0} sentinel: run={1} age={2:N1}h exit={3}" -f (Get-Date -Format o), $latest.Directory.Name, $age, $code
Write-Output $message
if ($age -gt 26 -or $code -in @("1","3")) {
    Add-Content -LiteralPath (Join-Path $runsDir "sentinel.log") -Encoding UTF8 -Value ("ALERT " + $message)
    exit 2
}
exit 0
