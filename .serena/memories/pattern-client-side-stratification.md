# Pattern : Stratification Côté Client pour Filtrage Temps Réel

## Problème

Lorsqu'un utilisateur doit filtrer/configurer une sélection complexe avant d'agir (quiz, import, création), la stratification côté serveur impose :

- Rechargement de page à chaque changement de filtre
- Latence réseau pour calculer les résultats filtrés
- Impossibilité d'avoir un compteur temps réel
- UX dégradée : pas de feedback immédiat

## Contexte

### Quand utiliser ce pattern

- [ ] Sélection avec filtres multiples (tags, catégories, critères)
- [ ] Nombre d'éléments < 500 (performance client acceptable)
- [ ] Besoin de feedback immédiat (compteur, validation)
- [ ] Actions dynamiques dépendantes du filtrage (boutons, tailles)

### Quand NE PAS utiliser

- [ ] Nombre d'éléments > 1000 (performance client dégradée)
- [ ] Calculs complexes nécessitant la base de données
- [ ] Filtres nécessitant des données non disponibles côté client
- [ ] Données sensibles ne devant pas être envoyées au client

## Solution

**Serveur** : Retourne toutes les données éligibles + métadonnées (compteurs, tags).

**Client** : Filtre, stratifie, et sélectionne en temps réel selon les critères de l'utilisateur.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        SERVEUR                          │
│  +page.server.ts                                        │
│                                                          │
│  1. Requête DB : toutes les lois éligibles             │
│     (≥1 scrutin, legislature 17, avec résumé)          │
│                                                          │
│  2. Requête DB : tous les tags avec compteurs          │
│     (nombre de lois par tag)                            │
│                                                          │
│  3. Enrichissement : association lois ↔ tags           │
│     (Map indexing pour O(n) perf)                      │
│                                                          │
│  4. Retour :                                            │
│     - allLaws: QuizLaw[]                               │
│     - availableTags: { slug, name, color, lawCount }[]  │
│                                                          │
│  ⚠️ PAS de stratification serveur                      │
└─────────────────────────────────────────────────────────┘
                         ↓
                    JSON payload
                         ↓
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│  +page.svelte + quiz-selection.ts                      │
│                                                          │
│  1. Utilisateur sélectionne tags                        │
│     → selectedTags: Set<string>                        │
│                                                          │
│  2. Filtrage temps réel ($derived)                      │
│     const filtered = allLaws.filter(law =>             │
│       law.tags.some(t => selectedTags.has(t.slug))     │
│     );                                                  │
│                                                          │
│  3. Compteur temps réel                                │
│     → "X lois disponibles"                             │
│                                                          │
│  4. Calcul tailles valides                             │
│     → Boutons [5] [10] [15] [20] dynamiques            │
│                                                          │
│  5. Stratification (au clic "Commencer")               │
│     → selectQuizLaws(allLaws, selectedTags, quizSize)  │
│     → Groupement par tag principal                     │
│     → Échantillonnage équitable                        │
│     → Shuffle Fisher-Yates                             │
│     → Split quiz/réserve                                │
└─────────────────────────────────────────────────────────┘
```

## Code

### Serveur : Retourner toutes les données

```typescript
// +page.server.ts
export const load: PageServerLoad = async () => {
  // 1. Récupérer toutes les lois éligibles
  const eligibleLaws = await db
    .select({
      id: laws.id,
      title: laws.title,
      // ... autres champs
    })
    .from(laws)
    .innerJoin(lawSummaries, eq(laws.id, lawSummaries.lawId))
    .innerJoin(scrutins, eq(laws.id, scrutins.lawId))
    .where(eq(laws.legislature, '17'))
    .groupBy(laws.id, ...)
    .having(sql`COUNT(DISTINCT ${scrutins.id}) >= 1`);

  // 2. Récupérer les tags
  const lawIds = eligibleLaws.map(l => l.id);
  const lawTagsData = await db
    .select({
      lawId: lawTags.lawId,
      slug: tags.slug,
      name: tags.name,
      color: tags.color
    })
    .from(lawTags)
    .innerJoin(tags, eq(lawTags.tagSlug, tags.slug))
    .where(inArray(lawTags.lawId, lawIds));

  // 3. Calculer compteurs par tag
  const tagCounts = new Map();
  for (const lt of lawTagsData) {
    const existing = tagCounts.get(lt.slug);
    if (existing) {
      existing.lawCount++;
    } else {
      tagCounts.set(lt.slug, {
        slug: lt.slug,
        name: lt.name,
        color: lt.color,
        lawCount: 1
      });
    }
  }
  const availableTags = Array.from(tagCounts.values())
    .sort((a, b) => b.lawCount - a.lawCount);

  // 4. Indexer tags par loi (O(n) au lieu de O(n*m))
  const tagsByLawId = new Map();
  for (const lt of lawTagsData) {
    if (!tagsByLawId.has(lt.lawId)) {
      tagsByLawId.set(lt.lawId, []);
    }
    tagsByLawId.get(lt.lawId)!.push({
      slug: lt.slug,
      name: lt.name,
      color: lt.color
    });
  }

  // 5. Enrichir lois avec tags
  const enrichWithTags = (lawList: typeof eligibleLaws) =>
    lawList.map((law) => ({
      ...law,
      tags: tagsByLawId.get(law.id) ?? []
    }));

  return {
    allLaws: enrichWithTags(eligibleLaws),
    availableTags
  };
};
```

### Client : Filtrage temps réel

```svelte
<!-- QuizSetup.svelte -->
<script lang="ts">
	import { getAvailableQuizSizes } from '$lib/utils/quiz-selection';

	interface Props {
		availableTags: AvailableTag[];
		allLaws: QuizLaw[];
		onStart: (selectedTagSlugs: Set<string>, quizSize: number) => void;
	}

	let { availableTags, allLaws, onStart }: Props = $props();

	// État : tous les tags cochés par défaut
	let selectedSlugs = $state<Set<string>>(new Set(availableTags.map((t) => t.slug)));
	let quizSize = $state(10);

	// Filtrage temps réel avec $derived (Svelte 5)
	const filteredLawCount = $derived(
		allLaws.filter((law) => law.tags.some((t) => selectedSlugs.has(t.slug))).length
	);

	// Tailles de quiz disponibles (dynamiques)
	const availableSizes = $derived(getAvailableQuizSizes(filteredLawCount));

	// Auto-ajuster la taille si elle dépasse le nombre de lois
	$effect(() => {
		if (availableSizes.length > 0 && !availableSizes.includes(quizSize)) {
			quizSize = availableSizes[availableSizes.length - 1];
		}
	});

	function toggleTag(slug: string) {
		const next = new Set(selectedSlugs);
		if (next.has(slug)) {
			next.delete(slug);
		} else {
			next.add(slug);
		}
		selectedSlugs = next;
	}

	function handleStart() {
		onStart(selectedSlugs, quizSize);
	}
</script>

<div class="tags-grid">
	{#each availableTags as tag}
		{@const isSelected = selectedSlugs.has(tag.slug)}
		<button class="tag-checkbox" class:selected={isSelected} onclick={() => toggleTag(tag.slug)}>
			<span class="tag-check">{isSelected ? '✓' : ''}</span>
			<span class="tag-name">{tag.name}</span>
			<span class="tag-count">{tag.lawCount}</span>
		</button>
	{/each}
</div>

<p class="law-count">
	{#if selectedSlugs.size === 0}
		Sélectionnez au moins un thème
	{:else}
		{filteredLawCount} loi{filteredLawCount > 1 ? 's' : ''} disponible{filteredLawCount > 1
			? 's'
			: ''}
	{/if}
</p>

<div class="size-buttons">
	{#each availableSizes as size}
		<button class="size-btn" class:selected={quizSize === size} onclick={() => (quizSize = size)}>
			{size}
		</button>
	{/each}
</div>

<button
	class="start-btn"
	disabled={selectedSlugs.size === 0 || filteredLawCount === 0}
	onclick={handleStart}
>
	Commencer le quiz
</button>
```

### Client : Stratification (au clic)

```typescript
// quiz-selection.ts
export function selectQuizLaws(
	allLaws: QuizLaw[],
	selectedTagSlugs: Set<string>,
	quizSize: number
): SelectionResult {
	// 1. Filtrer les lois qui ont au moins un tag sélectionné (logique OR)
	const filtered = allLaws.filter((law) => law.tags.some((t) => selectedTagSlugs.has(t.slug)));

	if (filtered.length === 0) {
		return { quizLaws: [], reserveLaws: [] };
	}

	// 2. Grouper par tag principal (premier tag parmi les sélectionnés)
	const lawsByTag = new Map<string, QuizLaw[]>();
	for (const law of filtered) {
		const primaryTag = law.tags.find((t) => selectedTagSlugs.has(t.slug));
		if (primaryTag) {
			const key = primaryTag.slug;
			if (!lawsByTag.has(key)) {
				lawsByTag.set(key, []);
			}
			lawsByTag.get(key)!.push(law);
		}
	}

	// 3. Stratifier : prendre équitablement de chaque tag
	const selectedLaws: QuizLaw[] = [];
	const tagGroups = Array.from(lawsByTag.values());
	const lawsPerTag = Math.ceil(quizSize / tagGroups.length);

	for (const tagLaws of tagGroups) {
		const shuffled = shuffle(tagLaws); // Fisher-Yates
		selectedLaws.push(...shuffled.slice(0, lawsPerTag));
	}

	// 4. Mélanger
	const allShuffled = shuffle(selectedLaws);

	// 5. Ajouter les lois non sélectionnées comme réserve
	const selectedIds = new Set(allShuffled.map((l) => l.id));
	const remaining = filtered.filter((l) => !selectedIds.has(l.id));
	const allOrdered = [...allShuffled, ...shuffle(remaining)];

	return {
		quizLaws: allOrdered.slice(0, quizSize),
		reserveLaws: allOrdered.slice(quizSize)
	};
}
```

## Avantages

### UX

- ✅ **Feedback immédiat** : compteur "X lois disponibles" se met à jour instantanément
- ✅ **Pas de latence** : pas de requête serveur à chaque changement
- ✅ **Validation en temps réel** : bouton "Commencer" désactivé si config invalide
- ✅ **Actions dynamiques** : boutons de taille activés/désactivés selon disponibilité

### Performance

- ✅ **Moins de charge serveur** : une seule requête au chargement
- ✅ **Pas de requêtes inutiles** : filtrage client sans réseau
- ✅ **Scalabilité** : pour < 500 items, client plus rapide que serveur

### Développement

- ✅ **Logique testable** : `selectQuizLaws()` est une pure function
- ✅ **Séparation des responsabilités** : serveur = données, client = UX
- ✅ **Réutilisable** : `quiz-selection.ts` peut être utilisé ailleurs

## Inconvénients

### Limites

- ❌ **Payload initial plus gros** : ~32 lois \* ~300 bytes = ~10 KB (acceptable)
- ❌ **Performance client** : Si > 1000 items, filtrage côté client devient lent
- ❌ **Calculs complexes impossibles** : Si stratification nécessite DB, doit rester serveur
- ❌ **Pas de cache serveur** : Chaque visite recharge toutes les lois

### Sécurité

- ⚠️ **Données exposées au client** : Toutes les lois éligibles sont envoyées
  - Acceptable si données publiques (cas NosÉlus)
  - Problématique si données sensibles → filtrer côté serveur

## Comparaison avec Stratification Serveur

| Critère             | Serveur                  | Client (ce pattern) |
| ------------------- | ------------------------ | ------------------- |
| Latence             | 200-500ms par changement | 0ms (instantané)    |
| Charge serveur      | Haute (N requêtes)       | Basse (1 requête)   |
| Payload initial     | 5 KB (lois filtrées)     | 10 KB (toutes lois) |
| Feedback temps réel | ❌ Non                   | ✅ Oui              |
| Compteur dynamique  | ❌ Non                   | ✅ Oui              |
| Scalabilité items   | ✅ Illimitée             | ⚠️ < 500 items      |
| Données sensibles   | ✅ OK                    | ❌ Exposées         |

## Exemples d'Utilisation

### Cas 1 : Quiz politique (NosÉlus)

**Fichiers** :

- `src/routes/an/quiz/+page.server.ts` - Serveur
- `src/lib/components/QuizSetup.svelte` - Client UI
- `src/lib/utils/quiz-selection.ts` - Client logique

**Données** : ~32 lois, 17 tags → 10 KB payload

**UX** : Compteur "X lois disponibles" + boutons [5] [10] [15] [20] dynamiques

### Cas 2 : Import de données avec filtres

**Contexte** : L'utilisateur importe un fichier CSV et peut filtrer les colonnes/lignes avant import.

**Architecture** :

- Serveur : Parse le CSV, retourne toutes les lignes + métadonnées (colonnes, types)
- Client : Filtrage colonnes + validation temps réel + aperçu dynamique

### Cas 3 : Création d'entité complexe

**Contexte** : Création d'un projet avec sélection d'équipe, tags, et templates.

**Architecture** :

- Serveur : Retourne tous les utilisateurs, tags, templates
- Client : Filtrage par rôle, équipe, disponibilité + compteur "X membres sélectionnés"

## Prévention des Pièges

### Piège 1 : Payload trop gros

**Symptôme** : Chargement initial lent (> 2s)

**Solution** :

- Paginer côté serveur si > 500 items
- Compresser la réponse (gzip)
- Charger en lazy loading si non critique

### Piège 2 : Filtrage complexe nécessitant DB

**Symptôme** : Impossible de calculer côté client (ex: full-text search, agrégations)

**Solution** : Hybrid approach

- Filtres simples → client
- Filtres complexes → requête serveur avec debounce (300ms)

### Piège 3 : Données sensibles exposées

**Symptôme** : Toutes les lois (même non sélectionnées) visibles dans DevTools

**Solution** :

- Filtrer côté serveur si données sensibles
- OU chiffrer les données non affichées côté client (rare)

## Tests

### Test unitaire : Filtrage client

```typescript
import { describe, it, expect } from 'vitest';
import { selectQuizLaws } from '../quiz-selection';

describe('selectQuizLaws', () => {
  it('should filter laws by selected tags', () => {
    const laws = [
      { id: 'L1', tags: [{ slug: 'economie', ... }], ... },
      { id: 'L2', tags: [{ slug: 'sante', ... }], ... },
      { id: 'L3', tags: [{ slug: 'economie', ... }], ... },
    ];
    const selectedTags = new Set(['economie']);

    const result = selectQuizLaws(laws, selectedTags, 10);

    expect(result.quizLaws).toHaveLength(2);
    expect(result.quizLaws.every(law =>
      law.tags.some(t => t.slug === 'economie')
    )).toBe(true);
  });
});
```

### Test de performance client

```typescript
it('should filter 1000 items in < 100ms', () => {
  const laws = Array.from({ length: 1000 }, (_, i) => ({
    id: `L${i}`,
    tags: [{ slug: i % 10 === 0 ? 'economie' : 'sante', ... }],
    ...
  }));

  const start = performance.now();
  const result = selectQuizLaws(laws, new Set(['economie']), 20);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100); // < 100ms
  expect(result.quizLaws).toHaveLength(20);
});
```

## Références

- ADR-006 : `adr-2026-02-06-political-quiz.md` (décision architecture)
- Lessons Learned : `lessons-learned-2026-02-06-quiz-config-page.md`
- Svelte 5 Runes : `$derived` pour réactivité fine
- Pattern : `pattern-fisher-yates-shuffle.md` (shuffle uniforme)

## Tags

- `architecture`
- `client-side`
- `filtering`
- `performance`
- `ux`
- `svelte-5`

## Voir Aussi

- `pattern-batch-loading-n-plus-one.md` - Problème N+1 côté serveur
- `database-queries-factorization.md` - Optimisation requêtes serveur
- `ui-best-practices.md` - Standards UI du projet
