[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet("Daily","Sentinel")][string]$Kind,
    [Parameter(Mandatory)][string]$Python,
    [string]$EnvFile
)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Join-Path $PSScriptRoot "../../..")
$env:PYTHONUTF8 = "1"
if ($Kind -eq "Sentinel") {
    & (Join-Path $PSScriptRoot "sentinel.ps1")
    exit $LASTEXITCODE
}
if ($EnvFile) {
    $item = Get-Item -LiteralPath $EnvFile
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing a linked environment file." }
    $acl = Get-Acl -LiteralPath $item.FullName
    $me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $allowed = @($me, "S-1-5-18")
    if ($allowed -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value) {
        throw "Environment file owner must be the task account or SYSTEM."
    }
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq "Allow" -and $allowed -notcontains $rule.IdentityReference.Value) {
            throw "Environment file must be private to the task account and SYSTEM."
        }
    }
    foreach ($line in [IO.File]::ReadAllLines($item.FullName)) {
        if (!$line.Trim() -or $line.TrimStart().StartsWith("#")) { continue }
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { throw "Invalid environment file line." }
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
    }
}
& $Python -X utf8 "core/loop/daily.py"
exit $LASTEXITCODE
