# Pattern : Distribution Logging pour ETL

## Catégorie
ETL | Logging | Data Quality | Observability

## Problème

Lors de l'import ETL de données avec **catégorisation** (par législature, par terme, par type), il est difficile de :
- ❌ Détecter les anomalies (ex: 0 données pour une catégorie attendue)
- ❌ Valider la logique de classification
- ❌ Comprendre la répartition des données
- ❌ Debugger les erreurs de parsing

**Sans distribution logging** :
```
[ETL] Imported 2039 laws
```
→ Impossible de savoir si la répartition est correcte

**Avec distribution logging** :
```
[ETL] Imported 2039 laws
[ETL] Term 8: 11 procedures
[ETL] Term 9: 1664 procedures
[ETL] Term 10: 364 procedures
```
→ Répartition immédiatement visible, anomalies détectables

## Contexte

Utiliser ce pattern quand :
- ✅ Données ETL ont une dimension de catégorisation
- ✅ Besoin de valider la logique de classification
- ✅ Détection d'anomalies importante
- ✅ Transparence envers les utilisateurs/mainteneurs

Ne PAS utiliser quand :
- ❌ Données sans catégorisation naturelle
- ❌ Trop de catégories (>50) → pollue les logs
- ❌ Données sensibles (ne pas logger en clair)

## Solution

### Pattern de base

```typescript
/**
 * Pattern : Comptage + Logging de Distribution
 */

// 1. Compteur de distribution
const termCounts = new Map<number, number>();

// 2. Incrément pendant le traitement
for (const [reference, mainVote] of mainVotesMap) {
  const term = extractTermFromReference(reference) ?? fallbackTerm;

  // Incrémenter le compteur
  termCounts.set(term, (termCounts.get(term) ?? 0) + 1);

  // ... reste du traitement
}

// 3. Log de la distribution (après traitement)
for (const [term, count] of [...termCounts.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`[EuroParl Laws] Term ${term}: ${count} procedures`);
}
```

### Pattern générique réutilisable

```typescript
/**
 * Fonction helper pour logger une distribution
 *
 * @param data - Map de distribution (clé → compteur)
 * @param label - Label pour l'affichage
 * @param sortBy - Tri par clé ou valeur
 * @param prefix - Préfixe de log (ex: '[ETL]')
 *
 * @example
 * ```typescript
 * const legislatureCounts = new Map([
 *   [17, 150],
 *   [16, 300],
 *   [15, 200]
 * ]);
 *
 * logDistribution(legislatureCounts, 'Législatures', 'key', '[AN]');
 * // [AN] Législatures Distribution:
 * // [AN]   15: 200
 * // [AN]   16: 300
 * // [AN]   17: 150
 * ```
 */
function logDistribution<K extends string | number, V extends number>(
  data: Map<K, V>,
  label: string,
  sortBy: 'key' | 'value' = 'key',
  prefix: string = ''
): void {
  const entries = [...data.entries()];

  // Tri
  if (sortBy === 'key') {
    entries.sort((a, b) => {
      // Tri numérique si clés sont des nombres
      if (typeof a[0] === 'number' && typeof b[0] === 'number') {
        return a[0] - b[0];
      }
      // Tri lexicographique sinon
      return String(a[0]).localeCompare(String(b[0]));
    });
  } else {
    // Tri par valeur (descendant)
    entries.sort((a, b) => b[1] - a[1]);
  }

  // Affichage
  console.log(`${prefix}${label} Distribution:`);
  for (const [key, value] of entries) {
    console.log(`${prefix}  ${key}: ${value}`);
  }
}
```

### Cas d'usage réel : Distribution des termes PE

```typescript
// src/lib/server/etl/sources/europarl/laws.ts:169-193

const termCounts = new Map<number, number>();

for (const [reference, mainVote] of mainVotesMap) {
  const term = extractTermFromReference(reference) ?? fallbackTerm;
  termCounts.set(term, (termCounts.get(term) ?? 0) + 1);

  // ... traitement
}

// Log term distribution avec tri numérique
for (const [term, count] of [...termCounts.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`[EuroParl Laws] Term ${term}: ${count} procedures`);
}
```

**Output** :
```
[EuroParl Laws] Term 8: 11 procedures
[EuroParl Laws] Term 9: 1664 procedures
[EuroParl Laws] Term 10: 364 procedures
```

## Variantes

### 1. Distribution avec pourcentages

```typescript
function logDistributionWithPercentages<K extends string | number>(
  data: Map<K, number>,
  label: string,
  prefix: string = ''
): void {
  const total = [...data.values()].reduce((sum, v) => sum + v, 0);
  const entries = [...data.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`${prefix}${label} Distribution (total: ${total}):`);
  for (const [key, value] of entries) {
    const percentage = ((value / total) * 100).toFixed(1);
    console.log(`${prefix}  ${key}: ${value} (${percentage}%)`);
  }
}

// Output:
// [ETL] Législature Distribution (total: 650):
//   17: 150 (23.1%)
//   16: 300 (46.2%)
//   15: 200 (30.8%)
```

### 2. Distribution avec seuil d'alerte

```typescript
interface DistributionOptions {
  minCount?: number;
  maxCount?: number;
  expectedKeys?: Set<string | number>;
}

function logDistributionWithAlerts<K extends string | number>(
  data: Map<K, number>,
  label: string,
  options: DistributionOptions = {},
  prefix: string = ''
): void {
  const { minCount, maxCount, expectedKeys } = options;

  console.log(`${prefix}${label} Distribution:`);

  for (const [key, value] of [...data.entries()].sort()) {
    let alert = '';

    if (minCount !== undefined && value < minCount) {
      alert = ' ⚠️ BELOW THRESHOLD';
    } else if (maxCount !== undefined && value > maxCount) {
      alert = ' ⚠️ ABOVE THRESHOLD';
    }

    console.log(`${prefix}  ${key}: ${value}${alert}`);
  }

  // Vérifier les clés manquantes
  if (expectedKeys) {
    for (const key of expectedKeys) {
      if (!data.has(key)) {
        console.warn(`${prefix}  ${key}: 0 ⚠️ MISSING`);
      }
    }
  }
}

// Usage
logDistributionWithAlerts(
  termCounts,
  'PE Terms',
  {
    minCount: 10,
    expectedKeys: new Set([8, 9, 10])
  },
  '[ETL] '
);

// Output:
// [ETL] PE Terms Distribution:
// [ETL]   8: 11
// [ETL]   9: 1664
// [ETL]   10: 364
```

### 3. Distribution multi-dimensions

```typescript
interface MultiDimDistribution {
  [category: string]: Map<string | number, number>;
}

function logMultiDimDistribution(
  data: MultiDimDistribution,
  prefix: string = ''
): void {
  for (const [category, distribution] of Object.entries(data)) {
    logDistribution(distribution, category, 'key', prefix);
    console.log(''); // Ligne vide entre catégories
  }
}

// Usage
const distributions: MultiDimDistribution = {
  'By Legislature': new Map([[17, 150], [16, 300]]),
  'By Type': new Map([['loi', 100], ['résolution', 350]]),
  'By Status': new Map([['adopté', 400], ['rejeté', 50]])
};

logMultiDimDistribution(distributions, '[AN] ');

// Output:
// [AN] By Legislature Distribution:
// [AN]   16: 300
// [AN]   17: 150
//
// [AN] By Type Distribution:
// [AN]   loi: 100
// [AN]   résolution: 350
//
// [AN] By Status Distribution:
// [AN]   adopté: 400
// [AN]   rejeté: 50
```

### 4. Distribution avec histogram ASCII

```typescript
function logDistributionHistogram<K extends string | number>(
  data: Map<K, number>,
  label: string,
  maxBarLength: number = 50,
  prefix: string = ''
): void {
  const max = Math.max(...data.values());
  const entries = [...data.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`${prefix}${label} Distribution:`);

  for (const [key, value] of entries) {
    const barLength = Math.round((value / max) * maxBarLength);
    const bar = '█'.repeat(barLength);
    console.log(`${prefix}  ${String(key).padEnd(12)} ${bar} ${value}`);
  }
}

// Output:
// [ETL] Legislature Distribution:
//   16           ██████████████████████████████████████████████████ 300
//   15           █████████████████████████████████ 200
//   17           █████████████████████████ 150
```

## Avantages

1. ✅ **Détection d'anomalies immédiate** : 0 donnée pour une catégorie attendue
2. ✅ **Validation de la logique** : Vérifier que parsing/classification fonctionne
3. ✅ **Transparence** : Utilisateur voit immédiatement la répartition
4. ✅ **Debugging facilité** : Identifier quel terme/type pose problème
5. ✅ **Historique** : Comparer distributions entre imports
6. ✅ **Documentation vivante** : Logs servent de spec

## Inconvénients

1. ⚠️ **Verbosité** : Peut polluer les logs si trop de catégories
   - **Mitigation** : Limiter à 10-20 catégories max, ou mode verbose
2. ⚠️ **Performance** : Tri + affichage coûteux pour grandes maps
   - **Mitigation** : Négligeable (<1s pour 10K+ entrées)

## Exemples d'utilisation

### Cas 1 : Distribution des scrutins par législature (AN)

```typescript
const legislatureCounts = new Map<number, number>();

for (const scrutin of scrutins) {
  const leg = extractLegislature(scrutin.id);
  legislatureCounts.set(leg, (legislatureCounts.get(leg) ?? 0) + 1);
}

logDistribution(legislatureCounts, 'Scrutins par Législature', 'key', '[AN] ');

// Output:
// [AN] Scrutins par Législature Distribution:
// [AN]   14: 2500
// [AN]   15: 4500
// [AN]   16: 3200
// [AN]   17: 1800
```

### Cas 2 : Distribution des votes par position

```typescript
const positionCounts = new Map([
  ['Pour', 350],
  ['Contre', 120],
  ['Abstention', 30],
  ['Non-votant', 50]
]);

logDistribution(positionCounts, 'Votes', 'value', '[Scrutin] ');

// Output (tri par valeur descendante):
// [Scrutin] Votes Distribution:
// [Scrutin]   Pour: 350
// [Scrutin]   Contre: 120
// [Scrutin]   Non-votant: 50
// [Scrutin]   Abstention: 30
```

### Cas 3 : Distribution multi-chambres

```typescript
const chamberCounts = new Map([
  ['AN', 12000],
  ['Sénat', 9000],
  ['PE', 2000]
]);

logDistributionWithPercentages(chamberCounts, 'Lois par Chambre', '[ETL] ');

// Output:
// [ETL] Lois par Chambre Distribution (total: 23000):
// [ETL]   AN: 12000 (52.2%)
// [ETL]   Sénat: 9000 (39.1%)
// [ETL]   PE: 2000 (8.7%)
```

## Tests

```typescript
describe('logDistribution', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log distribution sorted by key', () => {
    const data = new Map([[10, 100], [8, 50], [9, 75]]);

    logDistribution(data, 'Terms', 'key', '[Test] ');

    expect(consoleSpy).toHaveBeenCalledWith('[Test] Terms Distribution:');
    expect(consoleSpy).toHaveBeenCalledWith('[Test]   8: 50');
    expect(consoleSpy).toHaveBeenCalledWith('[Test]   9: 75');
    expect(consoleSpy).toHaveBeenCalledWith('[Test]   10: 100');
  });

  it('should log distribution sorted by value', () => {
    const data = new Map([[10, 100], [8, 50], [9, 75]]);

    logDistribution(data, 'Terms', 'value', '[Test] ');

    expect(consoleSpy).toHaveBeenCalledWith('[Test]   10: 100');
    expect(consoleSpy).toHaveBeenCalledWith('[Test]   9: 75');
    expect(consoleSpy).toHaveBeenCalledWith('[Test]   8: 50');
  });
});
```

## Checklist d'implémentation

- [ ] Créer un compteur Map<K, number> au début de l'ETL
- [ ] Incrémenter pendant le traitement : `.set(key, (map.get(key) ?? 0) + 1)`
- [ ] Logger après traitement complet (pas pendant)
- [ ] Choisir tri pertinent (clé = chronologique, valeur = importance)
- [ ] Préfixer avec nom du module pour clarté ([ETL], [AN], etc.)
- [ ] Vérifier que tri numérique est utilisé si clés sont des nombres

## Anti-Patterns

### ❌ Tri lexicographique sur nombres

```typescript
// ❌ MAUVAIS : Tri lexicographique
[...termCounts.entries()].sort()
// Output : PE-10, PE-8, PE-9 (incorrect)

// ✅ BON : Tri numérique
[...termCounts.entries()].sort((a, b) => a[0] - b[0])
// Output : PE-8, PE-9, PE-10 (correct)
```

### ❌ Logger pendant le traitement

```typescript
// ❌ MAUVAIS : Pollue les logs
for (const item of items) {
  const category = classify(item);
  counts.set(category, (counts.get(category) ?? 0) + 1);

  console.log(`Category ${category}: ${counts.get(category)}`);
  // → Log à chaque itération (2000+ logs)
}

// ✅ BON : Logger après traitement
for (const item of items) {
  const category = classify(item);
  counts.set(category, (counts.get(category) ?? 0) + 1);
}

// Logger une seule fois
logDistribution(counts, 'Categories');
```

### ❌ Oublier le tri

```typescript
// ❌ MAUVAIS : Ordre imprévisible (insertion order)
for (const [key, value] of termCounts) {
  console.log(`${key}: ${value}`);
}
// Output peut être : 10, 8, 9 (ordre d'insertion)

// ✅ BON : Ordre déterministe
for (const [key, value] of [...termCounts.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`${key}: ${value}`);
}
```

## Intégration avec Observability

### Export vers métriques Prometheus

```typescript
import { Counter, Registry } from 'prom-client';

const register = new Registry();

const lawsImportedCounter = new Counter({
  name: 'laws_imported_total',
  help: 'Total number of laws imported',
  labelNames: ['chamber', 'legislature'],
  registers: [register]
});

// Incrément pendant ETL
for (const law of laws) {
  lawsImportedCounter.inc({
    chamber: law.chamber,
    legislature: law.legislature
  });
}

// Métriques disponibles pour Grafana/Prometheus
```

### Logging structuré (JSON)

```typescript
function logDistributionJSON<K extends string | number>(
  data: Map<K, number>,
  label: string
): void {
  const distribution = Object.fromEntries(data);

  console.log(JSON.stringify({
    type: 'distribution',
    label,
    data: distribution,
    total: [...data.values()].reduce((sum, v) => sum + v, 0),
    timestamp: new Date().toISOString()
  }));
}

// Output (une ligne, parseable):
// {"type":"distribution","label":"PE Terms","data":{"8":11,"9":1664,"10":364},"total":2039,"timestamp":"2026-02-07T..."}
```

## Voir aussi

- **Cas d'usage réel** : `src/lib/server/etl/sources/europarl/laws.ts:190` (term distribution)
- **Lessons learned** : `lessons-learned-2026-02-07-pe-laws-expansion.md` (leçon #5)
- **Pattern lié** : `pattern-metadata-extraction-from-ids.md` (extraction pour classification)
- **Standard ETL** : `std-etl-cli-scripts.md` (logging et verbosity)

## Date de création

2026-02-07

## Historique

| Date | Modification |
|------|--------------|
| 2026-02-07 | Création suite à implémentation term distribution logging |
