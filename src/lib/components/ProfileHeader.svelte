<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getProxiedPhotoUrl } from '$lib/utils/photo';
	import GroupName from './GroupName.svelte';

	interface Props {
		name: string;
		civility?: string | null;
		photoUrl?: string | null;
		/** Type d'élu pour afficher le sous-titre */
		type?: 'depute' | 'senateur' | 'eurodepute';
		/** Groupe politique */
		group?: {
			id?: string | null;
			name?: string | null;
			shortName?: string | null;
			color?: string | null;
		} | null;
		/** Profession */
		profession?: string | null;
		/** Circonscription */
		constituency?: string | null;
		/** Date de naissance */
		birthDate?: string | null;
		/** Lieu de naissance */
		birthPlace?: string | null;
		/** Période d'activité */
		timeline?: {
			firstVote: string | null;
			lastVote: string | null;
		} | null;
		/** Contenu additionnel */
		children?: Snippet;
	}

	let {
		name,
		civility = null,
		photoUrl = null,
		type = 'depute',
		group = null,
		profession = null,
		constituency = null,
		birthDate = null,
		birthPlace = null,
		timeline = null,
		children
	}: Props = $props();

	const placeholder = '/placeholder.svg';
	const proxiedPhoto = $derived(getProxiedPhotoUrl(photoUrl));
	const typeLabels = {
		depute: 'Député',
		senateur: 'Sénateur',
		eurodepute: 'Eurodéputé'
	};

	// Handle image load errors by falling back to placeholder
	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src !== placeholder) {
			img.src = placeholder;
		}
	}
</script>

<div class="profile-header">
	<img
		src={proxiedPhoto || placeholder}
		alt={name}
		class="profile-photo"
		width="120"
		height="120"
		decoding="async"
		onerror={handleImageError}
	/>
	<div class="profile-info">
		<h1>{civility ? `${civility} ` : ''}{name}</h1>
		{#if type !== 'depute'}
			<div class="profile-subtitle">{typeLabels[type]}</div>
		{/if}
		{#if group}
			<a
				href="/groupes/{group.id}"
				class="group-badge"
				style="background: {group.color || '#888'}20; border: 1px solid {group.color ||
					'#888'}; color: {group.color || '#888'};"
			>
				<span class="group-dot" style="background: {group.color || '#888'}"></span>
				<GroupName shortName={group.shortName} fullName={group.name} variant="stacked" />
			</a>
		{/if}
		<div class="profile-meta">
			{#if constituency}
				<span class="meta-item">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle
							cx="12"
							cy="10"
							r="3"
						/></svg
					>
					{constituency}
				</span>
			{/if}
			{#if profession}
				<span class="meta-item">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path
							d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
						/></svg
					>
					{profession}
				</span>
			{/if}
			{#if birthDate}
				<span class="meta-item">
					Né(e) le {new Date(birthDate).toLocaleDateString('fr-FR')}
					{#if birthPlace}
						à {birthPlace}
					{/if}
				</span>
			{/if}
		</div>
		{#if timeline?.firstVote && timeline?.lastVote}
			<div class="activity-period">
				<span class="activity-label">Activité parlementaire :</span>
				<span class="activity-dates">
					{new Date(timeline.firstVote).toLocaleDateString('fr-FR', {
						month: 'short',
						year: 'numeric'
					})}
					→
					{new Date(timeline.lastVote).toLocaleDateString('fr-FR', {
						month: 'short',
						year: 'numeric'
					})}
				</span>
			</div>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.profile-header {
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.profile-photo {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-border);
		flex-shrink: 0;
	}

	.profile-info {
		flex: 1;
	}

	.profile-info h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0;
		line-height: 1.2;
	}

	.profile-subtitle {
		font-size: 1rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	.group-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: 20px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		margin: 0.5rem 0;
	}

	.group-badge:hover {
		text-decoration: none;
		opacity: 0.9;
	}

	.group-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.profile-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.meta-item :global(svg) {
		opacity: 0.7;
	}

	.activity-period {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}

	.activity-label {
		color: var(--color-text-muted);
	}

	.activity-dates {
		font-weight: 500;
		color: var(--color-text);
	}

	@media (max-width: 640px) {
		.profile-header {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.profile-meta {
			justify-content: center;
		}
	}
</style>
