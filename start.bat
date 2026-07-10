@echo off
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
node_modules\electron\dist\electron.exe .
