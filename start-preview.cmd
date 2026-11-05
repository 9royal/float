@echo off
setlocal
cd /d "%~dp0"
set "task_node="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined task_node set "task_node=%%N"
if not defined task_node for /f "delims=" %%N in ('powershell.exe -NoProfile -Command "$r=Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' ^| Sort-Object Version -Descending ^| Select-Object -First 1; if($r){Join-Path $r.InstallLocation 'dependencies\node\bin\node.exe'}"') do set "task_node=%%N"
if not defined task_node (
  echo Node.js 20 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
if "%~1"=="--no-open" (
  "%task_node%" preview.mjs
) else (
  "%task_node%" preview.mjs --open
)
pause
