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

rem --- 1. Est-ce bien un depot git ? ---------------------------------
if not exist ".git" (
  echo  [X] ERREUR : ce dossier n'est PAS le depot GitHub.
  echo      Le fichier .git est introuvable ici.
  echo      Placez deployer.bat dans le dossier Monconcours et relancez.
  echo.
  pause
  exit /b 1
)

rem --- 2. Fichiers presents et leur date -----------------------------
echo  Fichiers presents dans ce dossier :
echo  ------------------------------------------------
for %%F in (app.js index.html styles.css sw.js admin.js admin.html admin.css vercel.json manifest.webmanifest) do (
  if exist "%%F" (
    for %%A in ("%%F") do echo    [OK] %%F   modifie le %%~tA
  ) else (
    echo    [MANQUANT] %%F
  )
)
echo.

rem --- 3. Fichiers mal nommes ----------------------------------------
set MALNOMME=0
for %%F in ("*(*)*.js" "*(*)*.html" "*(*)*.css" "*(*)*.png") do (
  if exist "%%~F" (
    echo    [!] Fichier mal nomme : %%~nxF
    set MALNOMME=1
  )
)
if "!MALNOMME!"=="1" (
  echo.
  echo  [X] ATTENTION : des fichiers portent un numero entre parentheses.
  echo      Renommez-les d'abord ^(exemple : "app (3).js" devient "app.js"^)
  echo      puis relancez ce script.
  echo.
  pause
  exit /b 1
)

rem --- 4. Ce que git voit --------------------------------------------
echo  Ce que git detecte :
echo  ------------------------------------------------
git status --short
if errorlevel 1 (
  echo  [X] git n'a pas repondu. Est-il installe ?
  pause
  exit /b 1
)
echo.

rem --- 5. Y a-t-il quelque chose a envoyer ? -------------------------
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set NB=%%i
if "%NB%"=="0" (
  echo  [i] Aucun changement detecte.
  echo.
  echo      Si vous venez de copier des fichiers ici, c'est que
  echo      Windows a refuse de les remplacer, ou qu'ils ont ete
  echo      deposes dans un autre dossier.
  echo      Verifiez les dates affichees plus haut : elles doivent
  echo      etre celles d'aujourd'hui.
  echo.
  pause
  exit /b 0
)

echo  %NB% fichier(s) a envoyer.
echo.

rem --- 6. Envoi -------------------------------------------------------
git add -A
if errorlevel 1 ( echo  [X] Echec de git add & pause & exit /b 1 )

set HORODATE=%DATE% %TIME:~0,5%
git commit -m "Mise a jour du %HORODATE%"
if errorlevel 1 ( echo  [X] Echec du commit & pause & exit /b 1 )

echo.
echo  Envoi vers GitHub...
git push
if errorlevel 1 (
  echo.
  echo  [X] L'envoi a echoue.
  echo      Causes frequentes : pas de connexion, ou identifiants
  echo      GitHub expires. Lisez le message ci-dessus.
  echo.
  pause
  exit /b 1
)

echo.
echo  ================================================
echo   [OK] Envoye. Vercel deploie dans une minute.
echo  ================================================
echo.
pause
