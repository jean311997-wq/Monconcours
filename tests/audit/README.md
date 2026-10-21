# Bancs d'essai de Mon Concours

Ces essais ouvrent le site dans un navigateur simulé (Chromium sans écran), avec de **fausses données** :
rien n'est envoyé à la vraie base, aucun compte réel n'est touché. Ils servent à vérifier le site
avant chaque mise en ligne.

## Mise en route (une fois)

    cd tests/audit
    npm install            # installe axe-core (contrôle d'accessibilité)
    pip install playwright --break-system-packages && playwright install chromium

## Lancer un banc

    python3 lab1.py        # écrans à 5 tailles (320 à 1366 px) : débordements, zones tactiles, accessibilité
    python3 lab2.py        # pages hostiles : textes piégés dans les noms, énoncés, notifications, classements
    python3 lab2b.py       # contrôles du banc hostile (le piège est bien affiché en clair, jamais exécuté)
    python3 lab3.py        # connexion lente, processeur lent, hors ligne
    python3 lab4.py        # on touche chaque bouton de chaque écran
    python3 lab5.py        # durée du bandeau de notification et bouton « Reprendre » du cahier d'erreurs
    python3 lab6.py        # boutons « Reprendre » / « Valider » du cahier d'erreurs, trois fois de suite
    python3 lab7_gestes_avis.py   # bandeau à écarter du doigt, en-tête à 320 px, fenêtre « Donnez votre avis »

`lab7` affiche une ligne OK / ÉCHEC par vérification et se termine par un code d'erreur s'il y a un échec.
Les autres écrivent leurs résultats dans `lab*.json` et des captures `ecran_*.png`
(ignorés par git, jamais publiés).

## Principe

- `srv.py` sert le dossier du site en local, compressé comme le fait l'hébergeur.
- `audit_faux.js` remplace la base par de fausses réponses (`window.__H` : texte piège ; `window.__visiteur` : sans session).
- Rien ici n'est publié sur le site (`tests/` est dans `.vercelignore`).
