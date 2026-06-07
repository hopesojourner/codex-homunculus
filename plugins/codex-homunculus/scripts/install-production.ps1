param(
  [string] $CodexHome = "$env:USERPROFILE\.codex",
  [string] $PluginRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch] $InstallGlobalInstructions,
  [switch] $RegisterMaintenanceTask,
  [switch] $NoMaintenanceTask,
  [string] $TaskName = "Codex Homunculus Maintenance"
)

$ErrorActionPreference = "Stop"

$binDir = Join-Path $CodexHome "bin"
New-Item -ItemType Directory -Path $binDir -Force | Out-Null

$files = @(
  "codex-homunculus.cmd",
  "codex-homunculus-helper.cmd",
  "codex-with-homunculus.cmd",
  "vscode-homunculus-hook.ps1"
)

foreach ($file in $files) {
  $source = Join-Path $PSScriptRoot $file
  if (-not (Test-Path $source)) {
    throw "missing production helper file: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $binDir $file) -Force
}

$env:CODEX_HOME = $CodexHome
$env:CODEX_HOMUNCULUS_PLUGIN_ROOT = $PluginRoot

& (Join-Path $binDir "codex-homunculus-helper.cmd") health
if ($LASTEXITCODE -ne 0) {
  throw "Codex Homunculus helper health check failed"
}

if ($InstallGlobalInstructions) {
  & (Join-Path $binDir "codex-homunculus-helper.cmd") install --yes
  if ($LASTEXITCODE -ne 0) {
    throw "Codex Homunculus global instruction install failed"
  }
}

if (-not $NoMaintenanceTask) {
  $helper = Join-Path $binDir "codex-homunculus-helper.cmd"
  $action = New-ScheduledTaskAction -Execute $helper -Argument "maintenance"
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
  Write-Host "Codex Homunculus maintenance task registered: $TaskName"
} elseif ($RegisterMaintenanceTask) {
  Write-Host "Codex Homunculus maintenance task registration skipped because -NoMaintenanceTask was supplied"
}

Write-Host "Codex Homunculus production helper installed at $binDir"
