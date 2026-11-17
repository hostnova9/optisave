@echo off
cd /d "%~dp0"
echo FIRST STOP OPTISAVE in its other window with CTRL+C.
set /p OK="Is OptiSave stopped? Type YES: "
if /I not "%OK%"=="YES" exit /b 1
call npm run db:backup
pause
