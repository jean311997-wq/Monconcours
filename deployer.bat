@echo off
chcp 65001 >nul
title Mon Concours - mise en ligne
cd /d "%~dp0"

echo.
echo   ================================================
echo     MON CONCOURS - mise en ligne
echo   ================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo   [X] Git n'est pas installe sur cet ordinateur.
  echo.
  echo   Installez-le une seule fois depuis :
  echo   https://git-scm.com/download/win
  echo.
  pause
  exit /b
)

if not exist ".git" (
  echo   [X] Ce dossier n'est pas relie a GitHub.
  echo.
  echo   Ouvrez ce dossier et lancez une seule fois :
  echo     git clone https://github.com/jean311997-wq/Monconcours.git
  echo.
  pause
  exit /b
)

echo   Fichiers modifies :
echo.
git status --short
echo.

git add -A

git diff --cached --quiet
if not errorlevel 1 (
  echo   [i] Aucun changement a envoyer. Tout est deja en ligne.
  echo.
  pause
  exit /b
)

set HORODATAGE=%date% %time:~0,5%
git commit -m "Mise a jour du %HORODATAGE%" >nul

echo   Envoi vers GitHub...
git push
if errorlevel 1 (
  echo.
  echo   [X] L'envoi a echoue.
  echo   Verifiez votre connexion Internet, ou vos identifiants GitHub.
  echo.
  pause
  exit /b
)

echo.
echo   ================================================
echo     [OK] Envoye. Vercel met le site a jour.
echo     Comptez une minute, puis ouvrez :
echo     https://monconcours.vercel.app
echo   ================================================
echo.
pause
