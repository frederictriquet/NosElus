# NosElus

> Plateforme de transparence parlementaire française

Suivez l'activité, les votes et les positions politiques des élus français à l'Assemblée nationale, au Sénat et au Parlement européen.

[![CI](https://github.com/frederictriquet/NosElus/actions/workflows/ci.yml/badge.svg)](https://github.com/frederictriquet/NosElus/actions/workflows/ci.yml)
[![Docker](https://github.com/frederictriquet/NosElus/actions/workflows/docker.yml/badge.svg)](https://github.com/frederictriquet/NosElus/actions/workflows/docker.yml)

---

## Fonctionnalités

### Assemblée nationale

- Fiches députés : biographie, groupe, statistiques de vote, alignement avec le groupe
- Scrutins : liste, résultats, répartition des votes par groupe et nominative
- Groupes parlementaires : effectifs, cohésion, proximité politique
- Statistiques et visualisations (heatmap, matrice de proximité, carte politique)
- Lois : textes, statuts, recherche plein texte
- Quiz : testez votre connaissance des votes

### Sénat

- Fiches sénateurs et groupes politiques

### Parlement européen

- Eurodéputés français depuis 2004
- Votes et scrutins au PE
- Groupes politiques européens
- Comparaison d'eurodéputés

### Fonctionnalités transverses

- Recherche globale (lois, scrutins, élus)
- Comparaison d'élus
- ETL automatisé pour l'import des données officielles

---

## Stack technique

- **SvelteKit 5** + TypeScript
- **PostgreSQL** (accès via `./scripts/db-query.sh`)
- **Docker** pour le déploiement
- **GitHub Actions** pour CI/CD

---

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173)

---

## Scripts disponibles

### Développement

```bash
npm run dev              # Serveur de développement
npm run preview          # Preview du build de production
```

### Build

```bash
npm run build            # Build de production
npm run check            # Type checking
```

### Tests

```bash
npm run test                      # Tests unitaires
npm run test:watch                # Tests unitaires en mode watch
npm run test:ui                   # Interface graphique pour les tests
npm run test:coverage             # Tests avec coverage
npm run test:e2e                  # Tests end-to-end
npm run test:e2e:ui               # Tests e2e avec interface
npm run test:mutation             # Tests de mutation (Stryker)
npm run test:mutation:incremental # Tests de mutation incrémentaux
npm run test:all                  # Tous les tests (sauf mutation)
```

### Docker

```bash
npm run docker:build     # Build l'image Docker
npm run docker:up        # Lance les conteneurs
npm run docker:down      # Arrête les conteneurs
npm run docker:logs      # Affiche les logs
npm run docker:restart   # Redémarre les conteneurs
```

---

## Administration

La page `/admin` permet de gérer manuellement les positions politiques des groupes parlementaires et de contrôler la protection ETL.

### Configuration

```bash
# Dans .env
ADMIN_PASSWORD=votre-mot-de-passe-securise
```

### Fonctionnalités

- **Édition des positions politiques** par chambre (AN, PE, SENAT)
- **Filtres par mandature** pour naviguer facilement
- **Protection ETL** : empêcher l'écrasement automatique des positions manuelles
- **Authentification HMAC** avec cookie de session sécurisé (24h)

### Accès

1. Démarrer le serveur : `npm run dev`
2. Accéder à : `http://localhost:5173/admin`
3. Se connecter avec le mot de passe configuré

📖 **Documentation complète** : [docs/ADMIN.md](docs/ADMIN.md)

---

## Variables d'environnement

Copiez `.env.example` vers `.env` et adaptez les valeurs :

```bash
cp .env.example .env
```

---

## Convention des commits

Ce projet utilise [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <subject>
```

Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

Voir [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md) pour plus de détails.

---

## Documentation

- [Architecture du projet](docs/ARCHITECTURE.md)
- [ETL - données et usage](docs/ETL-USAGE.md)
- [Administration](docs/ADMIN.md)
- [Workflows CI/CD](.github/workflows/README.md)

---

## Licence

MIT © [Frederic Triquet](https://github.com/frederictriquet)
