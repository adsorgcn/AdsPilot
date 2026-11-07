[CmdletBinding()]
param([ValidatePattern('^[A-Za-z0-9_-]+$')][string]$NamePrefix = "AdsPilot")
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
. (Join-Path $PSScriptRoot "read-task.ps1")
foreach ($kind in @("Daily", "Sentinel")) {
    $name = "$NamePrefix-$kind"
    $xml = Get-AdsPilotTaskXml $name
    if (!$xml) { continue }
    if ($xml.Task.RegistrationInfo.Description -ne ("AdsPilot:" + $root)) {
        throw "Task does not belong to this checkout: $name"
    }
    & schtasks.exe /Delete /TN $name /F
    if ($LASTEXITCODE -ne 0) { throw "Could not remove $name." }
}
