<!--
  TagBadge - Badge de tag coloré pour catégoriser les lois

  Affiche un tag (ex: "Économie", "Santé") avec la couleur définie dans la table `tags`.
  Utilise `color-mix()` pour générer automatiquement le background et la bordure.

  **Mode 1 (recommandé)** : Objet tag complet depuis la DB
  **Mode 2** : Props name/color séparées (utile pour des tags custom)

  @component
  @example
  ```svelte
  <script>
    import TagBadge from '$lib/components/TagBadge.svelte';
    const tag = { slug: 'economie', name: 'Économie', color: '#3b82f6' };
  </script>

  <!-- Mode 1: avec objet tag -->
  <TagBadge {tag} />

  <!-- Mode 2: avec props séparées -->
  <TagBadge name="Économie" color="#3b82f6" />
  ```

  @see {@link src/lib/server/db/schema/tags.ts} - Table de référence des tags
-->
<script lang="ts">
	/**
	 * Interface représentant un tag de loi avec sa couleur depuis la DB.
	 */
	export interface TagData {
		/** Slug du tag (clé primaire, ex: "economie") */
		slug: string;
		/** Nom affiché (ex: "Économie") */
		name: string;
		/** Couleur hexadécimale (ex: "#3b82f6") ou null pour couleur par défaut */
		color: string | null;
	}

	interface Props {
		/** Objet tag complet (slug, name, color) */
		tag?: TagData;
		/** Nom du tag (si tag non fourni) */
		name?: string;
		/** Couleur du tag (si tag non fourni) */
		color?: string | null;
		/** Classes CSS additionnelles */
		class?: string;
	}

	let { tag, name, color = null, class: className = '' }: Props = $props();

	// Résolution des propriétés
	const tagName = $derived(tag?.name ?? name ?? 'Tag');
	const tagColor = $derived(tag?.color ?? color ?? '#6b7280');
</script>

<span class="tag-badge {className}" style="--tag-color: {tagColor}">
	{tagName}
</span>

<style>
	.tag-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.625rem;
		font-size: 0.75rem;
		font-weight: 500;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--tag-color) 15%, transparent);
		color: var(--tag-color);
		border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
		white-space: nowrap;
	}

	/* Dark mode adjustments */
	:global(.dark) .tag-badge {
		background: color-mix(in srgb, var(--tag-color) 20%, transparent);
	}
</style>
