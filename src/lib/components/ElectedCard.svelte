<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getProxiedPhotoUrl } from '$lib/utils/photo';

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
		depute: 'deputes',
		senateur: 'senateurs',
		eurodepute: 'eurodeputes'
	};
	const href = hrefProp || `/${typeRoutes[type]}/${id}`;
	const placeholder = '/placeholder.svg';
	const proxiedPhoto = getProxiedPhotoUrl(photoUrl);

	// Handle image load errors by falling back to placeholder
	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src !== placeholder) {
			img.src = placeholder;
		}
	}
</script>

{#if variant === 'thumbnail'}
	<a {href} class="elected-thumbnail" style={group?.color ? `border-color: ${group.color}` : ''} title="{name}{group?.shortName ? ` (${group.shortName})` : ''}">
		<img src={proxiedPhoto || placeholder} alt={name} width="32" height="32" loading="lazy" decoding="async" onerror={handleImageError} />
	</a>
{:else if variant === 'inline'}
	<a {href} class="elected-inline">
		{#if rank !== undefined}
			<span class="elected-rank">{rank}</span>
		{/if}
		{#if group?.color}
			<span class="group-dot" style="background: {group.color}"></span>
		{/if}
		<img src={proxiedPhoto || placeholder} alt={name} class="elected-photo-sm" width="32" height="32" loading="lazy" decoding="async" onerror={handleImageError} />
		<span class="elected-name">{name}</span>
		{#if group?.shortName}
			<span class="elected-group-tag group-name-hover">
				<span class="group-short">{group.shortName}</span>
				{#if group.name && group.name !== group.shortName}
					<span class="group-full">{group.name}</span>
				{/if}
			</span>
		{/if}
		{#if stat}
			<span class="elected-stat">{stat}</span>
		{/if}
	</a>
{:else if variant === 'compact'}
	<a {href} class="elected-compact">
		{#if group?.color}
			<span class="group-dot" style="background: {group.color}"></span>
		{/if}
		<img src={proxiedPhoto || placeholder} alt={name} class="elected-photo-sm" width="32" height="32" loading="lazy" decoding="async" onerror={handleImageError} />
		<div class="elected-compact-info">
			<span class="elected-name">{name}</span>
			{#if group?.shortName}
				<span class="elected-group-inline group-name-hover">
					<span class="group-short">{group.shortName}</span>
					{#if group.name && group.name !== group.shortName}
						<span class="group-full">{group.name}</span>
					{/if}
				</span>
			{/if}
		</div>
	</a>
{:else}
	<a {href} class="elected-card">
		<img src={proxiedPhoto || placeholder} alt={name} class="elected-photo" width="60" height="60" loading="lazy" decoding="async" onerror={handleImageError} />
		<div class="elected-info">
			<div class="elected-name">{name}</div>
			{#if group}
				<div class="elected-group">
					<span class="group-dot" style="background: {group.color || '#888'}"></span>
					<span class="group-name-hover">
						<span class="group-short">{group.shortName || group.name}</span>
						{#if group.name && group.shortName && group.name !== group.shortName}
							<span class="group-full">{group.name}</span>
						{/if}
					</span>
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

	/* Animation commune nom court → nom complet au hover */
	.group-name-hover {
		display: block;
		position: relative;
		cursor: default;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		container-type: inline-size;
	}

	.group-name-hover .group-short,
	.group-name-hover .group-full {
		white-space: nowrap;
		display: block;
	}

	.group-name-hover .group-full {
		position: absolute;
		left: 0;
		top: 0;
		opacity: 0;
		pointer-events: none;
	}

	.group-name-hover:hover .group-short {
		opacity: 0;
	}

	.group-name-hover:hover .group-full {
		opacity: 1;
		pointer-events: auto;
		animation: scroll-text 3s linear infinite;
	}

	@keyframes scroll-text {
		0%, 10% {
			transform: translateX(0);
		}
		45%, 55% {
			/* Scroll: -100% du texte + 100% du conteneur (100cqi) */
			transform: translateX(min(0px, calc(-100% + 100cqi)));
		}
		90%, 100% {
			transform: translateX(0);
		}
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

	.elected-group-inline {
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
