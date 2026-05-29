param(
  [string] $CodexHome = "$env:USERPROFILE\.codex",
  [switch] $UnregisterMaintenanceTask,
  [string] $TaskName = "Codex Homunculus Maintenance"
)

$ErrorActionPreference = "Stop"

$binDir = Join-Path $CodexHome "bin"
$files = @(
  "codex-homunculus.cmd",
  "codex-homunculus-helper.cmd",
  "codex-with-homunculus.cmd",
  "vscode-homunculus-hook.ps1"
)

foreach ($file in $files) {
  $target = Join-Path $binDir $file
  if (Test-Path $target) {
    Remove-Item -LiteralPath $target -Force
  }
}

if ($UnregisterMaintenanceTask) {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }
}

Write-Host "Codex Homunculus production helper files removed from $binDir"
