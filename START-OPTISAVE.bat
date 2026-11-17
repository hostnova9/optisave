@echo off
cd /d "%~dp0"
echo ===========================================
echo   OptiSave - Local Testing Only
 echo ===========================================
where node >nul 2>&1
if errorlevel 1 (echo Node.js 20+ is required. & pause & exit /b 1)
if not exist node_modules\@electric-sql\pglite (
  echo Installing dependencies. Internet is needed only on this first run.
  call npm install
  if errorlevel 1 (echo npm install failed. & pause & exit /b 1)
)
echo Starting OptiSave. To shut down, press CTRL+C and wait for backup confirmation.
call npm start
if errorlevel 1 echo Startup failed. Check the message above.
pause
