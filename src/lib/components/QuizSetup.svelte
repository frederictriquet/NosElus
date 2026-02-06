<!--
  QuizSetup - Interface de configuration du quiz politique

  Composant de configuration permettant à l'utilisateur de personnaliser son quiz
  en sélectionnant les thèmes d'intérêt et le nombre de questions.

  **Fonctionnalités** :
  - Sélection/désélection de thèmes (tags) avec filtrage en temps réel
  - Bouton "Tout cocher / Tout décocher" pour rapidité
  - Choix de la taille du quiz parmi [5, 10, 15, 20] questions
  - Compteur de lois disponibles selon les tags sélectionnés
  - Auto-ajustement de la taille si le nombre de lois diminue
  - Bouton "Commencer" désactivé si aucun tag sélectionné

  **Comportement** :
  - Tous les tags sont cochés par défaut
  - Les boutons de taille sont dynamiquement activés/désactivés selon les lois disponibles
  - Le calcul de filtrage et stratification est délégué au parent via `onStart`
  - Utilise le système de couleurs `color-mix()` cohérent avec TagBadge

  @component
  @example
  ```svelte
  <script>
    import QuizSetup from '$lib/components/QuizSetup.svelte';
    import { selectQuizLaws } from '$lib/utils/quiz-selection';

    let availableTags = [
      { slug: 'economie', name: 'Économie', color: '#3b82f6', lawCount: 15 },
      { slug: 'sante', name: 'Santé', color: '#10b981', lawCount: 8 }
    ];
    let allLaws = [...]; // Toutes les lois éligibles

    function handleStart(selectedTags, quizSize) {
      const { quizLaws, reserveLaws } = selectQuizLaws(allLaws, selectedTags, quizSize);
      // Initialiser le quiz...
    }
  </script>

  <QuizSetup
    {availableTags}
    {allLaws}
    onStart={handleStart}
  />
  ```

  @see {@link quiz-selection.ts} Logique de sélection et stratification
  @see {@link TagBadge.svelte} Composant similaire pour l'affichage des tags
-->

<script lang="ts">
	import type { QuizLaw } from '$lib/stores/quiz';
	import { getAvailableQuizSizes } from '$lib/utils/quiz-selection';

	/**
	 * Tag disponible avec compteur de lois associées
	 *
	 * @interface AvailableTag
	 */
	interface AvailableTag {
		/** Slug du tag (identifiant unique, ex: "economie") */
		slug: string;
		/** Nom affiché (ex: "Économie") */
		name: string;
		/** Couleur hexadécimale (ex: "#3b82f6") ou null pour couleur par défaut */
		color: string | null;
		/** Nombre de lois associées à ce tag */
		lawCount: number;
	}

	/**
	 * Props du composant QuizSetup
	 *
	 * @interface Props
	 */
	interface Props {
		/** Liste des tags disponibles avec leurs compteurs de lois */
		availableTags: AvailableTag[];
		/** Liste complète des lois éligibles pour le quiz */
		allLaws: QuizLaw[];
		/** Callback appelé quand l'utilisateur clique "Commencer le quiz" */
		onStart: (selectedTagSlugs: Set<string>, quizSize: number) => void;
	}

	let { availableTags, allLaws, onStart }: Props = $props();

	// État : tous les tags cochés par défaut
	let selectedSlugs = $state<Set<string>>(new Set(availableTags.map((t) => t.slug)));
	let quizSize = $state(10);

	// Nombre de lois disponibles selon les tags sélectionnés
	const filteredLawCount = $derived(
		allLaws.filter((law) => law.tags.some((t) => selectedSlugs.has(t.slug))).length
	);

	// Tailles de quiz disponibles
	const availableSizes = $derived(getAvailableQuizSizes(filteredLawCount));

	// Auto-ajuster la taille si elle dépasse le nombre de lois
	$effect(() => {
		if (availableSizes.length > 0 && !availableSizes.includes(quizSize)) {
			quizSize = availableSizes[availableSizes.length - 1];
		}
	});

	const allSelected = $derived(selectedSlugs.size === availableTags.length);

	function toggleTag(slug: string) {
		const next = new Set(selectedSlugs);
		if (next.has(slug)) {
			next.delete(slug);
		} else {
			next.add(slug);
		}
		selectedSlugs = next;
	}

	function toggleAll() {
		if (allSelected) {
			selectedSlugs = new Set();
		} else {
			selectedSlugs = new Set(availableTags.map((t) => t.slug));
		}
	}

	function handleStart() {
		onStart(selectedSlugs, quizSize);
	}
</script>

<div class="setup-container">
	<div class="setup-card">
		<h2 class="setup-title">Configurer votre quiz</h2>
		<p class="setup-description">
			Choisissez les thèmes qui vous intéressent et le nombre de questions. Vos réponses seront
			comparées aux votes des groupes parlementaires.
		</p>

		<!-- Sélection des thèmes -->
		<div class="section">
			<div class="section-header">
				<h3 class="section-title">Thèmes</h3>
				<button class="toggle-all-btn" onclick={toggleAll} type="button">
					{allSelected ? 'Tout décocher' : 'Tout cocher'}
				</button>
			</div>

			<div class="tags-grid">
				{#each availableTags as tag}
					{@const isSelected = selectedSlugs.has(tag.slug)}
					{@const tagColor = tag.color ?? '#6b7280'}
					<button
						class="tag-checkbox"
						class:selected={isSelected}
						style="--tag-color: {tagColor}"
						onclick={() => toggleTag(tag.slug)}
						type="button"
					>
						<span class="tag-check">{isSelected ? '✓' : ''}</span>
						<span class="tag-name">{tag.name}</span>
						<span class="tag-count">{tag.lawCount}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Sélection de la taille -->
		<div class="section">
			<h3 class="section-title">Nombre de questions</h3>
			<div class="size-buttons">
				{#each availableSizes as size}
					<button
						class="size-btn"
						class:selected={quizSize === size}
						onclick={() => (quizSize = size)}
						type="button"
					>
						{size}
					</button>
				{/each}
			</div>
		</div>

		<!-- Compteur et bouton de démarrage -->
		<div class="start-section">
			<p class="law-count">
				{#if selectedSlugs.size === 0}
					Sélectionnez au moins un thème
				{:else}
					{filteredLawCount} loi{filteredLawCount > 1 ? 's' : ''} disponible{filteredLawCount > 1
						? 's'
						: ''} pour les thèmes sélectionnés
				{/if}
			</p>
			<button
				class="start-btn"
				disabled={selectedSlugs.size === 0 || filteredLawCount === 0}
				onclick={handleStart}
				type="button"
			>
				Commencer le quiz
			</button>
		</div>
	</div>
</div>

<style>
	.setup-container {
		max-width: 800px;
		margin: 0 auto;
	}

	.setup-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 2rem;
		box-shadow: var(--shadow);
	}

	.setup-title {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
	}

	.setup-description {
		margin: 0 0 1.5rem 0;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.section {
		margin-bottom: 1.5rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-text);
	}

	.section-title:not(.section-header .section-title) {
		margin-bottom: 0.75rem;
	}

	.toggle-all-btn {
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.toggle-all-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	/* Grille de tags */
	.tags-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag-checkbox {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1.5px solid color-mix(in srgb, var(--tag-color) 40%, transparent);
		border-radius: 9999px;
		background: color-mix(in srgb, var(--tag-color) 8%, transparent);
		color: var(--color-text);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s;
		user-select: none;
	}

	.tag-checkbox:hover {
		border-color: color-mix(in srgb, var(--tag-color) 60%, transparent);
		background: color-mix(in srgb, var(--tag-color) 15%, transparent);
	}

	.tag-checkbox.selected {
		border-color: var(--tag-color);
		background: color-mix(in srgb, var(--tag-color) 15%, transparent);
	}

	.tag-check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 3px;
		border: 1.5px solid color-mix(in srgb, var(--tag-color) 50%, transparent);
		font-size: 0.625rem;
		font-weight: 700;
		color: white;
		transition: all 0.15s;
	}

	.tag-checkbox.selected .tag-check {
		background: var(--tag-color);
		border-color: var(--tag-color);
	}

	.tag-name {
		font-weight: 500;
	}

	.tag-count {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		background: var(--color-bg);
		padding: 0.0625rem 0.375rem;
		border-radius: 9999px;
	}

	/* Boutons de taille */
	.size-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.size-btn {
		min-width: 3rem;
		padding: 0.5rem 1rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.size-btn:hover {
		border-color: var(--color-primary);
		transform: translateY(-1px);
	}

	.size-btn.selected {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	/* Section de démarrage */
	.start-section {
		text-align: center;
		padding-top: 0.5rem;
	}

	.law-count {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.start-btn {
		padding: 0.75rem 2rem;
		background: var(--color-primary);
		border: 2px solid var(--color-primary);
		border-radius: var(--radius);
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.start-btn:hover:not(:disabled) {
		background: var(--color-primary-dark);
		transform: translateY(-2px);
	}

	.start-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Dark mode */
	:global(.dark) .tag-checkbox {
		background: color-mix(in srgb, var(--tag-color) 12%, transparent);
	}

	:global(.dark) .tag-checkbox.selected {
		background: color-mix(in srgb, var(--tag-color) 20%, transparent);
	}

	@media (max-width: 640px) {
		.setup-card {
			padding: 1.25rem;
		}

		.size-buttons {
			flex-wrap: wrap;
		}

		.size-btn {
			flex: 1;
			min-width: 2.5rem;
		}
	}
</style>
