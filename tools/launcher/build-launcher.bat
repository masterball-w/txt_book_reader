@echo off
setlocal
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo ERROR: .NET Framework csc.exe not found
  exit /b 1
)

set "ICON=%ROOT%\build\icon.ico"
if exist "%ICON%" (
  "%CSC%" /nologo /optimize+ /target:winexe /win32icon:"%ICON%" /out:"ShuReader.exe" "tools\launcher\Launcher.cs"
) else (
  "%CSC%" /nologo /optimize+ /target:winexe /out:"ShuReader.exe" "tools\launcher\Launcher.cs"
)
if errorlevel 1 exit /b 1
echo Built: %CD%\ShuReader.exe
endlocal
