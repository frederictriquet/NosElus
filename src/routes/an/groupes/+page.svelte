<script lang="ts">
	let { data } = $props();
</script>

<div class="page-header">
	<h1 class="page-title">Groupes parlementaires</h1>
	<p class="page-subtitle">{data.groups.length} groupes à l'Assemblée nationale</p>
</div>

<div class="card-grid">
	{#each data.groups as group}
		<a href="/an/groupes/{group.id}" class="group-card">
			<div class="group-color" style="background: {group.color || '#ccc'}"></div>
			<div class="group-info">
				<div class="group-name">{group.name}</div>
				<div class="group-meta">
					<span class="group-short">{group.shortName}</span>
					<span class="group-members"
						>{group.memberCount} membre{group.memberCount > 1 ? 's' : ''}</span
					>
				</div>
			</div>
		</a>
	{/each}
</div>

<style>
	.group-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s;
	}

	.group-card:hover {
		box-shadow: var(--shadow-md);
		text-decoration: none;
	}

	.group-color {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.group-info {
		flex: 1;
	}

	.group-name {
		font-weight: 600;
		font-size: 1.125rem;
	}

	.group-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.group-short {
		font-weight: 500;
	}

	.group-members {
		opacity: 0.8;
	}
</style>
