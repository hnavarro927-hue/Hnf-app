@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title HNF Jarvis — arranque local

echo.
echo ========================================
echo   HNF / Jarvis — arranque local
echo ========================================
echo.
echo Carpeta del proyecto:
echo   %CD%
echo.
echo Este script inicia FRONTEND y BACKEND juntos
echo (equivalente a: npm run start:all^).
echo.
echo - Frontend: Vite  (suele ser puerto 5173^)
echo - Backend:  API   (suele ser puerto 4000^)
echo.
echo Deja esta ventana ABIERTA mientras operas.
echo Para detener: Ctrl+C en esta ventana.
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro npm. Instala Node.js LTS y reinicia la terminal.
  echo.
  pause
  exit /b 1
)

call npm run start:all
set EXITCODE=%ERRORLEVEL%

echo.
if not "%EXITCODE%"=="0" (
  echo [AVISO] Codigo de salida: %EXITCODE%.
  echo Si detuviste el servidor con Ctrl+C, es normal. Si no arranco, revisa Node/npm y la raiz del repo.
) else (
  echo Arranque finalizado.
)
echo.
pause
endlocal
exit /b %EXITCODE%
