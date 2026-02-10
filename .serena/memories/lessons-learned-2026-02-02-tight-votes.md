# Lessons Learned : Votes Serrés (Section 4.2)

## Date

2026-02-02

## Contexte

Implémentation de la feature "Votes serrés" - MVP Phase 1, identifiant les scrutins où chaque voix comptait (marge ≤ 10 voix).

## Succès du Workflow

### Workflow complet exécuté

Le cycle complet de skills a été suivi avec succès :

```
/analyze → /explore-options → /tech-choice → /roadmap-update → /architecture → /implement → /test-run → /code-review → /pre-merge
```

**Résultat** : 3 commits propres, 34 tests passants, 0 régression.

### Points positifs

1. **ADR documenté** : La décision technique (Margin Simple vs Banzhaf/Pivot Groups) est bien tracée
2. **Architecture pensée avant l'implémentation** : Les 3 créations et 9 modifications étaient planifiées
3. **Code review systématique** : 2 suggestions mineures identifiées (duplication, accessibilité)

## Bug Corrigé

### Variable undefined dans loader

**Fichier** : `src/routes/an/deputes/[id]/+page.server.ts`

**Problème** :

```typescript
// BROKEN - voteConditions n'existe pas dans ce scope
const whereClause = voteConditions.length > 0 ? and(...voteConditions) : undefined;
```

**Fix** :

```typescript
// CORRECT - construire la condition directement
const whereClause =
	legislature && legislature !== 'all' ? eq(scrutins.legislature, legislature) : undefined;
```

**Leçon** : Toujours vérifier que les variables utilisées dans les closures/loaders existent dans leur scope. Le TypeScript aurait dû attraper ça, mais le fichier n'était pas ouvert dans l'IDE pendant le développement.

## Patterns Réutilisables

### 1. Colonne pré-calculée avec index

Pour les filtres fréquents sur des calculs dérivés, pré-calculer la valeur :

```typescript
// Schema
margin: integer('margin').notNull().default(0),

// Index
index('scrutins_margin_idx').on(table.margin)

// Migration
UPDATE "scrutins" SET "margin" = ABS("total_for" - "total_against");
```

**Avantage** : Performance optimale, pas de calcul à chaque requête.

### 2. Helper générique avec whereClause optionnel

Pattern pour combiner filtres internes et externes :

```typescript
export async function getTightScrutins(
	threshold: TightVoteThreshold = DEFAULT_TIGHT_THRESHOLD,
	whereClause?: SQL, // Filtres externes (legislature, category)
	limit: number = 50,
	offset: number = 0
): Promise<TightScrutin[]> {
	const conditions = [sql`${scrutins.margin} <= ${threshold}`];
	if (whereClause) {
		conditions.push(whereClause);
	}
	// ...
}
```

### 3. Fonction client-side dupliquée du serveur

Quand une fonction utilitaire simple est nécessaire côté client ET serveur :

**Option A** (choisi) : Dupliquer la fonction dans le composant

- Simple, pas d'import cross-boundary
- Risque de désynchronisation

**Option B** (recommandé pour le futur) : Créer un module `$lib/utils/`

- Une seule source de vérité
- Import côté client sans problème

### 4. Validation whitelist pour les paramètres URL

```typescript
const TIGHT_VOTE_THRESHOLDS = [5, 10, 20] as const;
type TightVoteThreshold = (typeof TIGHT_VOTE_THRESHOLDS)[number];

const parsedThreshold = parseInt(thresholdParam, 10);
const threshold: TightVoteThreshold = TIGHT_VOTE_THRESHOLDS.includes(parsedThreshold)
	? parsedThreshold
	: DEFAULT_TIGHT_THRESHOLD;
```

## Test Manuel via curl

Quand WebFetch ne fonctionne pas pour localhost :

```bash
curl -s http://localhost:5173/an/scrutins/serres | grep -o '<title>[^<]*</title>'
curl -s http://localhost:5173/an/scrutins/VTANR5L17V1162 | grep -o 'tight-vote-badge[^>]*>[^<]*'
```

## Métriques

| Indicateur           | Valeur   |
| -------------------- | -------- |
| Commits              | 3        |
| Fichiers modifiés    | 18       |
| Lignes ajoutées      | +3 419   |
| Tests                | 34/34 ✅ |
| Blockers code review | 0        |
| Durée totale         | ~2h      |

## Améliorations Futures (Phase 2)

1. **Pivot Groups** : Calculer le "poids décisif" via Banzhaf/Shapley index
2. **Factoriser `getTightLabel`** : Créer `$lib/utils/tight-votes.ts`
3. **Accessibilité** : Ajouter `aria-label` aux boutons de pagination
4. **Tests dédiés** : Ajouter tests unitaires pour les nouveaux helpers

## Voir aussi

- `adr-2026-02-02-decisive-votes.md` - Décision technique complète
- `arch-2026-02-02-tight-votes.md` - Architecture technique
- `exploration-decisive-votes-2026-02-02.md` - Exploration des 5 options
