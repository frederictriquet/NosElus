# Pattern : Multi-Chamber Component Factorization

## Problème

Lors de l'ajout d'une nouvelle chambre parlementaire (ex: Parlement Européen après Assemblée Nationale), le code quiz était entièrement dupliqué (~1400 lignes), créant :

- **Dette technique** : Toute modification doit être répliquée
- **Bugs de synchronisation** : Risque de divergence entre chambres
- **Coût de maintenance** : 2x le code = 2x les bugs potentiels
- **Incohérence UX** : Comportements légèrement différents

## Contexte

Ce pattern s'applique quand :

- ✅ Plusieurs entités partagent une logique métier identique
- ✅ Seules les **données** et **paramètres** diffèrent
- ✅ L'interface utilisateur est similaire à 95%+
- ✅ Le workflow est identique

**Exemples d'application** :

- Multi-chambres parlementaires (AN, Sénat, PE)
- Multi-plateformes (web, mobile, desktop)
- Multi-environnements (prod, staging, dev)

## Solution

### Principe : Configuration-Driven Architecture

**Au lieu de dupliquer le code, extraire les composants et les paramétrer via une config.**

### Étapes de factorisation

1. **Identifier les invariants** (logique identique)
2. **Identifier les variants** (ce qui diffère)
3. **Créer une interface de configuration** pour les variants
4. **Extraire les composants** partagés
5. **Créer des wrappers légers** par chambre

### Structure

```
src/lib/
├── components/
│   ├── QuizPage.svelte         # Composant partagé (invariant)
│   └── QuizResults.svelte      # Composant partagé (invariant)
│
├── quiz/
│   └── config.ts               # Configurations par chambre (variants)
│
└── server/quiz/
    └── load-quiz-data.ts       # Helper serveur partagé (invariant)

src/routes/
├── an/quiz/
│   ├── +page.svelte            # Wrapper AN (~10 lignes)
│   └── +page.server.ts         # Wrapper AN (~5 lignes)
└── pe/quiz/
    ├── +page.svelte            # Wrapper PE (~10 lignes)
    └── +page.server.ts         # Wrapper PE (~5 lignes)
```

### Code

#### 1. Interface de configuration (variants)

```typescript
// src/lib/quiz/config.ts
export interface QuizChamberConfig {
	chamber: 'an' | 'pe'; // Identifiant chambre
	legislature: string; // '17' | 'PE-10'
	basePath: string; // '/an/quiz' | '/pe/quiz'
	resultsPath: string; // Routes
	lawBasePath: string; // Pour liens détails
	chamberLabel: string; // Libellés UI
	periodLabel: string;
	storageKey: string; // localStorage keys
	sessionKey: string;
}

export const AN_QUIZ_CONFIG: QuizChamberConfig = {
	chamber: 'an',
	legislature: '17',
	basePath: '/an/quiz',
	resultsPath: '/an/quiz/resultats',
	lawBasePath: '/an/laws',
	chamberLabel: "l'Assemblée nationale",
	periodLabel: 'législature 17',
	storageKey: 'noselus-quiz-votes',
	sessionKey: 'noselus-quiz-session'
};

export const PE_QUIZ_CONFIG: QuizChamberConfig = {
	chamber: 'pe',
	legislature: 'PE-10',
	basePath: '/pe/quiz',
	resultsPath: '/pe/quiz/resultats',
	lawBasePath: '/pe/scrutins',
	chamberLabel: 'le Parlement européen',
	periodLabel: 'terme 10',
	storageKey: 'noselus-quiz-pe-votes',
	sessionKey: 'noselus-quiz-pe-session'
};
```

#### 2. Composant partagé (invariant)

```svelte
<!-- src/lib/components/QuizPage.svelte -->
<script lang="ts">
	import type { QuizChamberConfig } from '$lib/quiz/config';
	import type { QuizLawData } from '$lib/server/quiz/load-quiz-data';

	let {
		config, // ← Configuration chambre injectée
		allLaws,
		availableTags
	}: {
		config: QuizChamberConfig;
		allLaws: QuizLawData[];
		availableTags: TagData[];
	} = $props();

	// Toute la logique utilise config.* pour s'adapter
	const quizStore = createQuizStore(config.storageKey, config.sessionKey);

	// Navigation utilise config.basePath, config.resultsPath
	// Labels UI utilisent config.chamberLabel, config.periodLabel
	// Etc.
</script>

<!-- UI identique, paramétrée par config -->
```

#### 3. Wrapper léger (par chambre)

```svelte
<!-- src/routes/pe/quiz/+page.svelte -->
<script lang="ts">
	import QuizPage from '$lib/components/QuizPage.svelte';
	import { PE_QUIZ_CONFIG } from '$lib/quiz/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<QuizPage config={PE_QUIZ_CONFIG} allLaws={data.allLaws} availableTags={data.availableTags} />
```

**Total : 10 lignes** au lieu de 700 lignes dupliquées.

#### 4. Helper serveur partagé

```typescript
// src/lib/server/quiz/load-quiz-data.ts
export async function loadQuizData(legislature: string) {
	// Logique générique utilisant le paramètre legislature
	const eligibleLaws = await db.select().from(laws).where(eq(laws.legislature, legislature)); // ← Paramètre
	// ...

	return { allLaws, availableTags };
}

// Appelé depuis les routes
// AN: loadQuizData('17')
// PE: loadQuizData('PE-10')
```

## Avantages

✅ **Zéro duplication** : -1400 lignes de code dupliqué éliminées  
✅ **Maintenance unique** : Un bug fixé = fixé partout  
✅ **Cohérence garantie** : Impossible d'avoir des comportements différents  
✅ **Ajout rapide** : Nouvelle chambre = 20 lignes (config + wrappers)  
✅ **Tests factorisés** : Tester le composant partagé = tester toutes les chambres  
✅ **Type-safety** : TypeScript force la complétude de la config

## Inconvénients

⚠️ **Complexité initiale** : Nécessite de bien identifier invariants/variants  
⚠️ **Over-engineering risk** : Si les chambres divergent, la factorisation devient fragile  
⚠️ **Inflexibilité** : Comportement spécifique à une chambre = complexité ajoutée

**Mitigation** : Prévoir des "escape hatches" dans la config (ex: `customBehavior?: Function`)

## Exemples d'utilisation

### Dans NosElus

| Fichier                                 | Rôle               | Lignes |
| --------------------------------------- | ------------------ | ------ |
| `src/lib/quiz/config.ts`                | Configs AN + PE    | 43     |
| `src/lib/components/QuizPage.svelte`    | Page quiz partagée | 675    |
| `src/lib/components/QuizResults.svelte` | Résultats partagés | 529    |
| `src/lib/server/quiz/load-quiz-data.ts` | Helper serveur     | 120    |
| `src/routes/an/quiz/+page.svelte`       | Wrapper AN         | 24     |
| `src/routes/pe/quiz/+page.svelte`       | Wrapper PE         | 24     |

**Impact** :

- Avant : 700 lignes dupliquées (AN) + 700 nouvelles lignes (PE) = 1400 lignes
- Après : 675 (partagé) + 24 (AN) + 24 (PE) = 723 lignes
- **Économie : -677 lignes (-48%)**

### Ajouter une nouvelle chambre (Sénat)

```typescript
// 1. Ajouter config (10 lignes)
export const SENAT_QUIZ_CONFIG: QuizChamberConfig = {
  chamber: 'senat',
  legislature: 'S2024',
  // ...
};

// 2. Créer wrapper route (10 lignes)
// src/routes/senat/quiz/+page.svelte
<QuizPage config={SENAT_QUIZ_CONFIG} {data} />

// 3. Load data (5 lignes)
// src/routes/senat/quiz/+page.server.ts
export const load = async () => loadQuizData('S2024');
```

**Total : 25 lignes pour une nouvelle chambre complète.**

## Checklist de factorisation

Avant de factoriser :

- [ ] Identifier au moins 2 implémentations similaires existantes ou à venir
- [ ] Lister tous les points de variation (ce qui diffère)
- [ ] Vérifier que 80%+ de la logique est identique
- [ ] S'assurer que les variants peuvent être paramétrés

Pendant la factorisation :

- [ ] Créer l'interface de config avec tous les variants
- [ ] Extraire le composant partagé
- [ ] Paramétrer avec des props (pas de hardcoding)
- [ ] Créer des wrappers légers pour chaque instance
- [ ] Tester que chaque instance fonctionne

Après la factorisation :

- [ ] Supprimer le code dupliqué
- [ ] Documenter la config et son usage
- [ ] Ajouter des tests sur le composant partagé

## Anti-patterns à éviter

❌ **Factorisation prématurée** : Attendre d'avoir au moins 2 implémentations avant de factoriser  
❌ **Config gigantesque** : Si >20 paramètres, revoir la factorisation  
❌ **Conditions partout** : `if (chamber === 'an') { ... }` = signe de mauvaise factorisation  
❌ **Wrapper trop épais** : Si le wrapper dépasse 50 lignes, logique mal placée

## Voir aussi

- `std-reusable-components.md` : Standards composants réutilisables
- `pattern-svelte-utils-extraction.md` : Extraction de utils Svelte
- [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection) : Principe similaire

## Références projet

- **Architecture** : `arch-2026-02-06-pe-quiz.md`
- **ADR** : `adr-2026-02-06-political-quiz.md`
- **Commit** : Refactoring multi-chambre (feature/pe-quiz)

## Date de capitalisation

2026-02-07
