# Convention des messages de commit

Ce projet utilise [Conventional Commits](https://www.conventionalcommits.org/) pour le versioning automatisé et la génération de changelogs.

## Format

```
<type>[scope optionnel]: <description>

[corps optionnel]

[footer(s) optionnel(s)]
```

## Types

- **feat**: Une nouvelle fonctionnalité (déclenche un bump de version MINEURE)
- **fix**: Correction d'un bug (déclenche un bump de version PATCH)
- **docs**: Changements de documentation uniquement
- **style**: Changements qui n'affectent pas le sens du code (formatage, etc.)
- **refactor**: Changement de code qui ne corrige pas de bug ni n'ajoute de fonctionnalité
- **perf**: Amélioration de performance
- **test**: Ajout ou correction de tests
- **chore**: Changements du processus de build ou d'outils auxiliaires

## Changements Breaking

Ajoutez `!` après le type ou `BREAKING CHANGE:` dans le footer pour déclencher un bump de version MAJEURE:

```
feat!: refonte du système d'authentification

BREAKING CHANGE: L'API d'authentification a été complètement repensée.
Les anciens tokens ne sont plus valides.
```

## Exemples

### Ajout de fonctionnalité (0.1.0 → 0.2.0)
```
feat: ajout de la page de profil utilisateur

Implémentation d'une nouvelle page de profil utilisateur avec upload
d'avatar et édition de la bio.
```

### Correction de bug (0.1.0 → 0.1.1)
```
fix: résolution du débordement du menu de navigation sur mobile

Le menu de navigation dépassait de la largeur de l'écran sur les
appareils de moins de 768px. CSS ajusté pour corriger.
```

### Changement Breaking (0.1.0 → 1.0.0)
```
feat!: migration vers les nouveaux endpoints API

BREAKING CHANGE: Tous les endpoints API sont passés de /api/v1 à /api/v2.
Mettez à jour vos appels API en conséquence.
```

### Documentation (pas de bump de version)
```
docs: mise à jour des instructions d'installation

Ajout d'une section de dépannage pour les problèmes courants
avec npm install.
```

## Scopes (Optionnel)

Vous pouvez ajouter des scopes pour fournir du contexte supplémentaire:

```
feat(auth): implémentation de la connexion OAuth
fix(ui): correction de l'alignement des boutons sur la page de paiement
test(api): ajout de tests d'intégration pour le flux de paiement
```

## Pourquoi c'est important

- **Versioning automatisé**: Release Please lit vos commits pour déterminer les bumps de version
- **Changelogs automatiques**: Vos messages de commit deviennent le changelog
- **Meilleur historique**: Messages de commit clairs et structurés facilitent la compréhension des changements
- **Semantic Versioning**: Suit automatiquement les principes de semver

## Conseils

1. Utilisez le présent: "add feature" pas "added feature"
2. Ne capitalisez pas la première lettre: "fix bug" pas "Fix bug"
3. Pas de point à la fin de la description
4. Gardez la description sous 72 caractères
5. Utilisez le corps pour expliquer "quoi" et "pourquoi", pas "comment"

## Ressources

- [Spécification Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Documentation Release Please](https://github.com/googleapis/release-please)
