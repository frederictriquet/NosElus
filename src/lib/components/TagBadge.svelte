<script lang="ts">
	/**
	 * Composant réutilisable pour afficher un tag de loi avec sa couleur.
	 *
	 * Peut être utilisé de deux manières :
	 * 1. Avec un objet tag complet (recommandé) : <TagBadge {tag} />
	 * 2. Avec des propriétés séparées : <TagBadge name="Économie" color="#3b82f6" />
	 */

	export interface TagData {
		slug: string;
		name: string;
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
