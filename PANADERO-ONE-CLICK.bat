@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PANADERO - One-Click Local Setup

color 0A
echo.
echo ================================================
echo        PANADERO BAKING SYSTEM - LOCAL SETUP
echo ================================================
echo.
echo This window will prepare the database, install the
 echo Node.js packages, start PANADERO, and open Login.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not in PATH.
  echo Install Node.js LTS, restart Windows, then run this file again.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js LTS and try again.
  pause
  exit /b 1
)

set "MYSQL="
where mysql >nul 2>&1
if not errorlevel 1 set "MYSQL=mysql"
if not defined MYSQL if exist "C:\xampp\mysql\bin\mysql.exe" set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
if not defined MYSQL if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" set "MYSQL=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
if not defined MYSQL if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" set "MYSQL=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
if not defined MYSQL (
  echo [ERROR] MySQL was not found.
  echo Start XAMPP/MySQL or add the MySQL bin folder to PATH.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [1/5] Creating local configuration from .env.example...
  copy /y ".env.example" ".env" >nul
) else (
  echo [1/5] Existing .env found - keeping your local settings.
)

echo [2/5] Checking MySQL and importing the database...
"%MYSQL%" --protocol=tcp -h 127.0.0.1 -P 3306 -u root -e "SELECT 1" >nul 2>nul
if errorlevel 1 (
  echo MySQL is not responding. Trying common local services...
  sc query MySQL80 >nul 2>&1 && net start MySQL80 >nul 2>&1
  sc query MySQL >nul 2>&1 && net start MySQL >nul 2>&1
  if exist "C:\xampp\mysql_start.bat" start "" /min "C:\xampp\mysql_start.bat"
  timeout /t 5 /nobreak >nul
)
"%MYSQL%" --protocol=tcp -h 127.0.0.1 -P 3306 -u root < "Arambulo-and-galvez.sql" >nul 2>nul
if errorlevel 1 (
  echo.
  echo MySQL rejected the root account without a password.
  echo If your MySQL root account has a password, enter it now.
  echo.
  set "MYSQL_PASSWORD="
  set /p "MYSQL_PASSWORD=MySQL root password: "
  set "MYSQL_PWD=%MYSQL_PASSWORD%"
  "%MYSQL%" --protocol=tcp -h 127.0.0.1 -P 3306 -u root < "Arambulo-and-galvez.sql"
  set "MYSQL_PWD="
  if errorlevel 1 (
    echo.
    echo [ERROR] Database setup failed.
    echo Make sure MySQL/XAMPP is running and check the password.
    pause
    exit /b 1
  )
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Content -Raw '.env'; $p=[regex]::Replace($p,'(?m)^DB_PASSWORD=.*$','DB_PASSWORD=' + $env:MYSQL_PASSWORD); Set-Content -NoNewline '.env' $p"
)

echo [3/5] Installing Node.js packages if needed...
if not exist "node_modules\express" (
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo Dependencies are already installed.
)

echo [4/5] Starting PANADERO server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 .*LISTENING"') do set "OLD_PID=%%P"
if defined OLD_PID (
  echo A server is already using port 3000. Reusing it.
) else (
  start "PANADERO Server" /min cmd /c "cd /d ""%~dp0"" && npm start"
  echo Waiting for the server to start...
  set "READY="
  for /l %%N in (1,1,30) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:3000/api/health; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 set "READY=1"
    if defined READY goto server_ready
    timeout /t 1 /nobreak >nul
  )
  echo [ERROR] PANADERO did not start within 30 seconds.
  echo Check the minimized PANADERO Server window for details.
  pause
  exit /b 1
)

:server_ready
echo [5/5] Opening PANADERO Login...
start "" "http://localhost:3000/login.html"
echo.
echo ================================================
echo PANADERO IS READY
echo Login: http://localhost:3000/login.html
echo Keep the PANADERO Server window running.
echo Close it when you are finished.
echo ================================================
echo.
timeout /t 5 /nobreak >nul
exit /b 0
