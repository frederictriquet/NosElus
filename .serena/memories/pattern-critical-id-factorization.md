# Pattern : Factorisation des Fonctions de Génération d'IDs Critiques

## Problème

Lorsqu'un ID sert de **clé de liaison entre tables** (foreign key logique), la duplication de la fonction de génération dans plusieurs modules peut causer des incohérences catastrophiques :

- IDs différents pour la même entité
- Joins cassés (0 résultats au lieu de milliers)
- Perte d'intégrité référentielle

## Contexte

Ce pattern s'applique quand :

- Un ID est généré programmatiquement (pas auto-incrémenté DB)
- Cet ID est utilisé comme clé de liaison entre tables/modules
- Plusieurs modules doivent générer le même ID pour la même entité

## Solution

**Centraliser** la génération d'ID dans un module `shared.ts` partagé par tous les consommateurs.

### Structure recommandée

```
module/
├── shared.ts          # ⚠️ CRITIQUE : Fonctions de génération d'IDs
├── moduleA.ts         # Import depuis shared.ts
├── moduleB.ts         # Import depuis shared.ts
└── moduleC.ts         # Import depuis shared.ts
```

### Exemple concret (PE ETL)

**Avant (MAUVAIS)** : Duplication avec risque d'incohérence

```typescript
// votes.ts
function generateLawId(ref: string, term: number): string {
	// Regex: /[A-Z](\d+)-/
	return `LWPE${term}-${ref.replace(/\//g, '-')}`;
}

// laws.ts
function generateLawId(ref: string, term: number): string {
	// Regex: /[ABC](\d+)-/ ⚠️ DIFFÉRENTE !
	const extracted = ref.match(/[ABC](\d+)-/)?.[1];
	const t = extracted ? parseInt(extracted) : term;
	return `LWPE${t}-${ref.replace(/\//g, '-')}`;
}
```

**Après (CORRECT)** : Factorisation dans shared.ts

```typescript
// shared.ts
export function extractTermFromReference(reference: string): number | null {
	const match = reference.match(/[ABC](\d+)-/);
	return match ? parseInt(match[1], 10) : null;
}

export function generateLawId(reference: string, fallbackTerm: number): string {
	const term = extractTermFromReference(reference) ?? fallbackTerm;
	return `LWPE${term}-${reference.replace(/\//g, '-')}`;
}

// votes.ts
import { generateLawId } from './shared';
const lawId = generateLawId(vote.reference, currentTerm);

// laws.ts
import { generateLawId } from './shared';
const lawId = generateLawId(procedure.reference, currentTerm);
```

## Avantages

- **Cohérence garantie** : Une seule source de vérité
- **Maintenabilité** : Changement en un seul endroit
- **Testabilité** : Tests centralisés et exhaustifs
- **Évitabilité des bugs** : Impossible d'avoir des divergences

## Inconvénients

- Dépendance partagée (couplage entre modules)
- Nécessite discipline pour ne pas dupliquer

## Checklist d'implémentation

- [ ] Identifier toutes les fonctions générant le même type d'ID
- [ ] Créer un module `shared.ts` ou équivalent
- [ ] Extraire la fonction de génération canonique
- [ ] Mettre à jour tous les consommateurs pour importer
- [ ] Vérifier qu'aucune définition locale ne subsiste
- [ ] Ajouter JSDoc avec **avertissement CRITIQUE** sur la cohérence
- [ ] Écrire tests exhaustifs de non-régression

### Exemple JSDoc

```typescript
/**
 * Génère un ID unique au format standardisé.
 *
 * ⚠️ CRITIQUE : Cette fonction doit produire des IDs IDENTIQUES
 * dans tous les modules pour garantir l'intégrité référentielle.
 *
 * @see {@link extractTermFromReference} pour la logique d'extraction
 */
export function generateLawId(reference: string, fallbackTerm: number): string {
	// ...
}
```

## Code Review Checklist

Lors d'une PR modifiant une fonction de génération d'ID :

- [ ] **Blocker** : Y a-t-il des définitions locales dupliquées ?
- [ ] **Blocker** : Les regex/patterns sont-ils identiques partout ?
- [ ] **Major** : Les tests couvrent-ils tous les cas de génération ?
- [ ] **Major** : La documentation mentionne-t-elle le caractère critique ?

## Exemples d'utilisation dans le projet

### EuroParl ETL (2026-02-09)

- **Fichier** : `src/lib/server/etl/sources/europarl/shared.ts`
- **Fonction** : `generateLawId()`
- **Consommateurs** : votes.ts, laws.ts, law-texts.ts
- **Clé de liaison** : `scrutins.lawId` → `laws.id`
- **Impact bug** : 2 matches au lieu de 2204 (99,9% données inaccessibles)

### Scrutin IDs (potentiel)

- **Pattern** : `VTPE{term}-{voteId}` (votes PE)
- Si répliqué ailleurs, factoriser également

## Détection automatique

### Recherche de duplication

```bash
# Rechercher les fonctions de génération d'ID potentiellement dupliquées
rg "function generate.*Id" --type ts
rg "const .*Id = \`[A-Z]+\$\{" --type ts
```

### Lint rule (idéal)

```typescript
// eslint-plugin-custom
"no-duplicate-id-generation": {
  message: "ID generation must be centralized in shared.ts"
}
```

## Voir aussi

- Pattern : Multi-Chamber Factorization (`pattern-multi-chamber-factorization.md`)
- Bug : PE ETL lawId Mismatch (`bug-2026-02-09-pe-etl-lawid-mismatch.md`)
- Standard : Shared Data Definitions (`std-shared-data-definitions.md`)

## Date d'adoption

2026-02-09
