<#
Windows audio bridge launcher.

Responsibilities:
- Loads the strongly typed C# Core Audio bridge implementation.
- Reads action/scope/device inputs from environment variables.
- Executes query/set/watch operations and writes JSON or change events.

Environment contract:
- SD_AUDIO_ACTION: query | set | watch
- SD_AUDIO_FLOW: output | input
- SD_AUDIO_DEVICE_ID: required for set
#>
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$csPath = Join-Path $scriptDir "audio-bridge.cs"
Add-Type -Language CSharp -Path $csPath

$action = $env:SD_AUDIO_ACTION
$deviceId = $env:SD_AUDIO_DEVICE_ID
$flow = if ($env:SD_AUDIO_FLOW -eq "input") { [EDataFlow]::eCapture } else { [EDataFlow]::eRender }

# Set applies requested device before emitting resulting state.
if ($action -eq "set") {
    if ([string]::IsNullOrWhiteSpace($deviceId)) {
        throw "Device id is required for set action."
    }

    [AudioEndpointBridge]::SetDefault($deviceId)
}

# Watch emits line-delimited events (`ready` then `changed`) and blocks.
if ($action -eq "watch") {
    [AudioEndpointBridge]::Watch($flow)
    exit 0
}

# Query/set return a compact JSON payload consumed by Node.js.
$result = [AudioEndpointBridge]::Query($flow)
$result | ConvertTo-Json -Depth 10 -Compress
