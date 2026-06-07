@echo off
setlocal

set "HOMUNCULUS=%~dp0codex-homunculus.cmd"
if not exist "%HOMUNCULUS%" (
  echo error: could not find codex-homunculus.cmd beside this wrapper. 1>&2
  exit /b 1
)

if /I "%~1"=="--dry-run" (
  call "%HOMUNCULUS%" start
  call "%HOMUNCULUS%" apply --context "Codex wrapper dry run in %CD%"
  call "%HOMUNCULUS%" validate
  exit /b 0
)

where codex >nul 2>nul
if errorlevel 1 (
  echo error: could not find codex on PATH. 1>&2
  exit /b 1
)

call "%HOMUNCULUS%" start
call "%HOMUNCULUS%" apply --context "Codex wrapper session in %CD%"

codex %*
set "CODEX_EXIT=%ERRORLEVEL%"

call "%HOMUNCULUS%" validate
exit /b %CODEX_EXIT%
