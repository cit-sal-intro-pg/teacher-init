@echo off
setlocal
rem =======================================================
rem SAL 教師用観察パネル - 事前キャッシュスクリプト (Windows)
rem (授業前にインターネット接続環境で1回だけ実行)
rem =======================================================
cd /d "%~dp0"

set "DENO_BIN="
where deno >nul 2>nul
if %errorlevel% equ 0 (
    set "DENO_BIN=deno"
) else if exist "%USERPROFILE%\.deno\bin\deno.exe" (
    set "DENO_BIN=%USERPROFILE%\.deno\bin\deno.exe"
) else if exist "%LOCALAPPDATA%\deno\bin\deno.exe" (
    set "DENO_BIN=%LOCALAPPDATA%\deno\bin\deno.exe"
) else if exist "%ProgramFiles%\deno\deno.exe" (
    set "DENO_BIN=%ProgramFiles%\deno\deno.exe"
)

if not defined DENO_BIN (
    echo =======================================================
    echo [ERROR] Deno が見つかりませんでした。
    echo 本スクリプトの実行には Deno のインストールが必要です。
    echo.
    echo PowerShell を開き、以下のコマンドを実行してインストールしてください:
    echo   irm https://deno.land/install.ps1 ^| iex
    echo =======================================================
    pause
    exit /b 1
)

"%DENO_BIN%" run -A init.ts --prep
echo.
echo =======================================================
echo [OK] 事前キャッシュが完了しました。授業本番では start.bat を実行してください。
echo =======================================================
pause
