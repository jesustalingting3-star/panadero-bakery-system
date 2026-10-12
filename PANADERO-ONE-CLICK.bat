@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title PANADERO - Safe Local Launcher
color 0A

REM ================================================================
REM PANADERO SAFE LOCAL LAUNCHER
REM ---------------------------------------------------------------
REM This script NEVER starts, stops, kills, repairs, reconfigures,
REM or edits XAMPP / MariaDB itself.
REM It only connects through C:\xampp\mysql\bin\mysql.exe, like
REM MySQL Workbench does.
REM ================================================================

set "DB_ONLY=0"
if /I "%~1"=="--db-only" set "DB_ONLY=1"

set "MYSQL_EXE=C:\xampp\mysql\bin\mysql.exe"
set "MYSQLDUMP_EXE=C:\xampp\mysql\bin\mysqldump.exe"
set "SQL_FILE=%CD%\database\panadero.sql"
set "DB_NAME=panadero_bakery"
set "DB_HOST=127.0.0.1"
set "DB_PORT=3306"
set "DB_USER=root"
set "MYSQL_PASSWORD="
set "MYSQL_PWD="
set "TEMP_DATADIR=%TEMP%\panadero-datadir-%RANDOM%.txt"
set "TEMP_DBCHK=%TEMP%\panadero-dbchk-%RANDOM%.txt"
set "EXIT_CODE=1"

if "%DB_ONLY%"=="1" (
  echo.
  echo ================================================================
  echo          PANADERO - SAFE DATABASE IMPORT ONLY
  echo ================================================================
) else (
  echo.
  echo ================================================================
  echo              PANADERO - SAFE LOCAL LAUNCHER
  echo ================================================================
)

echo.
echo SAFETY: This BAT will NOT start or stop XAMPP MySQL.
echo Start MySQL yourself from the XAMPP Control Panel first.
echo.

REM ----- Required project files -----
if not exist "%SQL_FILE%" (
  echo [ERROR] SQL file not found:
  echo         %SQL_FILE%
  goto :FAIL
)

if not exist "%MYSQL_EXE%" (
  echo [ERROR] XAMPP MySQL client was not found at:
  echo         %MYSQL_EXE%
  echo.
  echo This launcher is intentionally locked to your XAMPP installation
  echo so it cannot accidentally import into another MySQL server.
  goto :FAIL
)

if not exist "%MYSQLDUMP_EXE%" (
  echo [ERROR] XAMPP mysqldump was not found at:
  echo         %MYSQLDUMP_EXE%
  goto :FAIL
)

REM ----- Confirm something is listening on 3306 -----
echo [1/7] Checking XAMPP MySQL...
netstat -ano | findstr /R /C:":3306 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [STOPPED] Nothing is listening on port 3306.
  echo.
  echo Open XAMPP Control Panel, click Start beside MySQL,
  echo wait until it stays green, then run this BAT again.
  echo.
  echo This BAT will NOT start MySQL for you by design.
  goto :FAIL
)

REM ----- Try default XAMPP root account with blank password -----
"%MYSQL_EXE%" --protocol=tcp -h%DB_HOST% -P%DB_PORT% -u%DB_USER% --connect-timeout=3 -N -B --raw -e "SELECT @@datadir;" > "%TEMP_DATADIR%" 2>nul
if errorlevel 1 goto :PASSWORD_REQUIRED
goto :MYSQL_CONNECTED

:PASSWORD_REQUIRED
echo       Root login without a password was rejected.
echo       Enter your XAMPP MySQL root password.
echo       Your typing will be hidden.
echo.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$s=Read-Host 'MySQL root password' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"`) do set "MYSQL_PASSWORD=%%P"
set "MYSQL_PWD=%MYSQL_PASSWORD%"
"%MYSQL_EXE%" --protocol=tcp -h%DB_HOST% -P%DB_PORT% -u%DB_USER% --connect-timeout=3 -N -B --raw -e "SELECT @@datadir;" > "%TEMP_DATADIR%" 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Could not log in to XAMPP MySQL as root.
  echo Check the password and make sure XAMPP MySQL is running.
  goto :FAIL
)

:MYSQL_CONNECTED
REM ----- Verify this is actually the XAMPP server -----
REM MySQL batch output may use normal, escaped, or forward slashes.
findstr /I /L /C:"C:\xampp\mysql\data" /C:"C:\\xampp\\mysql\\data" /C:"C:/xampp/mysql/data" "%TEMP_DATADIR%" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Port 3306 is not using the expected XAMPP data directory.
  echo The server reported:
  type "%TEMP_DATADIR%"
  echo.
  echo Import was cancelled so PANADERO cannot touch the wrong server.
  goto :FAIL
)

echo       XAMPP MySQL connection: OK

REM ----- Keep Node backend DB settings synchronized -----
echo [2/7] Preparing PANADERO database configuration...
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
  ) else (
    type nul > ".env"
  )
)

set "PANADERO_DB_PASSWORD=%MYSQL_PASSWORD%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path='.env'; $lines=@('PORT=3000','DB_HOST=127.0.0.1','DB_PORT=3306','DB_USER=root','DB_PASSWORD=' + $env:PANADERO_DB_PASSWORD,'DB_NAME=panadero_bakery','DB_SSL=false'); [IO.File]::WriteAllLines((Join-Path (Get-Location) $path),$lines,(New-Object Text.UTF8Encoding($false)))" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Could not write the local .env configuration.
  goto :FAIL
)

REM ----- Backup existing PANADERO database before any import -----
echo [3/7] Checking for an existing PANADERO database...
"%MYSQL_EXE%" --protocol=tcp -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -N -B -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='%DB_NAME%';" > "%TEMP_DBCHK%" 2>nul
findstr /I /X "%DB_NAME%" "%TEMP_DBCHK%" >nul 2>&1
if not errorlevel 1 (
  call :BACKUP_EXISTING_DB
  if errorlevel 1 goto :FAIL
) else (
  echo       No existing PANADERO database found. Fresh import will be used.
)

REM ----- Import idempotent project schema -----
echo [4/7] Importing database\panadero.sql...
"%MYSQL_EXE%" --protocol=tcp -h%DB_HOST% -P%DB_PORT% -u%DB_USER% < "%SQL_FILE%"
if errorlevel 1 (
  echo.
  echo [ERROR] SQL import failed.
  echo XAMPP itself was not modified or restarted.
  goto :FAIL
)

REM ----- Verify expected schema and base tables -----
echo [5/7] Verifying imported database...
"%MYSQL_EXE%" --protocol=tcp -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -N -B -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='%DB_NAME%' AND TABLE_NAME IN ('users','categories','bread_products','orders','order_items','system_logs');" > "%TEMP_DBCHK%" 2>nul
set "TABLE_COUNT="
set /p TABLE_COUNT=<"%TEMP_DBCHK%"
if not "%TABLE_COUNT%"=="6" (
  echo.
  echo [ERROR] Database import completed but required tables were not all found.
  echo Expected 6 base tables, found: %TABLE_COUNT%
  goto :FAIL
)

echo       Database: %DB_NAME%
echo       Required base tables: OK

echo.
echo       MySQL Workbench can now see this database.
echo       In Workbench: SCHEMAS ^> Refresh ^> panadero_bakery

if "%DB_ONLY%"=="1" goto :DB_ONLY_SUCCESS

REM ----- Node.js -----
echo [6/7] Checking Node.js and dependencies...
set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  echo [ERROR] Node.js was not found in PATH.
  echo Install Node.js LTS, then run this BAT again.
  goto :FAIL
)

for %%D in ("%NODE_EXE%") do set "NODE_DIR=%%~dpD"
set "NPM_CLI=%NODE_DIR%node_modules\npm\bin\npm-cli.js"
if not exist "%NPM_CLI%" (
  echo [ERROR] npm-cli.js was not found beside your Node.js installation:
  echo         %NPM_CLI%
  echo Reinstall Node.js LTS with npm included.
  goto :FAIL
)

if not exist "node_modules\express\package.json" (
  echo       Installing Node.js packages...
  "%NODE_EXE%" "%NPM_CLI%" install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm package installation failed.
    goto :FAIL
  )
) else (
  echo       Node.js dependencies: OK
)

REM ----- Never kill/reuse an unrelated program on port 3000 -----
echo [7/7] Starting PANADERO...
REM ----- Only reuse a server if it is THIS updated PANADERO build -----
REM The health endpoint alone is not sufficient: older builds may also return OK.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try {$b=Invoke-RestMethod -TimeoutSec 2 http://127.0.0.1:3000/api/build; $h=Invoke-RestMethod -TimeoutSec 2 http://127.0.0.1:3000/api/health; if($b.build -eq 'panadero-full-audit-20261011-r6' -and $h.ok -and $h.database){exit 0}else{exit 1}} catch {exit 1}" >nul 2>&1
if not errorlevel 1 goto :SERVER_READY

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo [ERROR] Port 3000 already has an app or an OLD PANADERO server.
  echo PANADERO will NOT kill or reuse that process automatically.
  echo Close the OLD PANADERO Server terminal and run this BAT again.
  echo If you started it in PowerShell, press Ctrl+C there first.
  goto :FAIL
)

start "PANADERO Server - Keep Open" cmd.exe /k ""%NODE_EXE%" "%CD%\server.js""
echo       Waiting for PANADERO server...
for /L %%N in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try {$b=Invoke-RestMethod -TimeoutSec 1 http://127.0.0.1:3000/api/build; $h=Invoke-RestMethod -TimeoutSec 1 http://127.0.0.1:3000/api/health; if($b.build -eq 'panadero-full-audit-20261011-r6' -and $h.ok -and $h.database){exit 0}else{exit 1}} catch {exit 1}" >nul 2>&1
  if not errorlevel 1 goto :SERVER_READY
  timeout /t 1 /nobreak >nul
)

echo.
echo [ERROR] PANADERO did not become ready within 30 seconds.
echo Check the separate PANADERO Server window for the exact error.
goto :FAIL

:SERVER_READY
echo.
echo ================================================================
echo                     PANADERO IS READY
echo ================================================================
echo Database : panadero_bakery on XAMPP MySQL
echo Website  : http://127.0.0.1:3000/customer/login.html
echo.
echo XAMPP MySQL was NOT started, stopped, killed, or reconfigured.
echo Keep XAMPP MySQL and the PANADERO Server window running.
echo ================================================================
echo.
start "" "http://127.0.0.1:3000/customer/login.html"
goto :SUCCESS

:DB_ONLY_SUCCESS
echo.
echo ================================================================
echo                  DATABASE IMPORT COMPLETE
echo ================================================================
echo Database: panadero_bakery
echo Server  : XAMPP MySQL at 127.0.0.1:3306
echo.
echo Open MySQL Workbench and refresh SCHEMAS.
echo You should see: panadero_bakery
echo.
echo XAMPP MySQL was NOT started, stopped, killed, or reconfigured.
echo ================================================================
echo.
pause
goto :SUCCESS

:BACKUP_EXISTING_DB
if not exist "database_backups" mkdir "database_backups" >nul 2>&1
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "BACKUP_STAMP=%%T"
set "BACKUP_FILE=%CD%\database_backups\panadero_bakery_%BACKUP_STAMP%.sql"
echo       Existing database found. Creating a safety backup...
"%MYSQLDUMP_EXE%" --protocol=tcp -h%DB_HOST% -P%DB_PORT% -u%DB_USER% --single-transaction --routines --triggers --events --databases %DB_NAME% > "%BACKUP_FILE%" 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Existing database backup failed.
  echo Import has been cancelled. Nothing was changed.
  if exist "%BACKUP_FILE%" del /q "%BACKUP_FILE%" >nul 2>&1
  exit /b 1
)
echo       Backup saved: database_backups\panadero_bakery_%BACKUP_STAMP%.sql
exit /b 0

:FAIL
set "EXIT_CODE=1"
goto :CLEANUP

:SUCCESS
set "EXIT_CODE=0"
goto :CLEANUP

:CLEANUP
set "MYSQL_PWD="
set "MYSQL_PASSWORD="
set "PANADERO_DB_PASSWORD="
if exist "%TEMP_DATADIR%" del /q "%TEMP_DATADIR%" >nul 2>&1
if exist "%TEMP_DBCHK%" del /q "%TEMP_DBCHK%" >nul 2>&1
if "%EXIT_CODE%"=="1" (
  echo.
  echo No XAMPP service was started, stopped, killed, repaired, or reconfigured.
  echo.
  pause
)
exit /b %EXIT_CODE%
