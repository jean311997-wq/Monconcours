# Mon Concours

Plateforme de préparation aux concours directs de la fonction publique du Burkina Faso.

## Structure

```
index.html    la page et sa structure
styles.css    toute la mise en forme
app.js        toute la logique de l'application
```

Aucune dépendance, aucune étape de compilation : le site est servi tel quel.
Les polices sont chargées depuis Google Fonts.

## Développement local

Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python3 -m http.server 8000
```

Puis aller sur `http://localhost:8000`.

## Déploiement

Le dossier est déployé en site statique sur Vercel.
Toute modification poussée sur la branche principale est mise en ligne automatiquement.

## Écrans

| Écran | Contenu |
|---|---|
| Onboarding | engagement, test de niveau chronométré, résultat |
| Actualité | informations vérifiées, national et international |
| Révisions | QCM par niveau et par matière, fascicules de cours |
| Composition | sujet de 50 questions et feuille de réponses optique |
| Mes erreurs | répétition espacée réelle (3, 7 puis 21 jours) |
| Mon compte | classement, diagnostic, récompenses, assiduité, abonnement |

## État actuel

Aucune donnée n'est encore conservée : tout est en mémoire et disparaît au
rechargement de la page.

## Prochaines étapes

1. Base de données et authentification (Supabase)
2. Tableau de bord d'administration (actualité et questions)
3. Paiement mobile money réel
4. Installation hors ligne (PWA)
