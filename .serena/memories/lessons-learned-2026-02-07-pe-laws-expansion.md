# Lessons Learned : Expansion des Lois PE (2026-02-07)

## Catégorie

ETL | Data Import | API Integration | Error Handling

## Contexte

Expansion de l'import des lois PE de 9 à 2 039 procédures en supprimant un filtre API incorrect (`geo_areas=FRA`).

## Leçons Apprises

### 1. ✅ Toujours vérifier la sémantique des paramètres API

**Problème** :

```typescript
// Filtre supposé : votes des eurodéputés français
fetchHTV('/votes?geo_areas=FRA'); // ❌ FAUX

// Filtre réel : votes dont le sujet géographique concerne la France
// → Retourne seulement 9 votes (ex: résolution sur politique française)
```

**Leçon** : Lire la documentation API en détail. `geo_areas` filtre le **sujet** géographique du vote, pas la **nationalité** des votants.

**Action préventive** :

- Toujours tester l'API avec/sans filtre pour comparer
- Vérifier les résultats avec des exemples concrets
- Documenter l'intention du filtre en commentaire

### 2. ✅ Parser les métadonnées depuis les identifiants structurés

**Pattern découvert** :

```
Référence EP : A10-0270/2025
              ↑↑
              ||
              |└─ Numéro de procédure
              └── Terme PE (10 = 2024-2029)
```

**Implémentation** :

```typescript
function extractTermFromReference(reference: string): number | null {
	const match = reference.match(/[ABC](\d+)-/);
	return match ? parseInt(match[1], 10) : null;
}
```

**Leçon** : Les identifiants externes contiennent souvent des métadonnées implicites. Parser ces informations évite :

- Hard-coding (forcer `PE-10` pour tout)
- Incohérences (procédures PE-9 marquées comme PE-10)
- Maintenance manuelle

**Bénéfices** :

- Données historiques correctes (PE-8, PE-9, PE-10)
- Robustesse (pas de dépendance à une configuration externe)
- Scalabilité (PE-11 sera automatiquement supporté)

### 3. ✅ Préserver les mots complets lors de la troncature

**Mauvaise troncature** :

```typescript
// ❌ Coupe mid-mot
displayTitle.slice(0, 300);
// "Résolution du Parlement européen sur le règlemen..."
```

**Bonne troncature** :

```typescript
// ✅ Coupe au dernier espace
displayTitle.slice(0, 297).replace(/\s+\S*$/, '') + '...';
// "Résolution du Parlement européen sur le..."
```

**Leçon** : Regex `/\s+\S*$/` supprime le dernier mot incomplet.

**Pourquoi 297** ?

- 300 (limite VARCHAR) - 3 (longueur de "...") = 297
- Garde une marge pour le suffixe

**Autres patterns similaires** :

```typescript
// Troncature à N mots
text.split(' ').slice(0, 50).join(' ') + '...';

// Troncature à la phrase
text.match(/^.{0,300}[.!?]/)?.[0] || text.slice(0, 300);
```

### 4. ⚠️ Ne pas confondre tri lexicographique et numérique

**Bug subtil** :

```javascript
// ❌ Tri lexicographique
[10, 8, 9]
	.sort() // → [10, 8, 9] (car "10" < "8" en string)

	[
		// ✅ Tri numérique
		(10, 8, 9)
	].sort((a, b) => a - b); // → [8, 9, 10]
```

**Contexte** :

```typescript
// ❌ AVANT (output : PE-10, PE-8, PE-9)
[...termCounts.entries()].sort()

// ✅ APRÈS (output : PE-8, PE-9, PE-10)
[...termCounts.entries()].sort((a, b) => a[0] - b[0])
```

**Leçon** : JavaScript `Array.sort()` convertit en strings par défaut. Toujours fournir un comparateur pour les nombres.

**Pattern général** :

```typescript
// Tri numérique ascendant
arr.sort((a, b) => a - b);

// Tri numérique descendant
arr.sort((a, b) => b - a);

// Tri d'objets par propriété numérique
arr.sort((a, b) => a.count - b.count);
```

### 5. ✅ Logging de distribution pour transparence

**Pattern ajouté** :

```typescript
const termCounts = new Map<number, number>();

for (const [reference, mainVote] of mainVotesMap) {
	const term = extractTermFromReference(reference) ?? fallbackTerm;
	termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
}

// Log distribution
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

**Leçon** : Afficher la répartition des données importées aide à :

- Détecter les anomalies (ex: 0 procédures PE-10 → erreur)
- Valider la logique d'extraction
- Transparence pour les utilisateurs
- Debugging (voir immédiatement si répartition change)

**Pattern réutilisable** :

```typescript
// Distribution générique
function logDistribution<K, V>(
	map: Map<K, V>,
	label: string,
	sortFn?: (a: [K, V], b: [K, V]) => number
) {
	const entries = [...map.entries()];
	if (sortFn) entries.sort(sortFn);

	console.log(`=== ${label} Distribution ===`);
	for (const [key, value] of entries) {
		console.log(`  ${key}: ${value}`);
	}
}

// Usage
logDistribution(termCounts, 'PE Terms', (a, b) => a[0] - b[0]);
```

### 6. ✅ Fallback graceful pour parsing non-critique

**Pattern** :

```typescript
const term = extractTermFromReference(reference) ?? fallbackTerm;
//                                                ^^
//                                                Nullish coalescing
```

**Leçon** : Pour les extractions non-critiques (métadonnées supplémentaires), utiliser un fallback plutôt que throw/fail.

**Quand utiliser** :

- ✅ Parsing de métadonnées (terme PE)
- ✅ Enrichissement optionnel
- ❌ Données critiques (ID unique, foreign keys)

**Pattern général** :

```typescript
// Parsing avec fallback
const value = tryParse(input) ?? defaultValue;

// Parsing avec validation stricte
const value = tryParse(input);
if (!value) throw new Error('Required field missing');
```

### 7. 🛡️ Valider les contraintes DB avant insertion

**Problème rencontré** :

```
ERROR: value too long for type character varying(300)
CONTEXT: column "short_title" of table "laws"
```

**Solution** :

```typescript
shortTitle: displayTitle.length > 300
	? displayTitle.slice(0, 297).replace(/\s+\S*$/, '') + '...'
	: displayTitle;
```

**Leçon** : Valider les contraintes **avant** insertion, pas compter sur l'erreur DB.

**Pattern général** :

```typescript
// Fonction helper de validation
function validateLaw(law: NewLaw): void {
	if (law.shortTitle.length > 300) {
		throw new Error(`shortTitle too long: ${law.shortTitle.length}`);
	}
	if (!law.id || law.id.length === 0) {
		throw new Error('id is required');
	}
	// etc.
}

// Usage
const law = mapToLaw(reference, mainVote, term);
validateLaw(law); // Throw si invalide
await db.insert(laws).values(law);
```

**Avantages** :

- Erreurs plus claires (avant échec DB)
- Évite transaction rollback partiel
- Tests unitaires faciles (pas besoin de vraie DB)

### 8. 📊 Tests automatisés vs. vérifications manuelles

**Constat** : 8 tests en échec, mais **non-bloquants** pour cette feature.

**Classification des échecs** :

| Type                | Nombre | Bloquant ? | Action                 |
| ------------------- | ------ | ---------- | ---------------------- |
| Pipeline LLM séparé | 7      | ❌ Non     | Run `etl:analyze-laws` |
| Test flaky (random) | 1      | ❌ Non     | Fix test design        |

**Leçon** : Analyser **pourquoi** un test échoue avant de corriger.

**Tests non-bloquants** :

- Feature non liée (enrichissement LLM)
- Données de test manquantes (à générer séparément)
- Test flaky (randomness, timing)

**Tests bloquants** :

- Erreur dans la logique métier de la feature
- Régression d'une feature existante
- Erreur de compilation TypeScript

**Pattern de validation** :

```bash
# 1. TypeScript (bloquant)
npx tsc --noEmit  # Doit passer à 100%

# 2. Tests unitaires (bloquant pour features touchées)
npm test -- laws.test.ts  # Doit passer à 100%

# 3. Tests d'intégration (peut avoir false negatives)
npm test  # Analyser les échecs, ne pas bloquer si non-liés

# 4. Import ETL réel (validation finale)
make etl-europarl-laws  # Doit réussir sans erreur
```

### 9. ✅ JSDoc pour les fonctions complexes

**Good practice** :

```typescript
/**
 * Extracts the EP term number from a procedure reference.
 * References follow patterns like A10-0270/2025, B9-0063/2026, RC-B10-0071/2026, C10-0263/2025.
 * The digit(s) after the letter prefix (A, B, C) represent the term.
 */
function extractTermFromReference(reference: string): number | null {
	const match = reference.match(/[ABC](\d+)-/);
	return match ? parseInt(match[1], 10) : null;
}
```

**Pourquoi documenter** :

- Regex non évident (`/[ABC](\d+)-/`)
- Format de référence externe (pas évident pour devs)
- Exemples concrets facilitent la compréhension

**Pattern JSDoc minimal** :

````typescript
/**
 * [Description courte]
 *
 * [Détails si nécessaire - format, contraintes, etc.]
 *
 * @param paramName - Description
 * @returns Description
 *
 * @example
 * ```typescript
 * extractTermFromReference('A10-0270/2025')  // → 10
 * extractTermFromReference('B9-0063/2026')   // → 9
 * ```
 */
````

### 10. 🔄 Workflow itératif : implement → review → fix → document

**Workflow suivi** :

1. **/implement** : Suppression filtre + extraction terme + troncature
2. **/test-run** : Validation import ETL (2 039 lois)
3. **/code-review** : Identification de 4 issues (JSDoc, truncation, sort, regex)
4. **Fix** : Correction des 4 issues
5. **/document** : ADR + lessons learned + update index

**Leçon** : Ne pas documenter trop tôt (avant code review), mais ne pas oublier après merge.

**Timing optimal** :

- ❌ Trop tôt : Avant code review → doc obsolète après corrections
- ✅ Optimal : Après code review + fixes → doc reflète code final
- ❌ Trop tard : Après merge → contexte perdu, effort documentation++

**Checklist de transition** :

- [ ] Code review done + issues fixed
- [ ] TypeScript validation passed
- [ ] Tests analyzed (bloquants vs. non-bloquants)
- [ ] **THEN** document (ADR + lessons learned)

## Métriques

| Métrique           | Avant                | Après                 | Δ                        |
| ------------------ | -------------------- | --------------------- | ------------------------ |
| Lois PE importées  | 9                    | 2 039                 | +22 566%                 |
| Termes PE couverts | 1 (PE-10)            | 3 (PE-8, PE-9, PE-10) | +200%                    |
| Temps d'import     | ~2s                  | ~30s                  | +1 400% (acceptable)     |
| Erreurs DB         | 7 (varchar overflow) | 0                     | -100%                    |
| Tests TypeScript   | ✅                   | ✅                    | Stable                   |
| Tests passants     | 259/267              | 259/267               | Stable (8 non-bloquants) |

## Patterns Réutilisables

### 1. Extraction de métadonnées depuis identifiants

```typescript
// Pattern générique
function extractMetadata(id: string, pattern: RegExp): string | null {
	const match = id.match(pattern);
	return match ? match[1] : null;
}

// Exemple : Version depuis tag git
extractMetadata('v2.1.0-beta', /v(\d+\.\d+\.\d+)/); // → '2.1.0'

// Exemple : Législature depuis ID scrutin
extractMetadata('VTANR5L17V4545', /L(\d+)V/); // → '17'
```

### 2. Troncature intelligente

```typescript
function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;

	const ellipsis = '...';
	const targetLength = maxLength - ellipsis.length;

	return text.slice(0, targetLength).replace(/\s+\S*$/, '') + ellipsis;
}

// Usage
truncate(longTitle, 300);
```

### 3. Distribution logging

```typescript
function logDistribution<K extends string | number, V extends number>(
	data: Map<K, V>,
	label: string,
	sortKey: 'key' | 'value' = 'key'
): void {
	const entries = [...data.entries()];

	if (sortKey === 'key') {
		entries.sort((a, b) => {
			if (typeof a[0] === 'number' && typeof b[0] === 'number') {
				return a[0] - b[0];
			}
			return String(a[0]).localeCompare(String(b[0]));
		});
	} else {
		entries.sort((a, b) => b[1] - a[1]);
	}

	console.log(`=== ${label} ===`);
	for (const [key, value] of entries) {
		console.log(`  ${key}: ${value}`);
	}
}
```

## Anti-Patterns Évités

### ❌ Hard-coding du terme courant

```typescript
// ❌ MAUVAIS
const term = 10; // Toutes les lois en PE-10

// ✅ BON
const term = extractTermFromReference(reference) ?? getCurrentPETerm();
```

### ❌ Confiance aveugle dans les paramètres API

```typescript
// ❌ MAUVAIS (assumption sans validation)
// "geo_areas=FRA filtre les MEPs français"
fetchHTV('/votes?geo_areas=FRA');

// ✅ BON (tester avec/sans filtre)
fetchHTV('/votes'); // Vérifier le résultat
```

### ❌ Ignorer les contraintes DB

```typescript
// ❌ MAUVAIS (crash si > 300 chars)
shortTitle: displayTitle;

// ✅ BON (valider avant insertion)
shortTitle: truncate(displayTitle, 300);
```

## Références

- **ADR-007** : `adr-2026-02-07-pe-laws-expansion.md`
- **Code** : `src/lib/server/etl/sources/europarl/laws.ts`
- **API Docs** : https://www.howtheyvote.eu/api/docs
- **Pattern** : `std-etl-cli-scripts.md`

## Tags

`#etl` `#api-integration` `#data-validation` `#error-handling` `#parsing` `#documentation`

## Date

2026-02-07
