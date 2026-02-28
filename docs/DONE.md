# Tâches implémentées

> Dernière mise à jour : 2026-02-28
> Sources : ROADMAP.md, ROADMAP2.md, FEATURES.md, FEATURES2.md, PROPOSAL.md, docs/features/\*

---

## Fondations (AN)

- Cataloguer les API/dumps disponibles
- Concevoir schéma DB unifié
- Configurer PostgreSQL avec Drizzle ORM
- ETL NosDéputés.fr — Députés, Groupes, Scrutins, Votes
- ETL AN — Députés historiques, Scrutins détaillés, Votes nominatifs, Amendements
- ETL AN historique depuis 1997 (XIV, XV, XVIe législature)
- Consolidation affiliations politiques et mandats par législature
- Support import incrémental avec tracking
- ETL dossiers législatifs AN et Sénat (DOSLEG)
- Lier scrutins aux textes de loi

## Sénat

- ETL Sénateurs
- ETL Travaux législatifs (DOSLEG)

## Parlement Européen

- ETL Eurodéputés français, Groupes politiques, Couleurs
- ETL votes en session plénière
- Historique des mandats européens
- Expansion des lois PE, bug fix cohérence lawId PE
- ETL couleurs groupes Sénat

## API

- `GET /api/v1/actors` — liste élus
- `GET /api/v1/actors/:id` — détail élu + votes
- `GET /api/v1/scrutins` — liste scrutins
- `GET /api/v1/scrutins/:id` — détail scrutin
- `GET /api/v1/organs` — groupes parlementaires
- `GET /api/v1/search` — recherche globale
- Pagination, filtres, tri sur tous les endpoints

## UI — Pages principales

- Accueil avec statistiques clés
- Liste et fiche Député (profil + votes)
- Liste et fiche Sénateur
- Liste et fiche Eurodéputé
- Liste et fiche Scrutin (AN, Sénat, PE)
- Liste et fiche Groupe parlementaire (AN, Sénat, PE)
- Pages `/pe/scrutins`, `/pe/groupes`, `/pe/stats`, `/pe/carte`
- Statistiques et graphiques par groupe parlementaire

## Recherche et filtres

- Recherche par nom de député / titre de scrutin
- Filtres par résultat (adopté/rejeté), par type de scrutin, par législature
- Filtrage par mandature (législatures/termes/renouvellements)
- Pagination sur toutes les listes

## Analyse avancée

- Taux de participation par député (Top 10)
- Cohésion de vote par groupe
- Répartition globale des votes
- Activité mensuelle (graphique à barres)
- Alignement avec le gouvernement (majorité présidentielle)
- Évolution des positions dans le temps
- Heatmap votes par groupe
- Matrice de proximité politique entre groupes
- Timeline de carrière d'un élu
- Comparaison de deux élus (taux d'accord, votes divergents, distance politique)
- Taux de dissidence par élu
- Identification des votes clivants en interne
- Badge "vote serré" (scrutins à faible majorité) sur pages scrutins et députés
- Colonne `scrutins.margin` pré-calculée + index (margin = |pour - contre|)
- Page `/an/scrutins/serres` avec filtres (seuil 5/10/20 voix) et pagination

## Positionnement politique automatisé (Phase 4.6)

- Données ParlGov intégrées
- Fuzzy Jaccard matching
- Élimination du hardcoding spectrumOrder AN/PE
- ETL import automatisé avec CLI flags
- Migration DB + index politicalPosition
- 124 tests (100% coverage module ParlGov)
- Positions PE migrées vers DB (Chapel Hill Expert Survey)

## Processus législatif

- Modèle de données "dossier législatif"
- ETL : lien scrutins ↔ textes (parsing titres)
- UI : page texte avec chronologie, liste dossiers
- Cosignataires liés aux propositions de loi
- Helpers d'agrégation et requêtes
- Thématisation : taxonomie, mots-clés officiels, NLP léger, filtres UI

## Quiz politique

- Configuration (filtrage tags, sélection taille)
- Phase quiz avec navigation et abstention
- Calcul alignement (similarité Jaccard)
- Résultats avec podium et détail modal
- Persistance localStorage avec reprise
- 23 tests unitaires
- Extension Quiz Parlement Européen
- Refactoring multi-chambre (composants partagés)

## Intégration Légifrance

- Import textes de lois promulguées via API Légifrance
- Page `/admin/law-text-review` — revue manuelle
- Approbation de candidats automatiques ou recherche manuelle
- Endpoint `/api/admin/legifrance`
- Module partagé `text-matching.ts`

## Administration

- Page `/admin` avec authentification
- Édition manuelle des positions politiques par chambre
- Protection ETL par chambre
- Déduplication des groupes dupliqués
- Gestion spécifique Sénat (groupes actuels vs historiques)

## Infrastructure & Qualité

- Tests E2E interface
- Audit de sécurité statique + Security Headers HTTP
- Notifications Telegram (FemtoLogger, `notifications.ts`)
- Correction regex .env, compteur erreurs Telegram
- Nettoyage résumés PE sans texte complet
- Détection incohérence ETL vs Dashboard
- 12 tests (6 unit + 6 intégration) — data quality
- Documentation ADMIN.md + JSDoc

## Sécurité

- Audit statique : injection SQL, XSS, gestion secrets, CORS
- Security headers : X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP avec nonces auto
- Tests security headers (6/6 ✅)
- Authentification admin (cookie HMAC-SHA256, timing-safe comparison)

## Infrastructure

- CI/CD GitHub Actions (workflows : ci.yml, docker.yml, release.yml)
- Docker multi-stage (builder + runner), production-ready
- Hooks Git (Husky + lint-staged) — validation pré-commit
- Idempotence des ETL, rate limiting APIs externes (500ms)
- 35 pipelines ETL documentés avec options CLI standard (--dry-run, --limit, --verbose)
- Workflows documentés : premier import, mise à jour hebdo, mise à jour mensuelle

## Légal

- Mentions légales et RGPD
