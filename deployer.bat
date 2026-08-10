@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo  ================================================
echo     MON CONCOURS - mise en ligne
echo  ================================================
echo.
echo  Dossier de travail :
echo    %CD%
echo.

if not exist ".git" (
  echo  [X] Ce dossier n'est PAS le depot GitHub.
  pause & exit /b 1
)

rem ================================================================
rem  1. LE DOSSIER EST-IL COMPLET ?
rem     Indispensable : si on impose cette version a GitHub,
rem     tout fichier absent ici sera efface la-bas.
rem ================================================================
set MANQUE=0
echo  Verification du dossier :
echo  ------------------------------------------------
for %%F in (
  app.js index.html styles.css sw.js
  admin.js admin.html admin.css
  vercel.json manifest.webmanifest robots.txt
  supabase-js.min.js
  icone-192.png icone-512.png icone-maskable-512.png
  apple-touch-icon.png favicon.png
) do (
  if exist "%%F" (
    for %%A in ("%%F") do echo    [OK] %%F   %%~tA
  ) else (
    echo    [MANQUANT] %%F
    set MANQUE=1
  )
)
echo.

set MALNOMME=0
for %%F in ("*(*)*.js" "*(*)*.html" "*(*)*.css" "*(*)*.png") do (
  if exist "%%~F" ( echo    [!] Fichier mal nomme : %%~nxF & set MALNOMME=1 )
)
if "!MALNOMME!"=="1" (
  echo.
  echo  [X] Renommez d'abord les fichiers entre parentheses, puis relancez.
  pause & exit /b 1
)

rem ================================================================
rem  2. ENREGISTRER CE QUI A CHANGE
rem ================================================================
git add -A
git diff --cached --quiet
if errorlevel 1 (
  for /f %%i in ('git diff --cached --name-only ^| find /c /v ""') do set NB=%%i
  echo  !NB! fichier^(s^) enregistre^(s^).
  git commit -q -m "Mise a jour du %DATE% %TIME:~0,5%"
) else (
  echo  [i] Rien de neuf a enregistrer localement.
)
echo.

rem ================================================================
rem  3. ENVOI NORMAL
rem ================================================================
echo  Envoi vers GitHub...
git push 2>envoi.log
if not errorlevel 1 (
  del envoi.log >nul 2>&1
  echo.
  echo  ================================================
  echo   [OK] Envoye. Vercel deploie dans une minute.
  echo  ================================================
  echo.
  pause & exit /b 0
)

rem ================================================================
rem  4. ENVOI REFUSE : LES DEUX VERSIONS ONT DIVERGE
rem ================================================================
type envoi.log
del envoi.log >nul 2>&1
echo.
echo  ------------------------------------------------
echo   GitHub a refuse l'envoi.
echo.
echo   Raison : GitHub contient des modifications que cet
echo   ordinateur n'a jamais recues ^(les envois faits depuis
echo   le site web^). Git ne sait pas laquelle garder.
echo  ------------------------------------------------
echo.

if "!MANQUE!"=="1" (
  echo  [X] IMPOSSIBLE de continuer : des fichiers manquent dans ce
  echo      dossier ^(voir la liste [MANQUANT] plus haut^).
  echo      Si on imposait cette version, ces fichiers seraient
  echo      effaces de votre site.
  echo.
  echo      Remettez-les dans ce dossier, puis relancez.
  echo.
  pause & exit /b 1
)

echo  Votre dossier est complet : les 16 fichiers sont presents.
echo.
echo  Voulez-vous IMPOSER la version de cet ordinateur ?
echo  GitHub sera remplace par ce que vous avez ici.
echo.
set /p REPONSE=  Tapez O pour confirmer, ou N pour annuler :
echo.

if /i not "!REPONSE!"=="O" (
  echo  Annule. Rien n'a ete envoye.
  pause & exit /b 0
)

echo  Envoi force en cours...
git push --force-with-lease
if errorlevel 1 (
  echo.
  echo  [X] Refuse a nouveau. Essai en mode complet...
  git push --force
  if errorlevel 1 (
    echo  [X] Echec. Verifiez votre connexion et vos identifiants GitHub.
    pause & exit /b 1
  )
)

echo.
echo  ================================================
echo   [OK] Votre version est en ligne.
echo   Vercel deploie dans une minute.
echo  ================================================
echo.
echo  IMPORTANT : n'envoyez plus de fichiers depuis le site
echo  web de GitHub. Utilisez toujours ce script, sinon les
echo  deux versions divergeront a nouveau.
echo.
pause
