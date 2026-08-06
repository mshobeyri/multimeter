@echo off
REM Multimeter CLI alias — forwards to testlight.exe in the same folder.
setlocal
"%~dp0testlight.exe" %*
exit /b %ERRORLEVEL%
