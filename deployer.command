#!/bin/bash
# Mon Concours — mise en ligne
# Double-cliquez sur ce fichier pour envoyer vos modifications.

cd "$(dirname "$0")" || exit 1

echo
echo "  ================================================"
echo "    MON CONCOURS — mise en ligne"
echo "  ================================================"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "  [X] Git n'est pas installé sur cet ordinateur."
  echo "      Sur Mac, tapez : xcode-select --install"
  echo
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "  [X] Ce dossier n'est pas relié à GitHub."
  echo "      Lancez une seule fois :"
  echo "      git clone https://github.com/jean311997-wq/Monconcours.git"
  echo
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
  exit 1
fi

echo "  Fichiers modifiés :"
echo
git status --short
echo

git add -A

if git diff --cached --quiet; then
  echo "  [i] Aucun changement à envoyer. Tout est déjà en ligne."
  echo
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
  exit 0
fi

git commit -m "Mise à jour du $(date '+%d/%m/%Y à %H:%M')" >/dev/null

echo "  Envoi vers GitHub..."
if ! git push; then
  echo
  echo "  [X] L'envoi a échoué."
  echo "      Vérifiez votre connexion, ou vos identifiants GitHub."
  echo
  read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
  exit 1
fi

echo
echo "  ================================================"
echo "    [OK] Envoyé. Vercel met le site à jour."
echo "    Comptez une minute, puis ouvrez :"
echo "    https://monconcours.vercel.app"
echo "  ================================================"
echo
read -n 1 -s -r -p "  Appuyez sur une touche pour fermer."
