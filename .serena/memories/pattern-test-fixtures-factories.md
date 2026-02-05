# Pattern : Factories de Test et Fixtures

## Contexte
Pattern utilisé pour les tests du module ParlGov. Permet de créer facilement des données de test réutilisables.

## Pattern : Test Factories

### Factory Function
```typescript
/**
 * Factory pour créer un Organ de test
 */
export function createTestOrgan(overrides?: Partial<Organ>): Organ {
	return {
		id: 'PO123456',
		uid: 'TEST-UID',
		name: 'Test Organ',
		shortName: 'TO',
		acronym: null,
		type: 'GP',
		chamber: 'AN',
		color: '#000000',
		legislature: 17,
		startDate: '2024-01-01',
		endDate: null,
		politicalPosition: null,
		...overrides // Permet de surcharger n'importe quel champ
	};
}
```

### Usage
```typescript
// Cas minimal
const organ = createTestOrgan();

// Avec customisation
const lfi = createTestOrgan({
	name: 'La France Insoumise',
	shortName: 'LFI',
	politicalPosition: 1.3
});
```

## Pattern : Fixtures Réutilisables

### Grouper par domaine
```typescript
export const realOrgans = {
	lfi: createTestOrgan({ id: 'PO800538', name: 'LFI-NFP', shortName: 'LFI' }),
	rn: createTestOrgan({ id: 'PO800520', name: 'Rassemblement National', shortName: 'RN' }),
	ni: createTestOrgan({ id: 'PO419610', name: 'Non inscrit', shortName: 'NI' })
};

export const parlGovParties = {
	lfi: createTestParlGovParty({ partyId: 1709, leftRight: 1.3 }),
	rn: createTestParlGovParty({ partyId: 1439, leftRight: 8.8 })
};
```

### Échantillons de données
```typescript
export const csvSamples = {
	valid: `party_id,name
1,Test Party`,
	
	withQuotes: `id,name
1,"Party, with comma"`,
	
	empty: ``
};
```

## Pattern : Organisation des Tests

### Structure de fichiers
```
__tests__/
├── fixtures.ts               # Factories et fixtures
├── module.normalize.test.ts  # Tests de normalisation
├── module.jaccard.test.ts    # Tests de similarité
├── module.matching.test.ts   # Tests de matching
└── module.position.test.ts   # Tests de position
```

### Séparation par domaine fonctionnel
Plutôt qu'un seul gros fichier `matcher.test.ts`, séparer en :
- `matcher.normalize.test.ts` - Normalisation de texte
- `matcher.jaccard.test.ts` - Calculs de similarité
- `matcher.ni.test.ts` - Détection NI
- `matcher.matching.test.ts` - Logique de matching
- `matcher.position.test.ts` - Détermination position

**Avantages** :
- Fichiers plus courts (~150 lignes max)
- Tests plus faciles à naviguer
- Parallélisation possible

## Pattern : Nommage des Tests

### Convention "should [action] when [condition]"
```typescript
it('should return 1.0 for identical strings')
it('should return null when score below threshold')
it('should NOT match "Rassemblement National" (false positive test)')
```

### Tests de cas réels
```typescript
it('should match real LFI organ to ParlGov LFI')
it('should handle real party names: LFI vs LFI-NFP')
```

## Pattern : Assertions Précises

### ❌ Vague
```typescript
expect(result).toBeTruthy();
expect(result).toBeDefined();
```

### ✅ Précis
```typescript
expect(result).toBe(1.0);
expect(result).toBeNull();
expect(result).toMatchObject({
	organId: expect.any(String),
	score: expect.any(Number)
});
```

## Leçons Apprises

### 1. Tester le comportement réel, pas idéal
Les tests ont dû être ajustés pour refléter que :
- Le parser CSV trim les espaces même dans les guillemets
- "Non inscrits" (espace) ≠ "Non-inscrits" (tiret)
- "est" n'est pas dans les stop words français

### 2. Word boundaries sont critiques
Pour éviter faux positifs (ex: "na" dans "National"), utiliser `\b` :
```typescript
const wordRegex = new RegExp(`\\b${niLower}\\b`, 'i');
```

### 3. Bonus Jaccard change les scores attendus
Si un mot long (8+ chars) est en commun :
- Base Jaccard = 0.5
- Bonus = +0.2
- Total = 0.7

### 4. Export pour tests
Exporter les fonctions privées pour tests :
```typescript
export function parseCSVLine(line: string): string[] {
  // Exported for testing
}
```

## Métriques

- **124 tests** pour le module ParlGov
- **198 tests** total projet
- **100% de couverture** des fonctions publiques
- **Temps d'exécution** : ~9.9s pour toute la suite

## Réutilisation

Ce pattern est applicable pour :
- Tests ETL (sources externes, parsing)
- Tests matching/fuzzy logic
- Tests avec données complexes (DB, API)
- Tests nécessitant variations sur un même type
