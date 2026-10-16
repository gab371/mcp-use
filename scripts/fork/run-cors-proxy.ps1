<#
.SYNOPSIS
    Starts the local MCP CORS Proxy on Windows.
.DESCRIPTION
    Runs 100% locally on Node.js without external npm dependencies.
    Usage:
        .\run-cors-proxy.ps1
        .\run-cors-proxy.ps1 3050
        .\run-cors-proxy.ps1 -Port 3050
#>

param (
    [Parameter(Position = 0)]
    [string]$Port,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ScriptPath = Join-Path $RootDir "scripts\fork\cors-proxy.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found in PATH. Please install Node.js from https://nodejs.org/"
    exit 1
}

Write-Host "🚀 Starting Local MCP CORS Proxy (PowerShell)..." -ForegroundColor Cyan

$nodeArgs = @($ScriptPath)
if ($Port) {
    $nodeArgs += $Port
}
if ($RemainingArgs) {
    $nodeArgs += $RemainingArgs
}

& node @nodeArgs
