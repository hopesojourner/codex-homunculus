$ErrorActionPreference = "Stop"
$RemainingArgs = $args
$HadCodexHome = Test-Path Env:CODEX_HOME
$OldCodexHome = $env:CODEX_HOME
$HadHomunculusHome = Test-Path Env:CODEX_HOMUNCULUS_HOME
$OldHomunculusHome = $env:CODEX_HOMUNCULUS_HOME

if ($env:CODEX_HOMUNCULUS_PLUGIN_ROOT) {
  $PluginRoot = $env:CODEX_HOMUNCULUS_PLUGIN_ROOT
} else {
  $PluginRoot = Join-Path $PSScriptRoot ".."
}

$ScriptPath = Join-Path $PluginRoot "scripts\homunculus.mjs"
if (-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) {
  $PluginRoot = Join-Path $PSScriptRoot "..\local-marketplaces\codex-homunculus\plugins\codex-homunculus"
  $ScriptPath = Join-Path $PluginRoot "scripts\homunculus.mjs"
}

if (-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) {
  Write-Error "Could not find Codex Homunculus CLI at $ScriptPath. Set CODEX_HOMUNCULUS_PLUGIN_ROOT."
  exit 1
}

try {
  if (-not $env:CODEX_HOME) {
    $env:CODEX_HOME = Join-Path $env:USERPROFILE ".codex"
  }

  if (-not $env:CODEX_HOMUNCULUS_HOME) {
    $env:CODEX_HOMUNCULUS_HOME = Join-Path $env:CODEX_HOME "homunculus"
  }

  & node $ScriptPath @RemainingArgs
  $ExitCode = $LASTEXITCODE
} finally {
  if ($HadCodexHome) {
    $env:CODEX_HOME = $OldCodexHome
  } else {
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
  }
  if ($HadHomunculusHome) {
    $env:CODEX_HOMUNCULUS_HOME = $OldHomunculusHome
  } else {
    Remove-Item Env:CODEX_HOMUNCULUS_HOME -ErrorAction SilentlyContinue
  }
}

exit $ExitCode
