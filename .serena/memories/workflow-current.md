# Workflow Actif — Page Admin Ordonnancement Partis

## Tâche
Créer une page d'administration pour ordonner manuellement les partis politiques sur l'échiquier gauche-droite.

## Objectif
Permettre de modifier les positions politiques (`political_position`) des groupes parlementaires via une interface web, avec :
- Authentification par mot de passe (variable d'environnement)
- Switch par chambre (AN, PE, SENAT) pour protéger/autoriser l'écrasement ETL
- Édition des positions par chambre

**Critères de succès** :
- Page `/admin` protégée par mot de passe
- Liste des groupes par chambre avec position éditable
- Switch "protéger contre ETL" par chambre
- Persistance en base
- Pages `/an/carte` et `/pe/carte` reflètent les changements

## Démarré
2026-02-05 14:00

## Historique
| Timestamp | Skill | Status | Notes |
|-----------|-------|--------|-------|
| 14:00 | /analyze | ✅ | Besoin clarifié, 2 questions résolues (auth + ETL) |
| 14:30 | /architecture | ✅ | Architecture complète définie |
| 15:00 | /implement | ✅ | Implémentation terminée (6 commits, build OK) |

## Phase Actuelle
/implement ✅

## Contexte Clé
- Colonne `organs.political_position` (REAL, 0-10, 999=NI) déjà existante
- `sortByPoliticalPosition()` dans `src/lib/utils/political-spectrum.ts`
- Auth : cookie HMAC signé avec ADMIN_PASSWORD
- Table `admin_settings` avec clés etl_protect_[an|pe|senat]
- 171 organs total (94 AN, 49 PE, 28 SENAT)

## Décisions Prises
- Auth : mot de passe simple en variable d'environnement (pas de système de comptes)
- ETL : switch par chambre (AN/PE/SENAT) pour autoriser/bloquer l'écrasement des positions manuelles
- Le switch est persisté en DB (table admin_settings)
- Interface admin unifiée avec onglets par chambre

## Fichiers Créés/Modifiés
- ✅ `src/lib/server/db/schema/admin-settings.ts` — Table admin_settings
- ✅ `src/lib/server/auth.ts` — Utilitaires d'authentification HMAC
- ✅ `src/app.d.ts` — Type Locals.adminAuthenticated
- ✅ `src/hooks.server.ts` — Vérification cookie admin
- ✅ `src/routes/admin/+layout.server.ts` — Guard d'authentification
- ✅ `src/routes/admin/+page.server.ts` — Load + form actions
- ✅ `src/routes/admin/+page.svelte` — Interface admin (login + éditeur)
- ✅ `scripts/etl/import-political-positions.ts` — Protection ETL
- ✅ `.env.example` — Variable ADMIN_PASSWORD
- ✅ `drizzle/migrations/0010_*.sql` — Migration admin_settings

## Commits
1. 64249ff - feat(db): add admin_settings table schema for ETL protection switches
2. 6ae99d7 - feat(auth): add admin session authentication with HMAC-signed cookies
3. ea93fd2 - feat(admin): add admin page with login, position editor and ETL protection switches
4. 2af41ab - feat(etl): respect admin ETL protection switches per chamber
5. ec5c932 - feat(config): add ADMIN_PASSWORD environment variable
6. 1c4e6e4 - chore(db): add migration for admin_settings table

## Prochaine Étape
/test-run (vérifier que l'app fonctionne)
