# EuroParl ETL

Pipeline d'import et d'enrichissement des données du Parlement européen depuis l'API [HowTheyVote.eu](https://howtheyvote.eu).

## Architecture

```
europarl/
├── shared.ts          # Fonctions partagées (fetchHTV, generateLawId, extractTermFromReference)
├── votes.ts           # Import des votes + votes individuels des députés français
├── laws.ts            # Import des procédures législatives (lois PE)
├── law-texts.ts       # Enrichissement des descriptions de lois (scraping + LLM)
├── enrich-group-names.ts  # Enrichissement des noms longs de groupes PE
└── __tests__/         # Tests unitaires de non-régression
```

## Module `shared.ts`

Centralise les fonctions critiques pour garantir la **cohérence des IDs de lois** entre tous les modules.

### `fetchHTV<T>(endpoint: string)`

Client HTTP typé pour l'API HowTheyVote.eu.

```typescript
import { fetchHTV } from './shared';

const vote = await fetchHTV<HTVVote>('/votes/12345');
const list = await fetchHTV<HTVVoteListResponse>('/votes?page=1');
```

### `extractTermFromReference(reference: string)`

Extrait le numéro de législature depuis une référence de procédure.

```typescript
extractTermFromReference('A10-0270/2025'); // 10
extractTermFromReference('B9-0063/2026'); // 9
extractTermFromReference('RC-B10-0071/2026'); // 10 (références composites)
extractTermFromReference('2024/1234'); // null (pas de pattern)
```

**Patterns supportés** : `A{term}-`, `B{term}-`, `C{term}-` (ex: A9-, B10-, RC-B10-)

### `generateLawId(reference: string, fallbackTerm: number)`

Génère un ID unique de loi au format `LWPE{term}-{reference-avec-tirets}`.

```typescript
generateLawId('A9-0045/2024', 10); // 'LWPE9-A9-0045-2024'
generateLawId('RC-B10-0071/2026', 10); // 'LWPE10-RC-B10-0071-2026'
generateLawId('2024/1234', 10); // 'LWPE10-2024-1234' (fallback)
```

**⚠️ CRITIQUE** : Cette fonction doit produire des IDs **identiques** dans `votes.ts` et `laws.ts` pour garantir le lien `scrutins.lawId` ↔ `laws.id`.

## Pipeline ETL

### 1. Import des lois (`laws.ts`)

- Source : `/votes` (filtre `is_main=true`)
- Crée les entrées dans `laws` (table des procédures législatives)
- Génère les `lawId` avec `generateLawId()` pour le lien scrutin ↔ loi

### 2. Import des votes (`votes.ts`)

- Source : `/votes/{id}` (votes détaillés + votes individuels)
- Filtre : Députés français uniquement (via `actors.chamber = 'PE'`)
- Crée les entrées dans `scrutins` et `votes`
- Génère les `lawId` avec `generateLawId()` (doit matcher `laws.id`)

### 3. Enrichissement des textes (`law-texts.ts`)

- Source : Pages OEIL, communiqués de presse PE
- Stratégie :
  1. Lit les lois PE avec description courte/absente
  2. Retrouve le vote HTV via `scrutins.uid → HTV-{id}`
  3. Scrape les liens (Summary, Press, Report)
  4. Nettoie le HTML et assemble les textes
  5. Met à jour `laws.description` + `laws.sourceUrl`

## Bug corrigés (2026-02-09)

### Bug 1 : Filtre `geo_areas=FRA` trop restrictif

**Problème** : Le filtre limitait à 9 votes au lieu de 2204.
**Fix** : Supprimé le filtre, filtrage côté client via `mepIdMap` (députés français en base).

### Bug 2 : Extraction de législature défaillante

**Problème** : `generateLawId()` utilisait toujours `currentTerm` au lieu d'extraire depuis la référence → mismatch scrutin ↔ loi.
**Fix** : Factorisation de `extractTermFromReference()` dans `shared.ts`, utilisée par tous les modules.

### Bug 3 : `varchar(20)` trop court pour `lawId`

**Problème** : Les références composites comme `RC-B10-0071/2026` dépassaient 20 caractères.
**Fix** : Migration `scrutins.law_id` de `varchar(20)` à `varchar(50)`.

## Tests de non-régression

```bash
npm test europarl
```

- **shared.test.ts** : 25 tests (extraction de législature, génération d'IDs)
- **votes.test.ts** : 10 tests (non-régression bug législature)
- **law-texts.test.ts** : 19 tests (nettoyage HTML, assemblage de descriptions)

## Configuration

```typescript
// config.ts
export const PE_SOURCES = {
	howTheyVoteApiUrl: 'https://howtheyvote.eu/api'
};
```

## Commandes Make

```bash
make etl-europarl-laws      # Import des lois (procédures)
make etl-europarl-votes     # Import des votes + votes individuels
make etl-europarl-law-texts # Enrichissement des descriptions
```

## Documentation API HTV

- [HowTheyVote.eu API](https://howtheyvote.eu/api/docs)
- Endpoints utilisés :
  - `GET /votes` : Liste paginée des votes
  - `GET /votes/{id}` : Détails d'un vote + votes individuels
