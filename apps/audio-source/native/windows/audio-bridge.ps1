param(
    [ValidateSet("query", "set", "watch", "self-test")]
    [string]$Action = "query",
    [ValidateSet("output", "input")]
    [string]$Scope = "output",
    [string]$DeviceId = ""
)

$ErrorActionPreference = "Stop"
$sourcePath = Join-Path $PSScriptRoot "Program.cs"
Add-Type -Language CSharp -Path $sourcePath -ReferencedAssemblies "System.Web.Extensions"

$arguments = @($Action, $Scope)
if ($Action -eq "set") {
    $arguments += $DeviceId
}

$exitCode = [Program]::Main($arguments)
exit $exitCode
