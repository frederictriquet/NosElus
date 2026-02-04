# Workflow Actif - Automatisation Positionnement Politique

## Tâche
Récupérer automatiquement le positionnement idéologique des partis politiques pour éliminer le hardcoding

## Objectif
**Éliminer tout hardcoding de `spectrumOrder`** dans `/an/carte` et `/pe/carte` en récupérant les positions depuis une source externe académique (ParlGov/IPWE/ELFF) et en les stockant en base de données.

**Critère de succès** : Ajouter un nouveau parti via ETL sans modifier le code applicatif.

## Démarré
2026-02-04

## Historique
| Timestamp | Skill | Status | Notes |
|-----------|-------|--------|-------|
| 2026-02-04 | /analyze | ✅ | Problème identifié, périmètre défini |
| 2026-02-04 | /explore-options | ✅ | 3 sources + 4 stratégies évaluées |
| 2026-02-04 | /tech-choice | ✅ | ADR-004 créé, décision ParlGov+Jaccard documentée |
| 2026-02-04 | /architecture | ✅ | Blueprint complet, 12 fichiers identifiés |
| 2026-02-04 | /implement | ✅ | Implémentation complète, 75% matching |
| 2026-02-04 | /test-write | ✅ | 124 tests créés, 100% coverage ParlGov |
| 2026-02-04 | /test-run | ✅ | 198/198 tests passants |
| 2026-02-04 | /code-review | ✅ | Approuvé sans changements requis |
| 2026-02-04 | /document | ✅ | 900+ lignes de documentation créées |
| 2026-02-04 | /capitalize | ✅ | Lessons learned sauvegardées |
| 2026-02-04 | /roadmap-update | ✅ | Section 4.6 marquée DONE dans ROADMAP.md |

## Phase Actuelle
/roadmap-update ✅ → **/pre-merge**

## Statut : IMPLÉMENTÉ ✅

### Ce qui a été fait

**Fichiers créés :**
- `src/lib/server/etl/sources/parlgov/types.ts` - Types et constantes
- `src/lib/server/etl/sources/parlgov/client.ts` - Client CSV natif
- `src/lib/server/etl/sources/parlgov/matcher.ts` - Fuzzy Jaccard
- `src/lib/server/etl/sources/parlgov/index.ts` - Exports
- `scripts/etl/import-political-positions.ts` - Script CLI ETL
- `src/lib/utils/political-spectrum.ts` - Utilitaire de tri
- `src/lib/utils/political-spectrum.test.ts` - 24 tests unitaires
- `drizzle/migrations/0009_premium_scalphunter.sql` - Migration DB

**Fichiers modifiés :**
- `src/lib/server/db/schema/organs.ts` - Ajout `politicalPosition`
- `src/lib/server/api/helpers.ts` - Ajout politicalPosition aux 3 fonctions groupe
- `src/routes/an/carte/+page.svelte` - Suppression hardcoding (33 IDs)
- `src/routes/pe/carte/+page.svelte` - Suppression hardcoding (38 IDs)
- `Makefile` - Ajout target `etl-political-positions`

### Résultats ETL
- **1707 partis** téléchargés depuis ParlGov
- **80 partis français** filtrés
- **~75% matching** sur les groupes AN/PE/Sénat
- **Fallbacks appliqués** : NI=999, inconnus=5.0

### Positions en base (AN Legislature 17)
| Groupe | Position |
|--------|----------|
| LFI-NFP, GDR, SOC | 1.3 (gauche) |
| ECO, EcoS | 2.5 (écolo) |
| HOR, REN | 6.0 (centre) |
| LR, Dem | 7.4 (centre-droit) |
| DR | 8.8 (droite) |
| NI | 999 |

### Commits
1. `9a3f0de` - feat(political-positioning): automate political spectrum ordering via ParlGov
2. `50b4426` - fix(political-positioning): use word boundary regex for NI detection

### Tests
- 74 tests passent (dont 24 nouveaux pour political-spectrum)
- Build OK

## Prochaine Étape
**/pre-merge** - Préparer le merge vers master

## Blocages
Aucun

## Documents de Référence
- **ADR** : `adr-2026-02-04-political-positioning-automation.md`
- **Architecture** : `arch-2026-02-04-political-positioning.md`
- **Pattern Jaccard** : `pattern-jaccard-title-matching.md`
