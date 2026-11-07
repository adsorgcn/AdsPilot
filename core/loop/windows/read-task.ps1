# Query the root task folder through the Windows ScheduledTasks module.
# Listing first handles an empty folder in Windows PowerShell 5.1; that version
# can turn the expected stderr from schtasks /Query on a missing task into an error.
function Get-AdsPilotTaskXml([ValidatePattern('^[A-Za-z0-9_-]+$')][string]$Name) {
    $found = Get-ScheduledTask -ErrorAction Stop | Where-Object {
        $_.TaskPath -eq "\" -and $_.TaskName -eq $Name
    }
    if (!$found) { return $null }
    return [xml](Export-ScheduledTask -TaskName $Name -TaskPath "\" -ErrorAction Stop)
}
