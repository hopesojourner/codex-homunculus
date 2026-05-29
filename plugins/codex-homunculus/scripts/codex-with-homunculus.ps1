$ErrorActionPreference = "Stop"
$RemainingArgs = $args

$Homunculus = Join-Path $PSScriptRoot "codex-homunculus.ps1"
if (-not (Test-Path -LiteralPath $Homunculus -PathType Leaf)) {
  Write-Error "Could not find codex-homunculus.ps1 beside this wrapper."
  exit 1
}

$ContextPath = (Get-Location).Path
if ($RemainingArgs.Count -gt 0 -and $RemainingArgs[0] -ieq "--dry-run") {
  & $Homunculus start
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $Homunculus apply --context "Codex PowerShell wrapper dry run in $ContextPath"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $Homunculus validate
  exit $LASTEXITCODE
}

$CodexCommand = Get-Command codex -ErrorAction SilentlyContinue
if (-not $CodexCommand) {
  Write-Error "The 'codex' command was not found on PATH. Install Codex or use codex-homunculus.ps1 directly."
  exit 1
}

& $Homunculus start
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $Homunculus apply --context "Codex PowerShell wrapper session in $ContextPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& codex @RemainingArgs
$CodexExit = $LASTEXITCODE

& $Homunculus validate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
exit $CodexExit
