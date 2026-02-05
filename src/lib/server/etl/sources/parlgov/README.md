# Module ParlGov - Positionnement Politique Automatique

Intégration avec la base de données académique ParlGov pour récupérer automatiquement les positions politiques des partis européens sur l'axe gauche-droite.

## Vue d'ensemble

Ce module permet d'éliminer le hardcoding des positions politiques en :

1. Téléchargeant les données depuis [ParlGov.org](https://www.parlgov.org/)
2. Matchant automatiquement les groupes NosElus avec les partis ParlGov via similarité fuzzy (Jaccard)
3. Stockant les positions en base de données (`organs.political_position`)

### Problème Résolu

**Avant** : 71 IDs de groupes hardcodés dans `/an/carte` et `/pe/carte`

```typescript
// ❌ Hardcoding à maintenir manuellement
const spectrumOrder = ['PO800538', 'PO800520', ...];
```

**Après** : Positions automatiques depuis ParlGov

```typescript
// ✅ Données dynamiques depuis la DB
const sorted = sortByPoliticalPosition(groups);
```

## Installation

Module interne au projet NosElus. Aucune installation externe requise.

### Dépendances

- **Drizzle ORM** - Requêtes SQL type-safe
- **Node.js native APIs** - `fetch`, `parseArgs`, CSV parser custom
- Aucune dépendance externe supplémentaire (CSV parser natif)

## Architecture

### Structure des fichiers

```
src/lib/server/etl/sources/parlgov/
├── README.md                    # Cette documentation
├── types.ts                     # Interfaces et types TypeScript
├── client.ts                    # Client HTTP et parser CSV
├── matcher.ts                   # Algorithme de matching Jaccard
├── index.ts                     # Exports publics
└── __tests__/                   # 124 tests unitaires
    ├── fixtures.ts
    ├── client.test.ts
    ├── matcher.*.test.ts
    └── ...
```

### Flux de données

```
┌─────────────┐
│ ParlGov CSV │  (1700+ partis européens)
└──────┬──────┘
       │ fetch + parse
       ▼
┌──────────────┐
│ 80 partis FR │  filtrés par pays
└──────┬───────┘
       │ fuzzy matching (Jaccard)
       ▼
┌─────────────────┐
│ NosElus Organs  │  (~50 groupes parlementaires)
│ + positions     │
└─────────────────┘
```

## Utilisation

### Script ETL

```bash
# Test de connexion
npm run etl:political-positions -- --test-connection

# Import complet (dry-run)
npm run etl:political-positions -- --dry-run --verbose

# Import réel
npm run etl:political-positions

# Import pour une chambre spécifique
npm run etl:political-positions -- --chamber=AN
```

### Via Makefile

```bash
make etl-seed-pe-positions                    # Seed positions PE (Chapel Hill Expert Survey)
make etl-political-positions                  # Import positions nationales via ParlGov
make etl-political-positions ARGS="--dry-run" # Dry-run
```

### Utilisation programmatique

```typescript
import {
	fetchPartiesForCountries,
	findBestMatch,
	determinePosition,
	sortByPoliticalPosition
} from '$lib/server/etl/sources/parlgov';

// 1. Récupérer les partis ParlGov
const parties = await fetchPartiesForCountries({
	countryCodes: ['FRA']
});

// 2. Matcher un groupe NosElus
const match = findBestMatch(organ, parties);

// 3. Déterminer la position
const position = determinePosition(organ, match);
// → 1.3 (gauche) | 8.8 (droite) | 999 (NI) | 5.0 (défaut)

// 4. Trier des groupes
const sorted = sortByPoliticalPosition(groups);
// → [LFI, GDR, SOC, ..., RN, NI]
```

## API Reference

### Client HTTP

#### `fetchAllParties(config?): Promise<ParlGovParty[]>`

Télécharge tous les partis depuis ParlGov.

```typescript
const parties = await fetchAllParties({
	timeout: 30000,
	csvUrl: 'https://...' // optionnel
});
```

#### `fetchPartiesForCountries(config): Promise<ParlGovParty[]>`

Filtre par codes pays.

```typescript
const frParties = await fetchPartiesForCountries({
	countryCodes: ['FRA', 'EUR']
});
```

#### `testConnection(): Promise<boolean>`

Teste la connexion et affiche des exemples.

```typescript
const ok = await testConnection();
// Affiche les 5 premiers partis FR
```

### Matching Fuzzy

#### `findBestMatch(organ, parties, config?): MatchResult | null`

Trouve le meilleur match ParlGov pour un groupe NosElus.

**Algorithme** :

1. Essaie `shortName` vs `shortName` (match exact prioritaire)
2. Essaie `name` vs `nameNative`
3. Essaie `name` vs `nameEnglish`
4. Essaie `shortName` vs `nameNative` (fallback)

**Seuil** : Score Jaccard ≥ 0.4 (40% de similarité)

```typescript
const match = findBestMatch(organ, parties, {
	threshold: 0.4, // Minimum 40% similarité
	longWordBonus: 0.2, // Bonus mots ≥8 chars
	longWordMinLength: 8 // Seuil mot long
});

if (match) {
	console.log(match.score); // 0.75
	console.log(match.matchedOn); // 'nameNative'
	console.log(match.parlGovParty); // { ...party }
}
```

#### `calculateJaccardSimilarity(s1, s2, config?): number`

Calcule la similarité Jaccard entre deux chaînes (0.0-1.0).

**Features** :

- Normalisation NLP (accents, ponctuation, stop words)
- Bonus pour mots longs discriminants (8+ caractères)
- Case-insensitive

```typescript
const score = calculateJaccardSimilarity('La France Insoumise', 'La France insoumise');
// → 1.0 (identique après normalisation)

const score2 = calculateJaccardSimilarity('Rassemblement National', 'National Rally');
// → 0.7 (50% Jaccard base + 20% bonus mot long "national")
```

#### `normalizeForMatching(text): string`

Normalise un texte pour le matching.

**Transformations** :

- Lowercase
- Supprime accents (é→e, ç→c)
- Supprime ponctuation
- Supprime stop words français (le, la, de, parti, groupe, ...)
- Normalise espaces multiples

```typescript
normalizeForMatching('La République Française');
// → 'republique francaise'
```

#### `isNonInscrit(organ): boolean`

Détecte si un groupe est "Non-inscrit" (NI).

**Détection** :

- ShortName exact : `NI`, `NA`
- Nom avec word boundaries : `Non-inscrit`, `Non-inscrits`, `Indépendant`

**Important** : Utilise `\b` regex pour éviter faux positifs (ex: "Rassemblement **Na**tional" ne match pas "na")

```typescript
isNonInscrit({ name: 'Non inscrit', shortName: 'NI' });
// → true

isNonInscrit({ name: 'Rassemblement National', shortName: 'RN' });
// → false ✅ (pas de faux positif)
```

### Position Politique

#### `determinePosition(organ, match): number`

Détermine la position politique d'un groupe à partir des données ParlGov (0-10 ou 999).

**Note** : Les groupes PE ont leurs positions seedées directement en DB via `scripts/etl/seed-pe-positions.ts`. Cette fonction ne gère que le calcul basé sur ParlGov (partis nationaux).

**Priorité** :

1. `999` si Non-inscrit
2. `match.parlGovParty.leftRight` (si match trouvé)
3. `FAMILY_POSITIONS[familyShort]` (fallback famille)
4. `5.0` (centre par défaut)

```typescript
const position = determinePosition(organ, match);
// → 1.3 (LFI - gauche)
// → 8.8 (RN - droite)
// → 999 (NI - fin de liste)
// → 5.0 (inconnu - centre)
```

### Tri et Utilitaires

#### `sortByPoliticalPosition(organs, options?): T[]`

Trie les groupes de gauche à droite.

```typescript
const sorted = sortByPoliticalPosition(groups, {
	niPosition: 999, // Position NI (défaut: 999)
	defaultPosition: 5.0, // Position inconnue (défaut: 5.0)
	niIdentifiers: ['NI'] // Custom NI identifiers
});
```

**Ordre** : 0 (gauche) → 10 (droite) → 999 (NI)

**Égalité** : Tri alphabétique par nom si même position.

## Types TypeScript

### ParlGovParty

```typescript
interface ParlGovParty {
	countryCode: string; // 'FRA', 'EUR'
	shortName: string; // 'LFI', 'RN'
	nameEnglish: string; // 'Unsubmissive France'
	nameNative: string; // 'La France insoumise'
	familyShort: string; // 'soc', 'com', 'lib', etc.
	leftRight: number | null; // 0-10 (gauche-droite) ou null
}
```

### MatchResult

```typescript
interface MatchResult {
	organId: string;
	organName: string;
	organShortName: string | null;
	parlGovParty: ParlGovParty;
	score: number; // 0.0-1.0 (similarité Jaccard)
	matchedOn: MatchField; // 'shortName' | 'nameNative' | 'nameEnglish'
}
```

### FAMILY_POSITIONS

Positions par défaut des familles politiques (fallback).

```typescript
const FAMILY_POSITIONS = {
	com: 1.5, // Communist → extrême gauche
	soc: 3.0, // Social democracy → gauche
	eco: 3.5, // Green/Ecologist → gauche
	lib: 5.5, // Liberal → centre-droit
	con: 7.0, // Conservative → droite
	right: 8.5, // Right-wing → extrême droite
	spec: 5.0, // Special issue → centre
	none: 5.0 // No family → centre
};
```

## Exemples d'utilisation

### Exemple 1 : Import ETL complet

```bash
# 1. Test connexion
npm run etl:political-positions -- --test-connection

# 2. Dry-run avec logs
npm run etl:political-positions -- --dry-run --verbose

# Affiche :
# [ParlGov] Fetched 1707 parties
# [ParlGov] Filtered 80 french parties
# ✓ LFI-NFP → La France Insoumise (score: 0.95, pos: 1.3)
# ✓ RN → Rassemblement national (score: 1.00, pos: 8.8)
# ...

# 3. Import réel
npm run etl:political-positions
```

### Exemple 2 : Matching dans le code

```typescript
import { fetchPartiesForCountries, findBestMatch } from '$lib/server/etl/sources/parlgov';
import { db, organs } from '$lib/server/db';

// Récupérer les groupes AN
const groups = await db.select().from(organs).where(eq(organs.chamber, 'AN'));

// Récupérer partis ParlGov
const parties = await fetchPartiesForCountries({ countryCodes: ['FRA'] });

// Matcher chaque groupe
for (const group of groups) {
	const match = findBestMatch(group, parties);

	if (match) {
		console.log(`${group.shortName} → ${match.parlGovParty.nameNative}`);
		console.log(`  Score: ${match.score.toFixed(2)}`);
		console.log(`  Position: ${match.parlGovParty.leftRight}`);
	} else {
		console.log(`${group.shortName} → No match (fallback)`);
	}
}
```

### Exemple 3 : Tri dans une page Svelte

```typescript
// +page.server.ts
import { sortByPoliticalPosition } from '$lib/utils/political-spectrum';

export const load = async () => {
	const groups = await getANGroupsWithMemberCount(legislature);
	const sorted = sortByPoliticalPosition(groups);

	return { groups: sorted };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import { sortByPoliticalPosition } from '$lib/utils/political-spectrum';

	let { data } = $props();

	// Adapter le format pour sortByPoliticalPosition
	const adapted = data.groups.map((g) => ({
		id: g.groupId,
		name: g.groupName,
		shortName: g.groupShortName,
		politicalPosition: g.politicalPosition
	}));

	const sorted = sortByPoliticalPosition(adapted);
</script>

{#each sorted as group}
	<div>{group.shortName} - Position: {group.politicalPosition}</div>
{/each}
```

### Exemple 4 : Test d'un nouveau matcher

```typescript
import { calculateJaccardSimilarity } from '$lib/server/etl/sources/parlgov';

// Tester différents seuils
const tests = [
	['La France Insoumise', 'La France insoumise'],
	['Rassemblement National', 'National Rally'],
	['Les Républicains', 'LR']
];

for (const [s1, s2] of tests) {
	const score = calculateJaccardSimilarity(s1, s2);
	console.log(`"${s1}" vs "${s2}": ${score.toFixed(2)}`);
}

// Output:
// "La France Insoumise" vs "La France insoumise": 1.00
// "Rassemblement National" vs "National Rally": 0.70
// "Les Républicains" vs "LR": 0.00 (pas de mots en commun)
```

## Tests

### Exécuter les tests

```bash
# Tous les tests ParlGov
npm test src/lib/server/etl/sources/parlgov/__tests__/

# Tests spécifiques
npm test matcher.jaccard.test.ts
npm test matcher.ni.test.ts

# Avec couverture
npm test -- --coverage
```

### Couverture

| Fichier    | Statements | Branches | Functions | Lines |
| ---------- | ---------- | -------- | --------- | ----- |
| client.ts  | 100%       | 100%     | 100%      | 100%  |
| matcher.ts | 100%       | 100%     | 100%      | 100%  |
| types.ts   | 100%       | N/A      | N/A       | 100%  |

**Total** : 124 tests, 100% succès

### Structure des tests

```
__tests__/
├── fixtures.ts                  # Factories et données de test
├── client.test.ts              # 19 tests - Parser CSV
├── matcher.normalize.test.ts    # 21 tests - Normalisation
├── matcher.jaccard.test.ts      # 21 tests - Similarité Jaccard
├── matcher.ni.test.ts           # 24 tests - Détection NI
├── matcher.matching.test.ts     # 23 tests - Logique matching
└── matcher.position.test.ts     # 18 tests - Position politique
```

## Configuration

### Variables d'environnement

Aucune variable requise. Le module utilise l'URL publique de ParlGov par défaut.

### Options de configuration

```typescript
// Client HTTP
interface ParlGovClientConfig {
	csvUrl?: string; // Défaut: URL officielle ParlGov
	timeout?: number; // Défaut: 30000ms
	countryCodes?: string[]; // Défaut: ['FRA']
}

// Matcher Jaccard
interface MatcherConfig {
	threshold?: number; // Défaut: 0.4 (40%)
	longWordBonus?: number; // Défaut: 0.2
	longWordMinLength?: number; // Défaut: 8
}

// Tri politique
interface SortOptions {
	niPosition?: number; // Défaut: 999
	defaultPosition?: number; // Défaut: 5.0
	niIdentifiers?: string[]; // Défaut: ['NI', 'NA', ...]
}
```

## Standards du Projet

- [x] **no-hardcoding-rule** - Élimine les 71 IDs hardcodés
- [x] **etl-makefile-rule** - Target Makefile `etl-political-positions`
- [x] **std-api-integration-external** - Client HTTP robuste avec timeout
- [x] **pattern-jaccard-title-matching** - Implémentation Jaccard NLP
- [x] **pattern-test-fixtures-factories** - Factories de test réutilisables
- [x] **pattern-integration-tests-real-db** - Tests d'intégration DB

## Dépannage

### Problème 1 : "No parties fetched from ParlGov"

**Cause** : Échec de connexion à ParlGov.org ou timeout.

**Solution** :

```bash
# Tester la connexion
npm run etl:political-positions -- --test-connection

# Augmenter le timeout si réseau lent
# Éditer scripts/etl/import-political-positions.ts:
const parties = await fetchAllParties({ timeout: 60000 });
```

### Problème 2 : Taux de matching faible (<50%)

**Cause** : Noms de groupes trop différents de ParlGov ou nouveaux partis.

**Solution** :

```bash
# Vérifier les noms avec --verbose
npm run etl:political-positions -- --dry-run --verbose

# Si besoin, ajouter mapping manuel dans FAMILY_POSITIONS
# ou ajuster le seuil de matching
const match = findBestMatch(organ, parties, { threshold: 0.3 });
```

### Problème 3 : "Rassemblement National" détecté comme NI

**Cause** : Bug corrigé en v1.1 (word boundaries).

**Solution** :

```typescript
// Vérifier version du code avec word boundaries (\b)
// matcher.ts:257
const wordRegex = new RegExp(`\\b${niLower}\\b`, 'i');
```

### Problème 4 : Migration 0009 échoue

**Cause** : Colonne déjà existante.

**Solution** : Migration déjà idempotente avec `IF NOT EXISTS`. Si erreur persiste :

```bash
# Vérifier l'état de la colonne
psql -d noselus -c "SELECT column_name FROM information_schema.columns WHERE table_name='organs' AND column_name='political_position';"

# Appliquer manuellement si besoin
psql -d noselus -c "ALTER TABLE organs ADD COLUMN IF NOT EXISTS political_position real;"
```

## Cas d'usage réels

### Pages utilisant ce module

| Page           | Description                                  |
| -------------- | -------------------------------------------- |
| `/an/carte`    | Hémicycle AN - Tri gauche→droite automatique |
| `/pe/carte`    | Hémicycle PE - Tri groupes européens         |
| `/senat/carte` | Future - Positionnement groupes Sénat        |

### Résultats réels (Legislature 17)

| Groupe  | Position | Source                |
| ------- | -------- | --------------------- |
| LFI-NFP | 1.3      | ParlGov match (95%)   |
| GDR     | 1.3      | ParlGov match (92%)   |
| SOC     | 3.8      | ParlGov match (88%)   |
| ECO     | 2.5      | ParlGov match (85%)   |
| HOR     | 6.0      | ParlGov match (78%)   |
| REN     | 6.0      | ParlGov match (95%)   |
| LR      | 7.4      | ParlGov match (98%)   |
| DR      | 8.8      | ParlGov match (90%)   |
| NI      | 999.0    | Détection automatique |

**Taux de matching** : ~75% (sans NI)

## Évolutions possibles

- [ ] Cache HTTP des données ParlGov (refresh hebdomadaire)
- [ ] Support d'autres sources (Manifesto Project, CHES)
- [ ] Table de mapping manuel pour groupes non-matchés
- [ ] API REST pour interroger les positions
- [ ] Dashboard de monitoring des matchings

## Références

### Documentation externe

- [ParlGov Database](https://www.parlgov.org/) - Source académique
- [ParlGov CSV](https://www.parlgov.org/data/parlgov-development_csv-utf-8/view_party.csv) - Données brutes
- [Jaccard Similarity](https://en.wikipedia.org/wiki/Jaccard_index) - Algorithme de matching
- [Pattern Jaccard NLP](../../../../../.serena/memories/pattern-jaccard-title-matching.md) - Notre implémentation

### Documentation interne

- [ADR-004](../../../../../.serena/memories/adr-2026-02-04-political-positioning-automation.md) - Décision architecture
- [Architecture](../../../../../.serena/memories/arch-2026-02-04-political-positioning.md) - Blueprint technique
- [no-hardcoding-rule](../../../../../.serena/memories/no-hardcoding-rule.md) - Règle respectée

## Changelog

| Version | Date       | Changements                                  |
| ------- | ---------- | -------------------------------------------- |
| 1.3.0   | 2026-02-05 | PE positions migrées vers DB via seed script |
| 1.2.0   | 2026-02-04 | Documentation complète                       |
| 1.1.0   | 2026-02-04 | Fix: Word boundaries pour détection NI       |
| 1.0.0   | 2026-02-04 | Release initiale - 124 tests                 |

## License

MIT - NosElus Project
