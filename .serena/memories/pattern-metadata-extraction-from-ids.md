# Pattern : Extraction de Métadonnées depuis Identifiants Structurés

## Catégorie

Data Processing | Parsing | ETL

## Problème

Les identifiants externes (références de procédures, IDs techniques, tags git) contiennent souvent **des métadonnées implicites** encodées dans leur format :

- Version dans un tag git : `v2.1.0-beta`
- Législature dans un ID scrutin : `VTANR5L17V4545` (L17 = législature 17)
- Terme PE dans une référence : `A10-0270/2025` (10 = terme PE-10)

**Hard-coder ces métadonnées** créée :

- ❌ Maintenance manuelle (changer le code pour chaque nouvelle version)
- ❌ Incohérences (données historiques mal classées)
- ❌ Perte d'information (métadonnées ignorées)

## Contexte

Utiliser ce pattern quand :

- ✅ Identifiants externes suivent un format structuré
- ✅ Métadonnées peuvent être extraites par regex
- ✅ Extraction automatique est plus fiable que hard-coding
- ✅ Données historiques doivent être correctement classées

Ne PAS utiliser quand :

- ❌ Format d'ID imprévisible ou incohérent
- ❌ Extraction trop complexe (>1 regex)
- ❌ Métadonnées critiques (préférer API explicite)

## Solution

### Pattern générique

````typescript
/**
 * Extrait une métadonnée depuis un identifiant structuré
 *
 * @param id - Identifiant à parser
 * @param pattern - Regex d'extraction (groupe de capture 1)
 * @param parser - Fonction de transformation optionnelle
 * @returns Métadonnée extraite ou null si échec
 *
 * @example
 * ```typescript
 * extractMetadata('v2.1.0-beta', /v([\d.]+)/)  // → '2.1.0'
 * extractMetadata('VTANR5L17V4545', /L(\d+)V/, parseInt)  // → 17
 * ```
 */
function extractMetadata<T = string>(
	id: string,
	pattern: RegExp,
	parser?: (match: string) => T
): T | null {
	const match = id.match(pattern);
	if (!match || !match[1]) return null;

	return parser ? parser(match[1]) : (match[1] as T);
}
````

### Cas d'usage réel : Terme PE depuis référence

````typescript
/**
 * Extracts the EP term number from a procedure reference.
 * References follow patterns like A10-0270/2025, B9-0063/2026, RC-B10-0071/2026, C10-0263/2025.
 * The digit(s) after the letter prefix (A, B, C) represent the term.
 *
 * @param reference - Procedure reference (ex: "A10-0270/2025")
 * @returns Term number (ex: 10) or null if extraction fails
 *
 * @example
 * ```typescript
 * extractTermFromReference('A10-0270/2025')   // → 10
 * extractTermFromReference('B9-0063/2026')    // → 9
 * extractTermFromReference('RC-B10-0071/2026') // → 10
 * extractTermFromReference('invalid')         // → null
 * ```
 */
function extractTermFromReference(reference: string): number | null {
	const match = reference.match(/[ABC](\d+)-/);
	return match ? parseInt(match[1], 10) : null;
}

// Usage avec fallback
const term = extractTermFromReference(reference) ?? getCurrentPETerm();
const lawId = `LWPE${term}-${reference}`;
````

## Avantages

1. ✅ **Robustesse** : Fonctionne pour données historiques et futures
2. ✅ **Maintenabilité** : Pas de hard-coding à mettre à jour
3. ✅ **Précision** : Métadonnées extraites de la source de vérité (l'ID)
4. ✅ **Scalabilité** : Nouveau terme/version = automatiquement supporté
5. ✅ **Testabilité** : Fonction pure, facile à tester

## Inconvénients

1. ⚠️ **Dépendance au format** : Si format change, extraction échoue
   - **Mitigation** : Fallback + logs d'alerte
2. ⚠️ **Regex complexes** : Peut devenir difficile à maintenir
   - **Mitigation** : Bien documenter le format attendu (JSDoc)

## Exemples d'utilisation

### Cas 1 : Version depuis tag git

```typescript
function extractVersionFromTag(tag: string): string | null {
	return extractMetadata(tag, /v([\d.]+)/);
}

extractVersionFromTag('v2.1.0-beta'); // → '2.1.0'
extractVersionFromTag('release-3.0'); // → null
```

### Cas 2 : Législature depuis ID scrutin

```typescript
function extractLegislatureFromScrutinId(id: string): number | null {
	return extractMetadata(id, /L(\d+)V/, parseInt);
}

extractLegislatureFromScrutinId('VTANR5L17V4545'); // → 17
extractLegislatureFromScrutinId('VTANR5L16V2301'); // → 16
```

### Cas 3 : Date depuis nom de fichier

```typescript
function extractDateFromFilename(filename: string): string | null {
	return extractMetadata(filename, /(\d{4}-\d{2}-\d{2})/);
}

extractDateFromFilename('backup-2026-02-07.sql'); // → '2026-02-07'
extractDateFromFilename('data.csv'); // → null
```

### Cas 4 : Multi-extraction avec validation

```typescript
interface ParsedReference {
	type: 'A' | 'B' | 'C';
	term: number;
	number: number;
	year: number;
}

function parseEPReference(ref: string): ParsedReference | null {
	const match = ref.match(/([ABC])(\d+)-(\d+)\/(\d{4})/);
	if (!match) return null;

	return {
		type: match[1] as 'A' | 'B' | 'C',
		term: parseInt(match[2], 10),
		number: parseInt(match[3], 10),
		year: parseInt(match[4], 10)
	};
}

parseEPReference('A10-0270/2025');
// → { type: 'A', term: 10, number: 270, year: 2025 }
```

## Pattern avec Fallback

```typescript
/**
 * Extrait une métadonnée avec fallback si extraction échoue
 *
 * @param id - Identifiant à parser
 * @param pattern - Regex d'extraction
 * @param fallback - Valeur par défaut ou fonction de fallback
 * @param onFallback - Callback optionnel pour logger les échecs
 */
function extractWithFallback<T>(
	id: string,
	pattern: RegExp,
	fallback: T | (() => T),
	onFallback?: (id: string) => void
): T {
	const match = id.match(pattern);

	if (match && match[1]) {
		return match[1] as T;
	}

	// Log si callback fourni
	if (onFallback) {
		onFallback(id);
	}

	// Retourner fallback
	return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
}

// Usage
const term = extractWithFallback(
	reference,
	/[ABC](\d+)-/,
	() => getCurrentPETerm(),
	(ref) => console.warn(`Could not extract term from: ${ref}`)
);
```

## Tests

```typescript
describe('extractMetadata', () => {
	it('should extract version from git tag', () => {
		expect(extractMetadata('v2.1.0-beta', /v([\d.]+)/)).toBe('2.1.0');
	});

	it('should return null for invalid format', () => {
		expect(extractMetadata('invalid', /v([\d.]+)/)).toBeNull();
	});

	it('should parse extracted value', () => {
		const result = extractMetadata('L17V', /L(\d+)V/, parseInt);
		expect(result).toBe(17);
		expect(typeof result).toBe('number');
	});
});

describe('extractTermFromReference', () => {
	it('should extract term from type A reference', () => {
		expect(extractTermFromReference('A10-0270/2025')).toBe(10);
	});

	it('should extract term from type B reference', () => {
		expect(extractTermFromReference('B9-0063/2026')).toBe(9);
	});

	it('should extract term from RC-B prefix', () => {
		expect(extractTermFromReference('RC-B10-0071/2026')).toBe(10);
	});

	it('should return null for invalid reference', () => {
		expect(extractTermFromReference('invalid')).toBeNull();
	});
});
```

## Checklist d'implémentation

- [ ] Format de l'ID est documenté (JSDoc avec exemples)
- [ ] Regex est testée sur cas réels
- [ ] Fallback fourni pour extraction critique
- [ ] Logs d'alerte si extraction échoue
- [ ] Tests unitaires couvrent cas valides + invalides
- [ ] Gestion des préfixes multiples (ex: `RC-B10`)

## Anti-Patterns

### ❌ Hard-coding la métadonnée

```typescript
// ❌ MAUVAIS : Force toutes les procédures à PE-10
const term = 10;
const lawId = `LWPE${term}-${reference}`;
// Problème : Données historiques PE-8, PE-9 incorrectement classées
```

### ❌ Extraction sans fallback pour données critiques

```typescript
// ❌ MAUVAIS : Si extraction échoue, law.legislature = undefined
const term = extractTermFromReference(reference);
const law = { legislature: `PE-${term}`, ... };
// Problème : Créée des données invalides si extraction échoue
```

### ❌ Regex trop permissive

```typescript
// ❌ MAUVAIS : Match n'importe quel nombre
reference.match(/(\d+)/); // → Match aussi l'année (2025)

// ✅ BON : Match spécifiquement le terme
reference.match(/[ABC](\d+)-/); // → Match uniquement le terme
```

## Voir aussi

- **Cas d'usage réel** : `src/lib/server/etl/sources/europarl/laws.ts:79` (extractTermFromReference)
- **Lessons learned** : `lessons-learned-2026-02-07-pe-laws-expansion.md` (leçon #2)
- **ADR** : `adr-2026-02-07-pe-laws-expansion.md` (décision d'extraction automatique)
- **Pattern lié** : `pattern-legislature-id-normalization.md`

## Date de création

2026-02-07

## Historique

| Date       | Modification                                             |
| ---------- | -------------------------------------------------------- |
| 2026-02-07 | Création suite à implémentation extractTermFromReference |
