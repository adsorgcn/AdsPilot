[CmdletBinding()]
param(
    [string]$Python = "python",
    [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')][string]$DailyAt = "09:00",
    [ValidatePattern('^[A-Za-z0-9_-]+$')][string]$NamePrefix = "AdsPilot",
    [string]$EnvFile,
    [switch]$Preview
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$pythonPath = (Get-Command $Python -CommandType Application | Select-Object -First 1).Source
if ($EnvFile) {
    $EnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
    if ($EnvFile.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Store the environment file outside the repository."
    }
}
# Windows PowerShell is installed on standard Windows hosts even when registering from pwsh.
$hostPath = if ($env:OS -eq "Windows_NT") {
    (Get-Command powershell.exe -CommandType Application | Select-Object -First 1).Source
} elseif ($Preview) { (Get-Process -Id $PID).Path } else { throw "Windows is required." }
$user = if ($env:OS -eq "Windows_NT") {
    [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
} else { "preview-user" }
function Escape-Xml([string]$v) { return [Security.SecurityElement]::Escape($v) }
function Quote-Argument([string]$v) {
    if ($v.Contains('"')) { throw "Invalid quoted path." }
    return '"' + $v + '"'
}
function New-TaskDefinition([string]$kind) {
    $runner = Join-Path $PSScriptRoot "run-task.ps1"
    $arguments = "-NoLogo -NoProfile -NonInteractive -File " + (Quote-Argument $runner) + " -Kind $kind -Python " + (Quote-Argument $pythonPath)
    if ($EnvFile -and $kind -eq "Daily") { $arguments += " -EnvFile " + (Quote-Argument $EnvFile) }
    $start = (Get-Date).ToString("yyyy-MM-dd") + "T" + $DailyAt + ":00"
    if ($kind -eq "Daily") {
        $trigger = "<CalendarTrigger><Enabled>true</Enabled><StartBoundary>$start</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>"
    } else {
        $hour = (Get-Date).ToString("yyyy-MM-ddTHH:00:00")
        $trigger = "<TimeTrigger><Enabled>true</Enabled><StartBoundary>$hour</StartBoundary><Repetition><Interval>PT1H</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition></TimeTrigger>"
    }
    return @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>$(Escape-Xml ("AdsPilot:" + $root))</Description></RegistrationInfo>
  <Triggers>$trigger</Triggers>
  <Principals><Principal id="Member"><UserId>$(Escape-Xml $user)</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT1H</ExecutionTimeLimit></Settings>
  <Actions Context="Member"><Exec><Command>$(Escape-Xml $hostPath)</Command><Arguments>$(Escape-Xml $arguments)</Arguments><WorkingDirectory>$(Escape-Xml $root)</WorkingDirectory></Exec></Actions>
</Task>
"@
}
$definitions = [ordered]@{}
foreach ($kind in @("Daily", "Sentinel")) { $definitions["$NamePrefix-$kind"] = New-TaskDefinition $kind }
if ($Preview) {
    $definitions
    return
}
. (Join-Path $PSScriptRoot "read-task.ps1")
foreach ($name in $definitions.Keys) {
    if (Get-AdsPilotTaskXml $name) { throw "Task already exists: $name. Review before replacing it." }
}
$created = @()
try {
    foreach ($name in $definitions.Keys) {
        $temp = [IO.Path]::GetTempFileName()
        try {
            [IO.File]::WriteAllText($temp, $definitions[$name], [Text.Encoding]::Unicode)
            # No /F. A concurrent task with this name must never be overwritten.
            "N" | & schtasks.exe /Create /TN $name /XML $temp
            if ($LASTEXITCODE -ne 0) { throw "Could not register $name." }
            $created += $name
        } finally { Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue }
    }
} catch {
    foreach ($name in $created) { & schtasks.exe /Delete /TN $name /F | Out-Null }
    throw
}
