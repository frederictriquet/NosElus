# Pattern : Design de Métriques pour Dashboards d'Observation

## Problème

Créer des indicateurs pertinents pour un dashboard de santé/complétude de données est délicat. Trois pièges courants :

1. **Ratio structurellement impossible à compléter** (ex: "% de lois avec métadonnée X" quand X n'existe que pour un sous-ensemble)
2. **Sémantique UI inversée** (affichage de "complétude" vs "problèmes restants")
3. **Mauvaise catégorisation** (utiliser un ratio de complétude pour une simple observation d'existence)

## Contexte

Dashboard de monitoring ETL avec ~25 indicateurs couvrant imports, enrichissements, et qualité des données. Besoin de savoir rapidement :

- Quels ETL lancer ?
- Quel est l'état actuel des données ?
- Quel a été l'impact d'un ETL ?

## Solution : Typologie des Métriques

### 1. Métrique d'Observation (Existence)

**Quand ?** Vérifier si des données ont été importées.

**Format** :

```typescript
const count = Number(row.total_items) || 0;
checks.push({
	id: 'items-count',
	label: 'Items en base',
	description: count === 0 ? 'Aucun item importé' : `${count} items en base`,
	severity: count === 0 ? 'critical' : count < MIN_THRESHOLD ? 'warning' : 'ok',
	current: 0, // 0 problèmes détectés
	total: count,
	pct: count === 0 ? 100 : 0, // 100% manquant si 0
	command: 'make etl-import-items',
	chamber: 'AN'
});
```

**Affichage UI** (avec inversion `100 - pct` et `total - current`) :

- Si `count = 2100` : `100.0%` et `2 100 / 2 100` ✅
- Si `count = 0` : `0.0%` et `0 / 0` 🔴

**SQL** :

```sql
SELECT COUNT(*) as total_items FROM items
```

### 2. Métrique de Complétude (Ratio)

**Quand ?** Mesurer le % d'entités enrichies (ex: textes avec résumé IA).

**Contrainte structurelle** : 100% DOIT être atteignable. Si une donnée n'est disponible que pour un sous-ensemble, ce n'est PAS une métrique de complétude.

**Format** :

```typescript
const missing = Number(row.items_no_enrichment) || 0;
const total = Number(row.total_items) || 0;
const pct = total > 0 ? (missing / total) * 100 : 0;

checks.push({
	id: 'items-no-enrichment',
	label: 'Items sans enrichissement',
	description: `${missing} items manquent d'enrichissement`,
	severity: pct > 50 ? 'critical' : pct > 25 ? 'warning' : 'info',
	current: missing,
	total: total,
	pct: pct,
	command: 'make etl-enrich-items',
	chamber: 'ALL'
});
```

**Affichage UI** :

- Si `missing = 450, total = 1000` : `55.0%` complétude et `450 / 1 000` restants
- Si `missing = 0, total = 1000` : `100.0%` complétude et `1 000 / 1 000` ✅

**SQL** :

```sql
SELECT
  COUNT(*) FILTER (WHERE enrichment IS NULL) as items_no_enrichment,
  COUNT(*) as total_items
FROM items
```

### 3. Métrique de Fraîcheur (Temporelle)

**Quand ?** Vérifier l'âge de la dernière synchronisation.

**Format** :

```typescript
const daysSince = row.last_sync_days ?? 999;

checks.push({
	id: 'stale-data',
	label: 'Fraîcheur données',
	description:
		daysSince > 30
			? `Dernière sync il y a ${daysSince} jours (>30j)`
			: `Dernière sync il y a ${daysSince} jours`,
	severity: daysSince > 30 ? 'critical' : daysSince > 15 ? 'warning' : 'ok',
	current: daysSince,
	total: 30, // Seuil critique
	pct: Math.min(100, (daysSince / 30) * 100),
	command: 'make etl-sync',
	chamber: 'AN'
});
```

**SQL** :

```sql
SELECT EXTRACT(DAY FROM NOW() - MAX(last_sync_at))::integer as last_sync_days
FROM sync_metadata
WHERE source = 'my-source'
```

## Anti-Patterns : Ratios Impossibles

### Cas 1 : Données limitées à un sous-ensemble

❌ **Mauvais exemple** : "% de lois AN avec cosignataires"

**Problème** : Seules les lois importées via `etl-an-dossiers` (fichiers JSON dossiers parlementaires) ont des cosignataires. Les lois scrapées depuis le site web n'en auront JAMAIS. Le ratio ne peut structurellement pas atteindre 100%.

**Résultat** : L'indicateur reste bloqué à 30% même après multiples exécutions de l'ETL → inutile.

**Solution** : Transformer en métrique d'observation :

```typescript
// ❌ Avant (ratio bancal)
const lawsNoCosignatories = Number(row.laws_no_cosignatories);
const totalLaws = Number(row.total_laws);
const pct = totalLaws > 0 ? (lawsNoCosignatories / totalLaws) * 100 : 0;

// ✅ Après (observation)
const totalCosignatories = Number(row.total_cosignatories) || 0;
checks.push({
	label: 'Cosignataires dossiers AN',
	description:
		totalCosignatories === 0
			? 'Aucun cosignataire importé'
			: `${totalCosignatories} cosignataires en base`,
	severity: totalCosignatories === 0 ? 'critical' : 'ok',
	current: 0,
	total: totalCosignatories,
	pct: totalCosignatories === 0 ? 100 : 0
});
```

### Cas 2 : ETL basé sur du pattern matching

❌ **Mauvais exemple** : "% de scrutins AN liés à une loi"

**Problème** : L'ETL `linkScrutinsByTitle` parse les titres de scrutins avec des regex pour extraire un nom de texte de loi. Les scrutins procéduraux (motions de censure, nominations, déclarations du gouvernement...) ne matchent aucun pattern. Sur ~17 800 scrutins, seuls ~5 100 sont des votes sur des textes de loi. Le ratio plafonne structurellement à ~29%.

**Résultat** : L'indicateur reste bloqué à 29% malgré un ETL idempotent → l'utilisateur pense que l'ETL ne marche pas.

**Indice clé** : Si relancer l'ETL ne change pas le compteur, le ratio est probablement structurellement plafonné.

**Solution** : Transformer en métrique d'observation avec contexte dans la description :

```typescript
// ❌ Avant (ratio structurellement plafonné)
const scrutinsNoLaw = Number(row.scrutins_an_no_law) || 0;
const pct = totalScrutins > 0 ? (scrutinsNoLaw / totalScrutins) * 100 : 0;

// ✅ Après (observation avec contexte)
const scrutinsWithLaw = Number(row.scrutins_an_with_law) || 0;
checks.push({
	label: 'Scrutins AN liés à une loi',
	description:
		scrutinsWithLaw === 0
			? 'Aucun scrutin lié à un dossier législatif'
			: `${scrutinsWithLaw} scrutins liés sur ${totalScrutins} (votes procéduraux exclus)`,
	severity: scrutinsWithLaw === 0 ? 'critical' : 'ok',
	current: 0,
	total: scrutinsWithLaw,
	pct: scrutinsWithLaw === 0 ? 100 : 0
});
```

**Astuce** : Garder le total dans la `description` pour information, sans l'utiliser dans le ratio affiché.

### Cas 3 : API source limitée à un sous-ensemble temporel

❌ **Mauvais exemple** : "% de députés AN avec stats d'activité"

**Problème** : L'API NosDéputés ne retourne que les 586 députés de la législature courante (17ème). Mais la table `actors` contient 2100 députés (législatures 14→17). Le ratio plafonne structurellement à ~28%. Idem pour PE (137/303) et SENAT (700/1943).

**Solution** : Transformer en métrique d'observation avec explication de la couverture :

```typescript
// ❌ Avant (ratio plafonné)
const actorsNoStats = Number(row.actors_an_no_stats) || 0;
const pct = totalActorsAN > 0 ? (actorsNoStats / totalActorsAN) * 100 : 0;

// ✅ Après (observation avec contexte)
const actorsWithStats = Number(row.actors_an_with_stats) || 0;
checks.push({
	label: 'Députés avec stats activité',
	description:
		actorsWithStats === 0
			? "Aucun député avec statistiques d'activité"
			: `${actorsWithStats} députés avec stats (API NosDéputés : législature courante)`,
	severity: actorsWithStats === 0 ? 'critical' : 'ok',
	current: 0,
	total: actorsWithStats,
	pct: actorsWithStats === 0 ? 100 : 0
});
```

### Règle générale

> **Si un ratio ne peut structurellement pas atteindre 100%, ce n'est pas un check de complétude** — c'est un check d'observation déguisé.

Causes fréquentes de plafonnement :

- **Données partielles** : seul un sous-ensemble de la population source a la donnée (cosignataires)
- **Pattern matching** : regex/NLP ne couvre qu'une partie des cas (titre → loi)
- **Sources temporellement limitées** : l'API source ne couvre que le mandat/législature en cours (NosDéputés, HowTheyVote, API Sénat)
- **Sources multiples** : l'enrichissement vient d'une source qui ne couvre pas tout

## Checklist de Validation

Avant d'ajouter une métrique, vérifier :

- [ ] **Type correct** : Observation, Complétude ou Fraîcheur ?
- [ ] **100% atteignable** : Si ratio, peut-on structurellement atteindre 100% ?
- [ ] **Sémantique UI** : Les valeurs `current`, `total`, `pct` correspondent à l'affichage ?
- [ ] **Actionnable** : L'indicateur suggère-t-il une commande claire ?
- [ ] **Testable** : Peut-on vérifier facilement l'impact après exécution de l'ETL ?

## Table de Décision

| Question                                     | Type                                      |
| -------------------------------------------- | ----------------------------------------- |
| "A-t-on importé des données X ?"             | **Observation** → count absolu            |
| "Quel % de Y est enrichi avec Z ?"           | **Complétude** → ratio (si 100% possible) |
| "Combien de jours depuis la dernière sync ?" | **Fraîcheur** → delta temporel            |
| "Certaines lois ont des cosignataires"       | **Observation** → PAS un ratio            |

## Avantages

✅ **Clarté** : Chaque type de métrique a une sémantique claire  
✅ **Fiabilité** : Pas d'indicateurs structurellement bloqués  
✅ **Maintenance** : Facile d'ajouter/modifier des checks  
✅ **UX** : L'utilisateur comprend immédiatement l'état et l'action requise

## Inconvénients

⚠️ Nécessite une bonne compréhension de la structure des données  
⚠️ Plus de checks (observation + complétude) vs un seul ratio global

## Validation de Couverture

### Audit systématique : Targets vs Checks

Pour garantir qu'aucune target ETL n'est oubliée :

1. Lister toutes les targets Makefile : `grep -E '^etl-' Makefile | sed 's/:.*//'`
2. Lister tous les `command:` dans checks.ts : `grep "command: 'make " checks.ts`
3. Croiser les deux listes et justifier chaque écart

**Anti-pattern** : Noms incohérents Makefile/package.json

```makefile
# ❌ Bug silencieux : le script n'existe pas
etl-europarl-enrich-groups:
	npm run etl:pe-enrich-groups  # INEXISTANT !

# ✅ Nom correct
etl-europarl-enrich-groups:
	npm run etl:europarl-enrich-groups
```

**Leçon** : Un Makefile qui appelle un script npm inexistant échoue silencieusement (ou avec un message npm peu visible). Toujours vérifier la correspondance des noms.

### Checklist de couverture complète

Pour chaque target Makefile atomique (non composite) :

- [ ] Un check existe dans checks.ts
- [ ] Le `command` du check pointe vers la bonne target
- [ ] La métrique SQL mesure ce que la target modifie réellement
- [ ] Le type de check est correct (existence vs complétude vs fraîcheur)

## Exemples d'Utilisation

### Projet NosElus : 30 Checks ETL

| Catégorie             | Nombre | Exemples                                                                       |
| --------------------- | ------ | ------------------------------------------------------------------------------ |
| Fraîcheur             | 3      | AN, PE, SENAT                                                                  |
| Observation/Existence | 14     | Compteurs actors/scrutins/laws/amendments/mandates, stats activité, liens lois |
| Complétude            | 9      | Textes complets, résumés IA, tags, classification, enrichissement groupes      |
| Mixte (organes)       | 4      | Couleurs, positions politiques                                                 |

**Résultat** : Dashboard exhaustif couvrant les 27 targets Makefile ETL atomiques pertinentes (7 targets composites/alternatives exclues).

## Variantes

### Dashboard Multi-Sources

Si plusieurs sources pour la même donnée :

```typescript
// Observation par source
const countSourceA = Number(row.items_source_a) || 0;
const countSourceB = Number(row.items_source_b) || 0;

// Check d'existence global
checks.push({
	label: 'Items importés (toutes sources)',
	severity: countSourceA + countSourceB === 0 ? 'critical' : 'ok',
	current: 0,
	total: countSourceA + countSourceB,
	pct: countSourceA + countSourceB === 0 ? 100 : 0
});
```

### Seuils Progressifs

Pour les compteurs, utiliser des seuils progressifs :

```typescript
severity: count === 0
	? 'critical' // Aucune donnée
	: count < MIN_ACCEPTABLE
		? 'warning' // Trop peu de données
		: 'ok'; // Suffisant
```

## Tests

### Test de Cohérence UI

Vérifier que l'affichage UI correspond aux valeurs :

```typescript
// Si UI affiche (100 - pct)% et (total - current) / total
it('should display 100% for full count', () => {
	const check = {
		current: 0,
		total: 2100,
		pct: 0
	};

	const displayPct = 100 - check.pct; // 100%
	const displayCount = `${check.total - check.current} / ${check.total}`; // 2100 / 2100

	expect(displayPct).toBe(100);
	expect(displayCount).toBe('2100 / 2100');
});
```

## Références

- Implémentation : `src/lib/server/etl/checks.ts` (NosElus)
- UI Dashboard : `src/routes/(app)/admin/etl-status/+page.svelte`
- Lessons Learned : `lessons-learned-2026-02-11-etl-checks-exhaustifs.md`

## Voir Aussi

- `pattern-dashboard-as-data-quality-validator.md` : Utiliser le dashboard pour valider la qualité des données
- `std-shared-data-definitions.md` : Définitions partagées (MIN_DESCRIPTION_LENGTH)

## Tags

`dashboard` `metrics` `data-quality` `ui-semantics` `sql` `monitoring`
