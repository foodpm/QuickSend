@echo off
setlocal EnableExtensions
set PY=python
where %PY% >nul 2>nul || set PY="%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
%PY% "%~dp0quicksend\app.py"
endlocal
