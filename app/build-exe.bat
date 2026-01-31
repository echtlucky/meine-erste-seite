@echo off
title LCKY HUB - Windows EXE Builder

echo ========================================
echo   LCKY HUB - Windows EXE Builder
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [1/4] Installiere Abhaengigkeiten...
    npm install
    echo.
) else (
    echo [1/4] Abhaengigkeiten bereits vorhanden.
    echo.
)

echo [2/4] Baue Windows EXE...
echo.

npm run build:win

echo.
echo [3/4] Pruefe Build-Ergebnis...
echo.

REM Check for generated EXE (matches artifactName)
for %%f in ("dist\*Setup*.exe") do (
    echo EXE gefunden:
    echo   %%f
    set FOUND_EXE=1
)

if not defined FOUND_EXE (
    echo ❌ Keine EXE gefunden!
    echo Bitte pruefe den dist-Ordner manuell.
) else (
    echo.
    echo ✅ EXE erfolgreich erstellt!
)

echo.
echo [4/4] Fertig!
echo.
echo ========================================
echo   Installation:
echo   1. Oeffne den 'dist' Ordner
echo   2. Starte die Setup-EXE
echo   3. Folge dem Installationsassistenten
echo ========================================
echo.

pause