# Lessons Learned : Checks ETL Exhaustifs pour Dashboard

## Date

2026-02-11

## Contexte

Extension de la page `/admin/etl-status` de 11 à 25 checks couvrant l'ensemble des targets Makefile ETL (~30 targets). L'objectif était de fournir un indicateur pour CHAQUE target ETL permettant de savoir si on doit la lancer et de vérifier l'impact après exécution.

## Problèmes Rencontrés

### 1. Bug Silent : Exclusion Sénat dans Filtres AN

**Symptôme** : Les checks AN comptaient aussi les lois Sénat par erreur.

**Cause** : Les lois Sénat utilisent des legislatures numériques (`1`→`17`) comme l'AN, mais leurs IDs commencent par `SEN-`. Les filtres SQL utilisaient `legislature ~ '^[0-9]+$'` sans exclure les SEN-.

**Solution** : Ajouter `AND id NOT LIKE 'SEN-%'` à tous les filtres AN dans les CTEs (7 occurrences).

**Leçon** :

- ⚠️ Les identifiants hybrides (format différent selon la chambre) créent des pièges subtils dans les requêtes SQL
- ✅ Toujours documenter les formats d'ID dans le schéma DB et les vérifier lors des agrégations multi-chambres

### 2. Sémantique UI Inversée

**Symptôme** : Checks de compteurs (actors/scrutins/laws en base) affichaient "100.0%" mais "0 / 2100" - incohérent.

**Cause** : Mauvaise compréhension de la sémantique UI. La page affiche :

- Pourcentage : `(100 - pct)%` → complétude
- Compteur : `(total - current) / total` → items restants / total

Avec `current: totalActors, total: totalActors, pct: 0`, on obtient :

- `100 - 0 = 100%` ✓
- `(2100 - 2100) / 2100 = 0 / 2100` ✗

**Solution** : Utiliser `current: 0, total: count, pct: 0` pour ces checks d'existence :

- `100 - 0 = 100%` ✓
- `(count - 0) / count = count / count` ✓

**Leçon** :

- 🎯 Toujours vérifier la sémantique UI AVANT d'implémenter les métriques
- 📊 Un check d'existence est différent d'un check de complétude :
  - **Existence** : "A-t-on des données ?" → `current: 0 (problèmes), total: count, pct: count ? 0 : 100`
  - **Complétude** : "Combien manque ?" → `current: missing, total: all, pct: (missing/all)*100`

### 3. Métrique Inadaptée : Cosignataires AN

**Symptôme** : Après plusieurs `make etl-an-dossiers`, le compteur restait à "0 / 2499" (0%).

**Cause Structurelle** : Le check comptait les lois AN leg.17 **sans** entrée dans `law_cosignatories`. Mais seules les lois importées par `etl-an-dossiers` (fichiers JSON dossiers parlementaires) peuvent avoir des cosignataires. Les lois des autres ETL (scraped depuis assemblee-nationale.fr) n'en auront **jamais**.

**Problème de Design** : Le ratio "lois sans cosignataires / total lois" ne peut structurellement jamais atteindre 100%. C'est un **mauvais indicateur**.

**Solution** : Transformer en check d'existence simple :

```sql
-- Avant (ratio bancal)
COUNT(*) WHERE legislature = '17' AND NOT EXISTS (
  SELECT 1 FROM law_cosignatories lc WHERE lc.law_id = l.id
) / COUNT(*) WHERE legislature = '17'

-- Après (existence)
(SELECT COUNT(*) FROM law_cosignatories)
```

Si `count > 0` → ✅ ETL a tourné, c'est bon.  
Si `count = 0` → 🔴 Critical, faut lancer l'ETL.

**Leçon** :

- 🎯 **Distinguer les types de checks** :
  - **Observation** : "A-t-on des données X ?" (count absolu)
  - **Complétude** : "% de Y enrichi avec Z" (ratio)
  - **Fraîcheur** : "Âge de la dernière sync"
- ⚠️ **Un ratio n'est pertinent QUE si 100% est atteignable structurellement**
- ✅ Quand la donnée n'est disponible que pour un sous-ensemble, utiliser un check d'existence sur le sous-ensemble, pas un ratio global

## Bonnes Pratiques Identifiées

### Architecture SQL : CTE Unique

✅ Une seule requête SQL avec CTEs pour toutes les métriques (~25 fields) évite N+1 queries et garantit la cohérence transactionnelle.

```typescript
// Pattern utilisé
const result = await db.execute<{
	// Laws (7 fields)
	total_laws_an: number;
	laws_an_no_fulltext: number;
	// ... 20 autres métriques
}>(sql`
  WITH
  law_stats AS (...),
  scrutin_stats AS (...),
  actor_counts AS (...),
  organ_stats AS (...),
  sync_freshness AS (...)
  SELECT ls.*, ss.*, ac.*, os.*, sf.*
  FROM law_stats ls, scrutin_stats ss, ...
`);
```

### Typage des Checks

✅ Pattern "compteur d'existence" standard :

```typescript
const totalItems = Number(row.total_items) || 0;
checks.push({
	id: 'items-count',
	label: 'Items en base',
	description: totalItems === 0 ? 'Aucun item importé' : `${totalItems} items en base`,
	severity: totalItems === 0 ? 'critical' : totalItems < MIN ? 'warning' : 'ok',
	current: 0, // 0 problèmes
	total: totalItems,
	pct: totalItems === 0 ? 100 : 0, // 100% manquant si 0 items
	command: 'make etl-import-items',
	chamber: 'AN'
});
```

### Correction du Filtre AN/SENAT

✅ Pattern de filtre multi-chambres :

```sql
-- AN uniquement (exclure SENAT explicitement)
COUNT(*) FILTER (
  WHERE (legislature LIKE 'AN-%' OR legislature ~ '^[0-9]+$')
    AND id NOT LIKE 'SEN-%'
)

-- PE uniquement
COUNT(*) FILTER (WHERE legislature LIKE 'PE-%')

-- SENAT uniquement
COUNT(*) FILTER (WHERE id LIKE 'SEN-%')
```

### 4. Ratio Impossible : Scrutins AN/PE liés à une loi

**Symptôme** : Après `make etl-an-link-laws`, le compteur reste bloqué à 5121/17872 (~29%).

**Cause Structurelle** : L'ETL `linkScrutinsByTitle` parse les titres de scrutins avec des regex (`TEXT_PATTERNS`) pour extraire un nom de texte de loi. Les scrutins procéduraux (motions de censure, nominations, déclarations du gouvernement...) ne matchent aucun pattern et ne seront **jamais** liés - c'est normal et attendu.

Les ~12 750 scrutins non liés sont des votes procéduraux sans loi correspondante. Relancer l'ETL est idempotent : il a déjà lié tout ce qui est liable.

**Solution** : Transformer en check d'existence (comme cosignataires) :

```sql
-- Avant (ratio impossible)
COUNT(*) FILTER (WHERE ... AND law_id IS NULL) as scrutins_an_no_law

-- Après (existence)
COUNT(*) FILTER (WHERE ... AND law_id IS NOT NULL) as scrutins_an_with_law
```

Description enrichie pour garder le contexte : `"5121 scrutins liés sur 17872 (votes procéduraux exclus)"`.

**Leçon** :

- ⚠️ Tout ETL basé sur du pattern matching (regex, NLP, title parsing) a un taux de couverture < 100%
- ✅ Pour ces ETL, utiliser un check d'existence ("a-t-on des résultats ?") plutôt qu'un ratio de complétude
- 📊 Le total peut rester dans la `description` pour information, sans être dans le ratio affiché

### 5. Ratio Impossible : Stats activité par chambre (AN, PE, SENAT)

**Symptôme** : Après `make etl-an-nosdeputes-stats`, le dashboard stagne à 586/2100 (~28%). Idem PE (137/303) et SENAT (700/1943).

**Cause Structurelle** : Les APIs sources ne retournent que les élus du mandat/législature en cours :

- **NosDéputés** : 586 députés (législature 17) sur 2100 en base (legs 14→17)
- **HowTheyVote** : 137 eurodéputés (mandat courant) sur 303 en base
- **API Sénat** : 700 sénateurs (en exercice) sur 1943 en base

La table `actors` contient les élus historiques, mais les APIs d'activité ne fournissent de stats que pour les élus actuels. Le ratio ne peut structurellement jamais dépasser ~28-45%.

**Solution** : Transformer les 4 checks (AN, PE, SENAT stats + NosSénateurs) en checks d'existence :

```sql
-- Avant (ratio impossible)
COUNT(*) FILTER (WHERE chamber = 'AN'
    AND NOT EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_an_no_stats

-- Après (existence)
COUNT(*) FILTER (WHERE chamber = 'AN'
    AND EXISTS (SELECT 1 FROM actor_stats ast WHERE ast.actor_id = a.id)) as actors_an_with_stats
```

Description enrichie avec l'explication : `"586 députés avec stats (API NosDéputés : législature courante)"`.

**Leçon** :

- ⚠️ Quand une API source ne couvre qu'un sous-ensemble temporel (mandat courant), le ratio actors_with_data/total_actors est structurellement plafonné
- ✅ Pour ces ETL, utiliser un check d'existence avec le contexte de la couverture dans la description

### 6. Mauvaise Commande Makefile : law_tags vs scrutins.category

**Symptôme** : `make etl-an-classify-scrutins` ne fait plus augmenter le compteur du check `laws-an-no-tags`.

**Cause** : Le check `laws-an-no-tags` mesurait les lois sans entrées dans `law_tags`, mais la commande associée `make etl-an-classify-scrutins` met à jour `scrutins.category` (catégorie sémantique des scrutins). Ce sont **deux choses différentes** :

- `law_tags` est rempli par `make etl-an-analyze-laws` (law-analyzer LLM)
- `scrutins.category` est rempli par `make etl-an-classify-scrutins` (classification regex)

De plus, `classify-scrutins` avait déjà tout classifié (17 872/17 872 = 0 null), donc la métrique était stable = ETL idempotent qui a déjà fini.

**Solution** :

1. Corriger la commande du check `laws-an-no-tags` : `make etl-an-analyze-laws`
2. Ajouter un nouveau check `scrutins-an-no-category` pour `make etl-an-classify-scrutins` (ratio de complétude, 100% atteignable)

**Leçon** :

- ⚠️ Toujours vérifier que la commande Makefile d'un check agit bien sur la table/colonne mesurée par le SQL
- ✅ Un check par target Makefile, et chaque check mesure exactement ce que sa commande modifie

### 7. Audit exhaustif : checks manquants et bug Makefile

**Contexte** : Après les corrections itératives, un audit complet des ~37 targets Makefile vs les checks dashboard a révélé 4 trous de couverture et un bug Makefile.

**Bug Makefile** : `etl-europarl-enrich-groups` appelait `npm run etl:pe-enrich-groups` — script inexistant dans package.json. Le vrai nom est `etl:europarl-enrich-groups`. La target ne fonctionnait donc pas du tout.

**Checks manquants identifiés** :

| Target sans check            | Données                  | Justification                     |
| ---------------------------- | ------------------------ | --------------------------------- |
| `etl-an-laws`                | 2499 lois AN             | Symétrie avec `laws-senat-count`  |
| `etl-europarl-votes`         | 2214 scrutins PE         | Symétrie avec `scrutins-an-count` |
| `etl-senat-mandates-history` | 6893 mandats sénatoriaux | Pas de check du tout              |
| `etl-europarl-enrich-groups` | 40 groupes PE enrichis   | `short_name` non mesuré           |

**Targets justifiablement sans check** (composites ou couvertes) :

- `etl-an-download` : téléchargement fichiers, pas de données DB
- `etl-an-all` / `etl-an-incremental` / `etl-analyze-laws` : composites
- `etl-leg14`→`etl-all-legislatures` : composites par législature
- `etl-an-nosdeputes` : importeur alternatif, couvert par count checks
- `etl-seed-pe-positions` : couvert par `organs-no-position`

**Leçon** :

- ✅ Audit systématique targets Makefile vs checks = indispensable pour garantir la couverture
- ⚠️ Les noms incohérents entre Makefile/package.json sont des bugs silencieux (la target ne fait rien sans erreur visible)

## Actions Correctives

1. ✅ Ajout de `AND id NOT LIKE 'SEN-%'` dans tous les filtres AN (7 occurrences)
2. ✅ Correction des checks "compteur" : `current: 0` au lieu de `current: count`
3. ✅ Transformation check cosignataires : ratio → existence
4. ✅ Transformation checks scrutins liés AN/PE : ratio → existence
5. ✅ Inversion labels "sans X" → "avec X" (cohérence avec affichage complétude)
6. ✅ Transformation checks stats activité AN/PE/SENAT + NosSénateurs : ratio → existence
7. ✅ Correction commande check `laws-an-no-tags` : `etl-an-classify-scrutins` → `etl-an-analyze-laws`
8. ✅ Ajout check `scrutins-an-no-category` pour target `etl-an-classify-scrutins`
9. ✅ Bugfix Makefile `etl-europarl-enrich-groups` : `etl:pe-enrich-groups` → `etl:europarl-enrich-groups`
10. ✅ Ajout 4 checks manquants : `laws-an-count`, `scrutins-pe-count`, `mandates-senat-count`, `groups-pe-enriched`
11. ✅ Tests : svelte-check + vitest passent

## Métriques Finales

- **Avant** : 11 checks couvrant ~11/37 targets Makefile
- **Après** : 30 checks couvrant toutes les targets ETL atomiques pertinentes
- **Exclus** : 7 targets non pertinentes (downloads, composites, alternatives)

### Catégories de checks (30 total)

| Catégorie                | Nombre | Exemples                                                                                   |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| Fraîcheur                | 3      | stale-an-data, stale-pe-data, stale-senat-data                                             |
| Compteurs base           | 10     | actors-_-count, scrutins-_-count, laws-\*-count, amendments-an-count, mandates-senat-count |
| Textes & analyses        | 5      | laws-_-no-fulltext, laws-_-no-ai-summary, laws-an-no-tags                                  |
| Liens & classification   | 4      | scrutins-an-no-law, scrutins-pe-no-law, scrutins-an-no-category, laws-an-no-dossier        |
| Stats activité           | 4      | actors-\*-no-stats, actors-senat-no-nossenateurs                                           |
| Organes & enrichissement | 4      | organs-no-color, organs-pe-no-color, groups-pe-enriched, organs-no-position                |

### Couverture des targets Makefile

| Target atomique                | Check ID                                | Type                  |
| ------------------------------ | --------------------------------------- | --------------------- |
| `etl-an-incremental`           | stale-an-data                           | Fraîcheur             |
| `etl-europarl-votes`           | stale-pe-data + scrutins-pe-count       | Fraîcheur + Existence |
| `etl-senat-senators`           | stale-senat-data + actors-senat-count   | Fraîcheur + Existence |
| `etl-an-actors`                | actors-an-count                         | Existence             |
| `etl-europarl-meps`            | actors-pe-count                         | Existence             |
| `etl-an-scrutins`              | scrutins-an-count                       | Existence             |
| `etl-an-laws`                  | laws-an-count                           | Existence             |
| `etl-senat-laws`               | laws-senat-count                        | Existence             |
| `etl-an-amendements`           | amendments-an-count                     | Existence             |
| `etl-senat-mandates-history`   | mandates-senat-count                    | Existence             |
| `etl-an-law-texts`             | laws-an-no-fulltext                     | Complétude            |
| `etl-europarl-law-texts`       | laws-pe-no-fulltext                     | Complétude            |
| `etl-an-analyze-laws`          | laws-an-no-ai-summary + laws-an-no-tags | Complétude            |
| `etl-europarl-analyze-laws`    | laws-pe-no-ai-summary                   | Complétude            |
| `etl-an-classify-scrutins`     | scrutins-an-no-category                 | Complétude            |
| `etl-an-link-laws`             | scrutins-an-no-law                      | Existence             |
| `etl-europarl-laws`            | scrutins-pe-no-law                      | Existence             |
| `etl-an-dossiers`              | laws-an-no-dossier                      | Existence             |
| `etl-an-nosdeputes-stats`      | actors-an-no-stats                      | Existence             |
| `etl-europarl-activity-stats`  | actors-pe-no-stats                      | Existence             |
| `etl-senat-activity-stats`     | actors-senat-no-stats                   | Existence             |
| `etl-senat-nossenateurs-stats` | actors-senat-no-nossenateurs            | Existence             |
| `etl-europarl-historical`      | actors-pe-historical                    | Complétude            |
| `etl-colors`                   | organs-no-color                         | Complétude            |
| `etl-external-colors`          | organs-pe-no-color                      | Complétude            |
| `etl-europarl-enrich-groups`   | groups-pe-enriched                      | Complétude            |
| `etl-political-positions`      | organs-no-position                      | Complétude            |

## Impact

✅ **Dashboard complet** : 30 checks couvrant toutes les targets ETL atomiques  
✅ **Diagnostic rapide** : Voir en un coup d'œil quels ETL lancer  
✅ **Validation post-run** : Vérifier l'effet d'un ETL immédiatement  
✅ **Bug Makefile corrigé** : `etl-europarl-enrich-groups` fonctionne maintenant  
✅ **Pas de régression** : svelte-check 0 errors, vitest 415/415 tests passent

## Références

- Fichier modifié : `src/lib/server/etl/checks.ts`
- Page UI : `src/routes/(app)/admin/etl-status/+page.svelte`
- Tests : `src/lib/server/etl/__tests__/checks.test.ts`

## Tags

`etl` `dashboard` `sql` `metrics` `data-quality` `multi-chamber`
