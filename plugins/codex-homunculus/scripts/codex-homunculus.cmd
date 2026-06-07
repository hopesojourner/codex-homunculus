@echo off
setlocal

if defined CODEX_HOMUNCULUS_PLUGIN_ROOT (
  set "PLUGIN_ROOT=%CODEX_HOMUNCULUS_PLUGIN_ROOT%"
) else (
  set "PLUGIN_ROOT=%~dp0.."
)

if not exist "%PLUGIN_ROOT%\scripts\homunculus.mjs" (
  set "PLUGIN_ROOT=%~dp0..\local-marketplaces\codex-homunculus\plugins\codex-homunculus"
)

if not exist "%PLUGIN_ROOT%\scripts\homunculus.mjs" (
  echo error: could not find Codex Homunculus plugin root. Set CODEX_HOMUNCULUS_PLUGIN_ROOT. 1>&2
  exit /b 1
)

if not defined CODEX_HOME (
  set "CODEX_HOME=%USERPROFILE%\.codex"
)

if not defined CODEX_HOMUNCULUS_HOME (
  set "CODEX_HOMUNCULUS_HOME=%CODEX_HOME%\homunculus"
)

node "%PLUGIN_ROOT%\scripts\homunculus.mjs" %*
