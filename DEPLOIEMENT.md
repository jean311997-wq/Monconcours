# Mettre le site en ligne en un clic

Vous ne repassez plus jamais par GitHub à la main.
Vous modifiez vos fichiers dans le dossier, vous double-cliquez, c'est en ligne.

---

## Installation — une seule fois

### 1. Installer Git

**Windows** : téléchargez-le sur `git-scm.com/download/win`, puis suivez
l'installation en laissant toutes les options par défaut.

**Mac** : ouvrez le Terminal et tapez `xcode-select --install`.

### 2. Récupérer votre dossier de travail

Créez un dossier où vous voulez, par exemple `Documents/MonConcours`.
Ouvrez-le, faites un clic droit dans le vide, puis **« Ouvrir dans le Terminal »**
(sur Windows : **« Git Bash Here »**).

Tapez cette ligne :

```
git clone https://github.com/jean311997-wq/Monconcours.git .
```

Le point à la fin est important : il évite de créer un dossier dans le dossier.

Git vous demandera peut-être vos identifiants GitHub. Sur Windows, une fenêtre
s'ouvre et vous vous connectez normalement. C'est la seule fois.

### 3. Autoriser le script

**Mac uniquement** : dans le Terminal, tapez

```
chmod +x deployer.command
```

---

## Ensuite, à chaque fois

1. Vous remplacez les fichiers modifiés dans le dossier.
2. Vous double-cliquez sur **`deployer.bat`** (Windows) ou **`deployer.command`** (Mac).
3. Une fenêtre noire s'ouvre, vous montre ce qui a changé, et envoie.
4. Une minute plus tard, `monconcours.vercel.app` est à jour.

C'est tout.

---

## Ce que le script fait, et ne fait pas

**Il fait** : la liste des fichiers modifiés, l'enregistrement daté, l'envoi vers
GitHub. Vercel voit le changement et remet le site en ligne tout seul.

**Il ne fait pas** : il n'efface rien, il ne touche à aucun fichier que vous
n'avez pas modifié, et il s'arrête proprement en expliquant si quelque chose cloche.

---

## Si ça coince

**« Git n'est pas installé »** — reprenez l'étape 1.

**« Ce dossier n'est pas relié à GitHub »** — vous avez oublié l'étape 2, ou vous
avez lancé le script depuis le mauvais dossier.

**« L'envoi a échoué »** — le plus souvent, c'est la connexion Internet.
Sinon, vos identifiants GitHub ont expiré : relancez, une fenêtre de connexion
s'ouvrira.

**Sur Mac, le fichier s'ouvre dans un éditeur au lieu de s'exécuter** — refaites
l'étape 3.

---

## Une habitude à prendre

Avant de double-cliquer, ouvrez `monconcours.vercel.app` et vérifiez que le site
en ligne fonctionne encore. Comme ça, si quelque chose casse après l'envoi, vous
savez que ça vient de votre modification — et pas d'autre chose.
