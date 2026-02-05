<script lang="ts">
	/**
	 * Composant d'affichage de nom de groupe politique
	 *
	 * Affiche le nom court d'un groupe avec le nom complet en tooltip au survol,
	 * ou les deux empilés verticalement (variant 'stacked').
	 *
	 * @example
	 * ```svelte
	 * <!-- Affichage avec tooltip -->
	 * <GroupName shortName="RN" fullName="Rassemblement National" />
	 *
	 * <!-- Affichage empilé -->
	 * <GroupName shortName="LFI" fullName="La France Insoumise" variant="stacked" />
	 * ```
	 */

	interface Props {
		/** Nom court/abréviation du groupe (ex: "RN", "LFI") */
		shortName?: string | null;

		/** Nom complet du groupe (ex: "Rassemblement National") */
		fullName?: string | null;

		/**
		 * Mode d'affichage :
		 * - 'hover' : Nom court visible, nom complet en tooltip au survol
		 * - 'stacked' : Nom court et long empilés verticalement
		 * @default 'hover'
		 */
		variant?: 'hover' | 'stacked';

		/** Classes CSS additionnelles */
		class?: string;
	}

	let {
		shortName = null,
		fullName = null,
		variant = 'hover',
		class: className = ''
	}: Props = $props();

	// Détermine si on doit afficher la version complète
	const hasFullName = $derived(fullName && fullName !== shortName);

	// Ce qu'on affiche si pas de shortName
	const displayName = $derived(shortName || fullName || '');
</script>

{#if !hasFullName}
	<!-- Simple display - no tooltip needed -->
	<span class="group-name-simple {className}">{displayName}</span>
{:else if variant === 'stacked'}
	<!-- Stacked variant - both names visible vertically -->
	<span class="group-name-stacked {className}" aria-label={fullName}>
		<span class="group-short">{shortName}</span>
		<span class="group-full">{fullName}</span>
	</span>
{:else}
	<!-- Hover variant (default) - full name appears in tooltip -->
	<span class="group-name-hover {className}" aria-label={fullName}>
		<span class="group-short">{shortName}</span>
		<span class="tooltip">{fullName}</span>
	</span>
{/if}

<style>
	/* ===== SIMPLE VARIANT ===== */
	.group-name-simple {
		white-space: nowrap;
	}

	/* ===== HOVER VARIANT (with tooltip) ===== */
	.group-name-hover {
		display: inline-block;
		position: relative;
		cursor: default;
	}

	.group-name-hover .group-short {
		white-space: nowrap;
	}

	.group-name-hover .tooltip {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 8px);
		transform: translateX(-50%);
		padding: 0.5rem 0.75rem;
		background: var(--color-text);
		color: var(--color-bg);
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: var(--radius, 6px);
		white-space: nowrap;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.2s,
			visibility 0.2s;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		pointer-events: none;
	}

	/* Flèche du tooltip */
	.group-name-hover .tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: var(--color-text);
	}

	.group-name-hover:hover .tooltip {
		opacity: 1;
		visibility: visible;
	}

	/* ===== STACKED VARIANT ===== */
	.group-name-stacked {
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	.group-name-stacked .group-short {
		font-weight: 600;
	}

	.group-name-stacked .group-full {
		font-size: 0.75rem;
		font-weight: 400;
		opacity: 0.85;
	}
</style>
