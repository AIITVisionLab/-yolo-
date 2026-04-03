@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "NPM_CMD="

where npm.cmd >nul 2>nul
if %ERRORLEVEL%==0 (
  set "NPM_CMD=npm.cmd"
) else (
  echo [npmw] npm.cmd was not found on PATH.
  echo [npmw] Install Node.js and ensure npm.cmd is available.
  exit /b 1
)

pushd "%SCRIPT_DIR%" >nul
call %NPM_CMD% %*
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul

exit /b %EXIT_CODE%
