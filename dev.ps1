# KDExpress Dev Server Launcher
# Requires Node.js — uses portable version from TEMP if needed

$nodeBin = "$env:TEMP\node-extract\node-v22.16.0-win-x64"

if (-not (Test-Path "$nodeBin\node.exe")) {
    Write-Host "Node.js not found at $nodeBin"
    Write-Host "Please install Node.js from https://nodejs.org/en/download/ or run setup.ps1"
    exit 1
}

$env:PATH = "$nodeBin;$env:PATH"
Set-Location $PSScriptRoot

# Load .env.local
if (Test-Path ".env.local") {
    Get-Content ".env.local" | Where-Object { $_ -match "^[^#]" } | ForEach-Object {
        $parts = $_ -split "=", 2
        if ($parts.Count -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}

Write-Host "Starting KDExpress dev server..."
Write-Host "Open http://localhost:3000"
& "$nodeBin\npm.cmd" run dev
