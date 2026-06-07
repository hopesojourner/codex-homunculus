@echo off
setlocal

set "HOMUNCULUS=%~dp0codex-homunculus.cmd"
if not exist "%HOMUNCULUS%" (
  echo error: could not find codex-homunculus.cmd beside this wrapper. 1>&2
  exit /b 1
)

if /I "%~1"=="--dry-run" (
  call "%HOMUNCULUS%" start
  if errorlevel 1 exit /b 1
  call "%HOMUNCULUS%" apply --context "Codex wrapper dry run in %CD%"
  if errorlevel 1 exit /b 1
  call "%HOMUNCULUS%" validate
  if errorlevel 1 exit /b 1
  exit /b 0
)

where codex >nul 2>nul
if errorlevel 1 (
  echo error: could not find codex on PATH. 1>&2
  exit /b 1
)

call "%HOMUNCULUS%" start
if errorlevel 1 exit /b %ERRORLEVEL%
call "%HOMUNCULUS%" apply --context "Codex wrapper session in %CD%"
if errorlevel 1 exit /b %ERRORLEVEL%

where /q codex
if errorlevel 1 (
  echo error: 'codex' command not found on PATH. Install Codex or use codex-homunculus.cmd directly. 1>&2
  exit /b 1
)

codex %*
set "CODEX_EXIT=%ERRORLEVEL%"

call "%HOMUNCULUS%" validate
if errorlevel 1 exit /b %ERRORLEVEL%
exit /b %CODEX_EXIT%
