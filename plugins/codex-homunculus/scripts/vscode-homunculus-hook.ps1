param(
  [string]$EventName = ""
)

$ErrorActionPreference = "Stop"

function Limit-Text {
  param([string]$Text, [int]$Limit = 3000)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }
  if ($Text.Length -le $Limit) {
    return $Text
  }
  return $Text.Substring(0, $Limit) + "`n[truncated]"
}

function Write-HookJson {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$rawInput = [Console]::In.ReadToEnd()
$hookInput = $null
try {
  if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
    $hookInput = $rawInput | ConvertFrom-Json -Depth 50
  }
} catch {
  $hookInput = $null
}

if ([string]::IsNullOrWhiteSpace($EventName) -and $hookInput -and $hookInput.hookEventName) {
  $EventName = [string]$hookInput.hookEventName
}

$workspace = (Get-Location).Path
if ($hookInput -and $hookInput.cwd -and (Test-Path -LiteralPath ([string]$hookInput.cwd))) {
  $workspace = [string]$hookInput.cwd
}

$homunculus = Join-Path $env:USERPROFILE ".codex\bin\codex-homunculus.cmd"
if (-not (Test-Path -LiteralPath $homunculus)) {
  Write-HookJson @{
    continue = $true
    systemMessage = "Codex Homunculus hook skipped: $homunculus was not found."
  }
}

function Invoke-Homunculus {
  param([string[]]$Arguments)
  $oldLocation = (Get-Location).Path
  try {
    Set-Location -LiteralPath $workspace
    $output = & $homunculus @Arguments 2>&1
    return (($output | Out-String).Trim())
  } catch {
    return "error: $($_.Exception.Message)"
  } finally {
    Set-Location -LiteralPath $oldLocation
  }
}

switch ($EventName) {
  "SessionStart" {
    $start = Invoke-Homunculus @("start")
    $apply = Invoke-Homunculus @("apply", "--context", "VS Code session start in $workspace")
    $context = Limit-Text "Codex Homunculus started for this VS Code agent session.`n`n$start`n`nRelevant instincts:`n$apply"
    Write-HookJson @{
      continue = $true
      hookSpecificOutput = @{
        hookEventName = "SessionStart"
        additionalContext = $context
      }
    }
  }
  "UserPromptSubmit" {
    $prompt = ""
    if ($hookInput -and $hookInput.prompt) {
      $prompt = [string]$hookInput.prompt
    }
    $apply = Invoke-Homunculus @("apply", "--context", $prompt)
    if ($apply -match "no matching instincts") {
      Write-HookJson @{ continue = $true }
    }
    $context = Limit-Text "Codex Homunculus relevant instincts for this prompt:`n$apply"
    Write-HookJson @{
      continue = $true
      hookSpecificOutput = @{
        hookEventName = "UserPromptSubmit"
        additionalContext = $context
      }
    }
  }
  "Stop" {
    $validate = Invoke-Homunculus @("validate")
    if ($validate -notmatch "validation passed") {
      Write-HookJson @{
        continue = $true
        systemMessage = "Codex Homunculus validation warning: $(Limit-Text $validate 1000)"
      }
    }
    Write-HookJson @{ continue = $true }
  }
  default {
    Write-HookJson @{ continue = $true }
  }
}
