# Offline checks only. The ScheduledTasks API is mocked; no registration takes place.
param([string]$Python = "python")
$ErrorActionPreference = "Stop"
$checkout = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dir = Join-Path $checkout "core/loop/windows"
foreach ($script in (Get-ChildItem -LiteralPath $dir -Filter "*.ps1")) {
    $tokens = $null
    $errors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw $errors[0] }
}
$defs = & (Join-Path $dir "register-task.ps1") -Preview -Python $Python -DailyAt "09:30"
if ($defs.Count -ne 2) { throw "expected two XML definitions" }
foreach ($kind in @("Daily", "Sentinel")) {
    [xml]$xml = $defs["AdsPilot-$kind"]
    $task = $xml.Task
    $exec = $task.Actions.Exec
    if ($task.Principals.Principal.RunLevel -ne "LeastPrivilege" -or $exec.WorkingDirectory -ne $checkout) {
        throw "incorrect task principal or directory"
    }
    if (!$exec.Arguments.Contains("-Kind $kind") -or !$exec.Arguments.Contains("run-task.ps1")) { throw "incorrect command" }
    if ($kind -eq "Daily") {
        $trigger = $task.Triggers.CalendarTrigger
        if ($trigger.ScheduleByDay.DaysInterval -ne "1" -or !$trigger.StartBoundary.EndsWith("T09:30:00")) { throw "bad daily trigger" }
    } elseif ($task.Triggers.TimeTrigger.Repetition.Interval -ne "PT1H") { throw "bad hourly trigger" }
}
. (Join-Path $dir "read-task.ps1")
function Get-ScheduledTask { [pscustomobject]@{ TaskPath = "\Other\"; TaskName = "AdsPilot-Daily" } }
if (Get-AdsPilotTaskXml "AdsPilot-Daily") { throw "foreign task is not in root folder" }
function Get-ScheduledTask { [pscustomobject]@{ TaskPath = "\"; TaskName = "AdsPilot-Daily" } }
function Export-ScheduledTask { param($TaskName, $TaskPath); $defs[$TaskName] }
if ((Get-AdsPilotTaskXml "AdsPilot-Daily").Task.Version -ne "1.3") { throw "expected registered task" }
Write-Output "Windows templates: parsed, two triggers, missing + existing task lookup ok (no registration)"
