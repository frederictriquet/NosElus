# Architecture : Automatisation Positionnement Politique

## Date : 2026-02-04

## ADR de référence : ADR-004

---

## 1. Vue d'ensemble

### Diagramme de haut niveau

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Pipeline ETL - Positionnement Politique                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐    ┌────────────────┐    ┌────────────────┐    ┌──────────┐  │
│  │   ParlGov    │───▶│  CSV Parser    │───▶│  Fuzzy Matcher │───▶│    DB    │  │
│  │  (CSV URL)   │    │  + Filtrage FR │    │   (Jaccard)    │    │  organs  │  │
│  └──────────────┘    └────────────────┘    └────────────────┘    └──────────┘  │
│                                                                                 │
│        Source                Parse              Match                Persist    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Usage - Pages Svelte                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐    ┌────────────────┐    ┌────────────────┐    ┌──────────┐  │
│  │  +page.ts    │───▶│  Query DB      │───▶│  sortByPolitical│───▶│  Render  │  │
│  │  (load)      │    │  SELECT organs │    │  Position()     │    │   Map    │  │
│  └──────────────┘    └────────────────┘    └────────────────┘    └──────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Composants principaux

| Composant            | Responsabilité                           | Entrées        | Sorties            |
| -------------------- | ---------------------------------------- | -------------- | ------------------ |
| **ParlGov Client**   | Télécharger et parser CSV ParlGov        | URL ParlGov    | `ParlGovParty[]`   |
| **NLP Normalizer**   | Normaliser les noms pour matching        | `string`       | `string` normalisé |
| **Fuzzy Matcher**    | Calculer similarité Jaccard              | Deux strings   | Score 0.0-1.0      |
| **Position Updater** | Mettre à jour `organs.politicalPosition` | `Organ`, score | Upsert DB          |
| **Sort Utility**     | Trier groupes par position               | `Organ[]`      | `Organ[]` triés    |

---

## 2. Structure des Fichiers

### Arborescence proposée

```
src/
├── lib/
│   ├── server/
│   │   ├── db/
│   │   │   └── schema/
│   │   │       └── organs.ts              # [MODIFIER] Ajouter politicalPosition
│   │   └── etl/
│   │       └── sources/
│   │           └── parlgov/               # [CRÉER] Nouveau module
│   │               ├── index.ts           # Export public
│   │               ├── types.ts           # Interfaces ParlGov
│   │               ├── client.ts          # Téléchargement + parsing CSV
│   │               └── matcher.ts         # Fuzzy matching avec organs
│   └── utils/
│       ├── political-spectrum.ts          # [CRÉER] Fonction de tri
│       └── political-spectrum.test.ts     # [CRÉER] Tests unitaires
│
scripts/
└── etl/
    └── import-political-positions.ts      # [CRÉER] Script CLI

migrations/
└── 0015_add_political_position.sql        # [CRÉER] Migration DB
```

### Conventions de nommage

| Type         | Convention        | Exemple                                                 |
| ------------ | ----------------- | ------------------------------------------------------- |
| Fichiers ETL | `kebab-case.ts`   | `import-political-positions.ts`                         |
| Types        | `PascalCase`      | `ParlGovParty`, `MatchResult`                           |
| Fonctions    | `camelCase`       | `sortByPoliticalPosition`, `calculateJaccardSimilarity` |
| Constantes   | `SCREAMING_SNAKE` | `SIMILARITY_THRESHOLD`, `FRENCH_STOP_WORDS`             |
| Colonnes DB  | `snake_case`      | `political_position`                                    |

---

## 3. Interfaces et Contrats

### Types ParlGov (`src/lib/server/etl/sources/parlgov/types.ts`)

```typescript
/**
 * Entrée brute du CSV ParlGov (view_party.csv)
 */
export interface ParlGovPartyRaw {
	country_name_short: string; // "FRA"
	country_name: string; // "France"
	party_name_short: string; // "LFI"
	party_name_english: string; // "Unsubmissive France"
	party_name: string; // "La France insoumise"
	family_name_short: string; // "soc" | "com" | "lib" | etc.
	family_name: string; // "Social democracy"
	left_right: string; // "2.3" (0-10 scale)
	state_market?: string; // Economic axis
	liberty_authority?: string; // Auth axis
	eu_anti_pro?: string; // EU stance
}

/**
 * Parti politique ParlGov normalisé (après parsing)
 */
export interface ParlGovParty {
	countryCode: string; // "FRA"
	shortName: string; // "LFI"
	nameEnglish: string; // "Unsubmissive France"
	nameNative: string; // "La France insoumise"
	familyShort: string; // "soc"
	leftRight: number | null; // 2.3 ou null si absent
}

/**
 * Résultat d'un matching entre ParlGov et organs
 */
export interface MatchResult {
	organId: string; // ID du groupe NosElus
	organName: string; // Nom du groupe
	parlGovParty: ParlGovParty; // Parti ParlGov matché
	score: number; // Score Jaccard (0.0-1.0)
	matchedOn: 'shortName' | 'nameNative' | 'nameEnglish';
}

/**
 * Statistiques d'import
 */
export interface ImportStats {
	partiesFetched: number; // Total partis ParlGov
	partiesFiltered: number; // Partis FR/EU retenus
	organsProcessed: number; // Groupes NosElus traités
	matched: number; // Matchés avec succès
	notMatched: number; // Sans match (fallback)
	updated: number; // Positions mises à jour en DB
	errors: number; // Erreurs
	duration: number; // Durée en ms
}
```

### Client ParlGov (`src/lib/server/etl/sources/parlgov/client.ts`)

```typescript
/**
 * Configuration du client ParlGov
 */
export interface ParlGovClientConfig {
	/** URL du CSV (défaut: view_party.csv officiel) */
	csvUrl?: string;
	/** Timeout en ms (défaut: 30000) */
	timeout?: number;
	/** Codes pays à inclure (défaut: ['FRA', 'EUR']) */
	countryCodes?: string[];
}

/**
 * Client pour récupérer les données ParlGov
 */
export interface IParlGovClient {
	/** Télécharge et parse le CSV complet */
	fetchAllParties(): Promise<ParlGovParty[]>;

	/** Filtre les partis par pays */
	filterByCountry(parties: ParlGovParty[], codes: string[]): ParlGovParty[];
}
```

### Matcher (`src/lib/server/etl/sources/parlgov/matcher.ts`)

```typescript
/**
 * Configuration du matcher
 */
export interface MatcherConfig {
	/** Seuil minimum de similarité (défaut: 0.4) */
	threshold?: number;
	/** Bonus pour mots longs (défaut: 0.2) */
	longWordBonus?: number;
	/** Longueur minimum mot long (défaut: 8) */
	longWordMinLength?: number;
}

/**
 * Interface du matcher Fuzzy Jaccard
 */
export interface IPartyMatcher {
	/** Trouve le meilleur match ParlGov pour un organ */
	findBestMatch(organ: Organ, parlGovParties: ParlGovParty[]): MatchResult | null;

	/** Matche tous les organs avec les partis ParlGov */
	matchAll(organs: Organ[], parlGovParties: ParlGovParty[]): MatchResult[];
}

/**
 * Calcule la similarité Jaccard entre deux chaînes
 * @returns Score entre 0.0 et 1.0
 */
export function calculateJaccardSimilarity(s1: string, s2: string): number;

/**
 * Normalise un nom pour le matching
 * - Lowercase, supprime accents, stop words, ponctuation
 */
export function normalizeForMatching(name: string): string;
```

### Utilitaire de tri (`src/lib/utils/political-spectrum.ts`)

```typescript
/**
 * Organ avec position politique
 */
export interface OrganWithPosition {
	id: string;
	shortName: string | null;
	politicalPosition: number | null;
	// ... autres champs Organ
}

/**
 * Options de tri
 */
export interface SortOptions {
	/** Position pour les NI (défaut: 999) */
	niPosition?: number;
	/** Position par défaut si null (défaut: 5.0 = centre) */
	defaultPosition?: number;
	/** Identifiants des groupes NI */
	niIdentifiers?: string[];
}

/**
 * Trie les groupes politiques par position sur l'échiquier
 * Gauche (0) → Droite (10) → Non-inscrits (999)
 *
 * @param organs - Groupes à trier
 * @param options - Options de tri (fallbacks)
 * @returns Groupes triés par position politique
 */
export function sortByPoliticalPosition<T extends OrganWithPosition>(
	organs: T[],
	options?: SortOptions
): T[];

/**
 * Vérifie si un groupe est "Non-inscrit"
 */
export function isNonInscrit(organ: OrganWithPosition): boolean;

/**
 * Obtient la position effective (avec fallbacks)
 */
export function getEffectivePosition(organ: OrganWithPosition, options?: SortOptions): number;
```

---

## 4. Flux de Données

### Diagramme de séquence - Import ETL

```
┌────────┐     ┌────────────┐     ┌──────────┐     ┌─────────┐     ┌────┐
│ Script │     │ ParlGov    │     │ Matcher  │     │ NLP     │     │ DB │
│  CLI   │     │  Client    │     │          │     │         │     │    │
└───┬────┘     └─────┬──────┘     └────┬─────┘     └────┬────┘     └──┬─┘
    │                │                 │                │             │
    │  1. Start      │                 │                │             │
    │───────────────▶│                 │                │             │
    │                │                 │                │             │
    │                │  2. Fetch CSV   │                │             │
    │                │────────────────────────────────────────────────▶│
    │                │                 │                │             │(ParlGov)
    │                │  3. CSV Data    │                │             │
    │                │◀────────────────────────────────────────────────│
    │                │                 │                │             │
    │                │  4. Parse CSV   │                │             │
    │◀───────────────│                 │                │             │
    │                │                 │                │             │
    │  5. Filter FR  │                 │                │             │
    │───────────────▶│                 │                │             │
    │                │                 │                │             │
    │  6. ParlGov    │                 │                │             │
    │     Parties    │                 │                │             │
    │◀───────────────│                 │                │             │
    │                │                 │                │             │
    │  7. Get Organs │                 │                │             │
    │───────────────────────────────────────────────────────────────▶│
    │                │                 │                │             │
    │  8. Organs[]   │                 │                │             │
    │◀───────────────────────────────────────────────────────────────│
    │                │                 │                │             │
    │  9. Match      │                 │                │             │
    │───────────────────────────────▶│ │                │             │
    │                │                 │                │             │
    │                │                 │  10. Normalize │             │
    │                │                 │───────────────▶│             │
    │                │                 │                │             │
    │                │                 │  11. Jaccard   │             │
    │                │                 │◀───────────────│             │
    │                │                 │                │             │
    │  12. Results   │                 │                │             │
    │◀───────────────────────────────│                │             │
    │                │                 │                │             │
    │  13. Update DB │                 │                │             │
    │───────────────────────────────────────────────────────────────▶│
    │                │                 │                │             │
    │  14. Done      │                 │                │             │
    │◀───────────────────────────────────────────────────────────────│
```

### Diagramme de séquence - Usage (pages Svelte)

```
┌────────┐     ┌────────────┐     ┌───────────────┐     ┌────────┐
│ Page   │     │ +page.ts   │     │ sortByPolitical│     │ Svelte │
│ Request│     │ (load)     │     │ Position()    │     │ Render │
└───┬────┘     └─────┬──────┘     └──────┬────────┘     └───┬────┘
    │                │                   │                  │
    │  1. Request    │                   │                  │
    │───────────────▶│                   │                  │
    │                │                   │                  │
    │                │  2. SELECT organs │                  │
    │                │  WHERE chamber=AN │                  │
    │                │  (includes        │                  │
    │                │   political_pos)  │                  │
    │                │─────────────────▶ │                  │
    │                │                   │                  │
    │                │  3. Organs[]      │                  │
    │                │◀───────────────── │                  │
    │                │                   │                  │
    │                │  4. Sort          │                  │
    │                │──────────────────▶│                  │
    │                │                   │                  │
    │                │  5. Sorted[]      │                  │
    │                │◀──────────────────│                  │
    │                │                   │                  │
    │  6. data       │                   │                  │
    │◀───────────────│                   │                  │
    │                │                   │                  │
    │  7. Render     │                   │                  │
    │────────────────────────────────────────────────────▶│
```

---

## 5. Gestion des Erreurs

### Stratégie par couche

| Couche        | Type d'erreur   | Stratégie             | Exemple             |
| ------------- | --------------- | --------------------- | ------------------- |
| **CSV Fetch** | Réseau/Timeout  | Retry 3x avec backoff | `ParlGovFetchError` |
| **CSV Parse** | Format invalide | Log + skip ligne      | Warning console     |
| **Matching**  | Pas de match    | Fallback heuristique  | `position = 5.0`    |
| **DB Update** | Contrainte      | Transaction rollback  | `DBUpdateError`     |
| **Sort**      | `null` position | Fallback configurable | `position = 999`    |

### Types d'erreurs

```typescript
// Erreur de récupération ParlGov
export class ParlGovFetchError extends Error {
	constructor(
		message: string,
		public url: string,
		public cause?: Error
	) {
		super(`ParlGov fetch failed: ${message}`);
		this.name = 'ParlGovFetchError';
	}
}

// Erreur de matching
export class MatchingError extends Error {
	constructor(
		message: string,
		public organId: string,
		public candidates: number
	) {
		super(`Matching failed for ${organId}: ${message}`);
		this.name = 'MatchingError';
	}
}
```

### Fallbacks heuristiques

```typescript
const HEURISTIC_FALLBACKS: Record<string, number> = {
	// Non-inscrits → fin de liste
	NI: 999,
	NA: 999,
	'Non-inscrit': 999,

	// Par famille politique (si matching échoue)
	com: 1.5, // Communist/Socialist → extrême gauche
	soc: 3.0, // Social democracy → gauche
	eco: 3.5, // Green/Ecologist → gauche
	lib: 5.5, // Liberal → centre-droit
	chr: 6.0, // Christian democracy → droite
	con: 7.0, // Conservative → droite
	right: 8.5 // Right-wing → extrême droite
};

const DEFAULT_POSITION = 5.0; // Centre si inconnu
```

---

## 6. Dépendances

### Dépendances internes

| Module                          | Dépend de                     | Type            |
| ------------------------------- | ----------------------------- | --------------- |
| `import-political-positions.ts` | `parlgov/*`, `db`             | Direct          |
| `parlgov/client.ts`             | `parlgov/types.ts`            | Types           |
| `parlgov/matcher.ts`            | `parlgov/types.ts`, NLP utils | Types + logique |
| `political-spectrum.ts`         | Types Organ                   | Interface       |
| `/an/carte/+page.svelte`        | `political-spectrum.ts`       | Utilitaire      |

### Dépendances externes

| Package       | Version  | Usage               |
| ------------- | -------- | ------------------- |
| `csv-parse`   | existant | Parsing CSV ParlGov |
| `drizzle-orm` | existant | Accès DB            |
| `node:util`   | builtin  | parseArgs CLI       |

**Aucune nouvelle dépendance externe requise.**

### Réutilisation de patterns existants

| Pattern       | Source                              | Usage         |
| ------------- | ----------------------------------- | ------------- |
| Fuzzy Jaccard | `pattern-jaccard-title-matching.md` | Matching noms |
| ETL structure | `import-external-colors.ts`         | Script CLI    |
| Stop words FR | `link-scrutins-by-title.ts`         | Normalisation |

---

## 7. Considérations Non-Fonctionnelles

### Performance

- [x] **Pas de cache nécessaire** : CSV ParlGov ~200KB, téléchargé 1x par import
- [x] **Matching O(n×m)** : ~200 partis FR × ~50 organs = 10K comparaisons (instantané)
- [x] **Index DB** : `CREATE INDEX idx_organs_political_position ON organs(political_position)`

### Sécurité

- [x] **Pas d'authentification** : ParlGov est public (CSV)
- [x] **Validation entrées** : Vérifier format CSV avant parsing
- [x] **Pas d'injection** : Positions numériques uniquement

### Observabilité

- [x] **Logging** : Stats détaillées (matched/not matched/errors)
- [x] **Progress** : `[1/50] Processing LFI-NFP...`
- [x] **Dry-run** : Mode simulation sans écriture DB

### Idempotence

- [x] **Upsert** : `UPDATE organs SET political_position = ? WHERE id = ?`
- [x] **Ré-exécutable** : Peut tourner plusieurs fois sans effet de bord

---

## 8. Plan d'Implémentation

### Phase 1 : Fondations (Day 1 - matin)

```
1.1 Migration DB
├── Créer migration `0015_add_political_position.sql`
├── ALTER TABLE organs ADD COLUMN political_position REAL
├── CREATE INDEX idx_organs_political_position
└── Tester migration (up/down)

1.2 Types et interfaces
├── Créer `src/lib/server/etl/sources/parlgov/types.ts`
├── Définir ParlGovPartyRaw, ParlGovParty, MatchResult
└── Export dans `index.ts`
```

### Phase 2 : Client ParlGov (Day 1 - après-midi)

```
2.1 Client CSV
├── Créer `src/lib/server/etl/sources/parlgov/client.ts`
├── Implémenter fetchAllParties() avec fetch + csv-parse
├── Implémenter filterByCountry()
└── Gestion erreurs (timeout, format)

2.2 Normalisation NLP
├── Créer constantes FRENCH_STOP_WORDS
├── Implémenter normalizeForMatching()
└── Tests unitaires normalisation
```

### Phase 3 : Matcher Jaccard (Day 2 - matin)

```
3.1 Algorithme Jaccard
├── Créer `src/lib/server/etl/sources/parlgov/matcher.ts`
├── Implémenter calculateJaccardSimilarity()
├── Implémenter findBestMatch() avec multi-champs
└── Tests unitaires Jaccard

3.2 Intégration
├── Implémenter matchAll()
├── Ajouter fallbacks heuristiques
└── Tests de bout en bout avec données réelles
```

### Phase 4 : Script ETL (Day 2 - après-midi)

```
4.1 Script CLI
├── Créer `scripts/etl/import-political-positions.ts`
├── Implémenter flags (--dry-run, --verbose, --test-connection)
├── Implémenter logique principale
└── Stats finales

4.2 Makefile
├── Ajouter target `etl-political-positions`
└── Documentation
```

### Phase 5 : Utilitaire de tri (Day 3 - matin)

```
5.1 Fonction de tri
├── Créer `src/lib/utils/political-spectrum.ts`
├── Implémenter sortByPoliticalPosition()
├── Implémenter isNonInscrit(), getEffectivePosition()
└── Tests unitaires complets

5.2 Migration pages
├── Modifier `/an/carte/+page.svelte` (supprimer hardcoding)
├── Modifier `/pe/carte/+page.svelte` (supprimer hardcoding)
└── Tests manuels affichage
```

### Phase 6 : Validation (Day 3 - après-midi)

```
6.1 Tests end-to-end
├── Exécuter import sur DB dev
├── Vérifier positionnement correct
├── Vérifier affichage pages

6.2 Documentation
├── Mettre à jour CLAUDE.md si nécessaire
├── Ajouter instructions dans README
└── Capitaliser dans SERENA
```

---

## 9. Fichiers à créer/modifier

| Fichier                                         | Action   | Description                     |
| ----------------------------------------------- | -------- | ------------------------------- |
| `migrations/0015_add_political_position.sql`    | Créer    | Migration colonne + index       |
| `src/lib/server/db/schema/organs.ts`            | Modifier | Ajouter champ politicalPosition |
| `src/lib/server/etl/sources/parlgov/types.ts`   | Créer    | Types ParlGov                   |
| `src/lib/server/etl/sources/parlgov/client.ts`  | Créer    | Client CSV                      |
| `src/lib/server/etl/sources/parlgov/matcher.ts` | Créer    | Fuzzy Jaccard                   |
| `src/lib/server/etl/sources/parlgov/index.ts`   | Créer    | Exports publics                 |
| `scripts/etl/import-political-positions.ts`     | Créer    | Script CLI                      |
| `src/lib/utils/political-spectrum.ts`           | Créer    | Utilitaire tri                  |
| `src/lib/utils/political-spectrum.test.ts`      | Créer    | Tests unitaires                 |
| `src/routes/an/carte/+page.svelte`              | Modifier | Supprimer hardcoding            |
| `src/routes/pe/carte/+page.svelte`              | Modifier | Supprimer hardcoding            |
| `Makefile`                                      | Modifier | Ajouter target ETL              |

---

## 10. Checklist de Validation

### Avant implémentation

- [x] Interfaces clairement définies
- [x] Responsabilités bien séparées (Client / Matcher / Sort)
- [x] Dépendances minimales (pas de nouvelles deps externes)
- [x] Testabilité assurée (fonctions pures, injection)
- [x] Erreurs gérées (fallbacks, logging)
- [x] Structure suit conventions projet (ETL pattern)
- [x] Considérations non-fonctionnelles adressées
- [x] Plan d'implémentation réaliste (3 jours)

### Critères de succès

- [ ] Migration DB appliquée
- [ ] Script ETL exécutable (`npx tsx scripts/etl/import-political-positions.ts`)
- [ ] > 90% des groupes AN/PE matchés
- [ ] Pages `/an/carte` et `/pe/carte` fonctionnelles sans hardcoding
- [ ] Tests passent à 100%
- [ ] Aucun `spectrumOrder` dans le code

---

## 11. Décisions architecturales

### Pourquoi un module séparé `parlgov/` ?

- **Cohérence** : Suit le pattern `sources/<provider>/` existant (assemblee-nationale, europarl, legifrance)
- **Encapsulation** : Types et logique ParlGov isolés
- **Réutilisabilité** : Pourrait être étendu pour autres données ParlGov (gouvernements, élections)

### Pourquoi pas de service/classe ?

- **Simplicité** : Fonctions pures suffisantes (pas d'état)
- **Testabilité** : Fonctions plus simples à tester que classes
- **Pattern existant** : Autres ETL utilisent fonctions, pas classes

### Pourquoi matcher sur 3 champs ?

- **Robustesse** : `shortName` peut différer ("LFI" vs "LFI-NFP")
- **Fallback** : Si shortName échoue, essayer nameNative puis nameEnglish
- **Score agrégé** : Prendre le meilleur score des 3 tentatives

---

## 12. Patterns utilisés

| Pattern                | Usage                | Référence                           |
| ---------------------- | -------------------- | ----------------------------------- |
| **Fuzzy Jaccard**      | Matching noms partis | `pattern-jaccard-title-matching.md` |
| **ETL Script**         | Structure CLI        | `import-external-colors.ts`         |
| **Upsert**             | Idempotence DB       | Pattern Drizzle standard            |
| **Heuristic Fallback** | Valeurs par défaut   | ADR-004                             |
| **Pure Functions**     | Testabilité          | Standard projet                     |
