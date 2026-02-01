<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getProxiedPhotoUrl } from '$lib/utils/photo';
	import GroupName from './GroupName.svelte';

	interface Props {
		id: string;
		name: string;
		photoUrl?: string | null;
		/** Type d'élu pour construire le lien (ignoré si href est fourni) */
		type?: 'depute' | 'senateur' | 'eurodepute';
		/** Lien personnalisé (prioritaire sur type) */
		href?: string;
		/** Variante d'affichage */
		variant?: 'full' | 'compact' | 'thumbnail' | 'inline';
		/** Groupe politique */
		group?: {
			id?: string | null;
			name?: string | null;
			shortName?: string | null;
			color?: string | null;
		} | null;
		/** Informations supplémentaires (profession, circonscription, etc.) */
		subtitle?: string;
		/** Contenu additionnel (slot) */
		children?: Snippet;
		/** Rang (pour les listes ordonnées) */
		rank?: number;
		/** Statistique à afficher (ex: "142 votes") */
		stat?: string;
	}

	let {
		id,
		name,
		photoUrl = null,
		type = 'depute',
		href: hrefProp,
		variant = 'full',
		group = null,
		subtitle = '',
		children,
		rank,
		stat
	}: Props = $props();

	const typeRoutes = {
		depute: '/an/deputes',
		senateur: '/senat/senateurs',
		eurodepute: '/pe/eurodeputes'
	};
	const href = hrefProp || `${typeRoutes[type]}/${id}`;
	const placeholder = '/placeholder.svg';

	// État pour la photo chargée - commence toujours par le placeholder
	let loadedSrc = $state(placeholder);

	// Charger la vraie photo en arrière-plan
	$effect(() => {
		const proxiedPhoto = getProxiedPhotoUrl(photoUrl);
		if (!proxiedPhoto) {
			loadedSrc = placeholder;
			return;
		}

		const img = new Image();
		img.onload = () => {
			loadedSrc = proxiedPhoto;
		};
		img.onerror = () => {
			loadedSrc = placeholder;
		};
		img.src = proxiedPhoto;
	});
</script>

{#if variant === 'thumbnail'}
	<a {href} class="elected-thumbnail" style={group?.color ? `border-color: ${group.color}` : ''} title="{name}{group?.shortName ? ` (${group.shortName})` : ''}">
		<img src={loadedSrc} alt={name} width="32" height="32" loading="lazy" decoding="async" />
	</a>
{:else if variant === 'inline'}
	<a {href} class="elected-inline">
		{#if rank !== undefined}
			<span class="elected-rank">{rank}</span>
		{/if}
		<span class="photo-ring" style={group?.color ? `--ring-color: ${group.color}` : ''}>
			<img src={loadedSrc} alt={name} class="elected-photo-sm" width="32" height="32" loading="lazy" decoding="async" />
		</span>
		<span class="elected-name">{name}</span>
		{#if group?.shortName}
			<span class="elected-group-tag">
				<GroupName shortName={group.shortName} fullName={group.name} />
			</span>
		{/if}
		{#if stat}
			<span class="elected-stat">{stat}</span>
		{/if}
	</a>
{:else if variant === 'compact'}
	<a {href} class="elected-compact">
		<span class="photo-ring" style={group?.color ? `--ring-color: ${group.color}` : ''}>
			<img src={loadedSrc} alt={name} class="elected-photo-sm" width="32" height="32" loading="lazy" decoding="async" />
		</span>
		<div class="elected-compact-info">
			<span class="elected-name">{name}</span>
			{#if group?.shortName}
				<GroupName shortName={group.shortName} fullName={group.name} class="elected-group-inline" />
			{/if}
		</div>
	</a>
{:else}
	<a {href} class="elected-card">
		<span class="photo-ring photo-ring-lg" style={group?.color ? `--ring-color: ${group.color}` : ''}>
			<img src={loadedSrc} alt={name} class="elected-photo" width="60" height="60" loading="lazy" decoding="async" />
		</span>
		<div class="elected-info">
			<div class="elected-name">{name}</div>
			{#if group}
				<div class="elected-group">
					<span class="group-dot" style="background: {group.color || '#888'}"></span>
					<GroupName shortName={group.shortName} fullName={group.name} />
				</div>
			{:else if subtitle}
				<div class="elected-subtitle">{subtitle}</div>
			{/if}
			{#if children}
				{@render children()}
			{/if}
		</div>
	</a>
{/if}

<style>
	/* Thumbnail - petite vignette ronde */
	.elected-thumbnail {
		display: block;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--color-surface);
		flex-shrink: 0;
	}

	.elected-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.elected-thumbnail:hover {
		border-color: var(--color-primary);
	}

	/* Inline - photo + nom sur une ligne */
	.elected-inline {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.elected-inline:hover {
		background: var(--color-bg);
		text-decoration: none;
	}

	.elected-rank {
		width: 20px;
		text-align: center;
		font-weight: 700;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.elected-stat {
		margin-left: auto;
		color: var(--color-primary);
		font-weight: 600;
		font-size: 0.875rem;
	}

	.elected-group-tag {
		font-size: 0.7rem;
		padding: 0.125rem 0.375rem;
		background: var(--color-bg);
		border-radius: 4px;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	/* Compact - photo + nom, petit format */
	.elected-compact {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: background 0.2s;
	}

	.elected-compact:hover {
		background: var(--color-bg);
		text-decoration: none;
	}

	.elected-compact-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.elected-compact-info :global(.elected-group-inline) {
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.elected-photo-sm {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-border);
		flex-shrink: 0;
	}

	/* Anneau coloré autour de la photo */
	.photo-ring {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		padding: 2px;
		background: var(--ring-color, transparent);
		flex-shrink: 0;
	}

	.photo-ring .elected-photo-sm {
		border: 2px solid var(--color-surface);
	}

	.photo-ring-lg {
		padding: 3px;
	}

	.photo-ring-lg .elected-photo {
		border: 3px solid var(--color-surface);
	}

	/* Full - carte complète */
	.elected-card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s;
	}

	.elected-card:hover {
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.elected-photo {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-border);
		flex-shrink: 0;
	}

	.elected-info {
		flex: 1;
		min-width: 0;
	}

	.elected-name {
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.elected-compact .elected-name {
		font-size: 0.875rem;
	}

	.elected-inline .elected-name {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.elected-subtitle {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.elected-group {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-top: 0.125rem;
	}

	.group-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
