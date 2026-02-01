<script lang="ts">
	interface GroupAlignmentData {
		alignmentRate: number;
		alignedVotes: number;
		totalVotes: number;
		dissidentVotes: number;
	}

	interface GroupData {
		groupId: string | null;
		groupName: string | null;
		groupShortName: string | null;
		groupColor: string | null;
	}

	let {
		alignment,
		group
	}: {
		alignment: GroupAlignmentData | null;
		group: GroupData | null;
	} = $props();

	const groupLabel = $derived(group?.groupShortName || group?.groupName || 'son groupe');
</script>

{#if alignment && group}
	<div class="group-alignment">
		<div class="alignment-bar">
			<div class="alignment-fill" style="width: {alignment.alignmentRate}%"></div>
		</div>
		<div class="alignment-text">
			<span class="alignment-rate">{alignment.alignmentRate}%</span>
			<span class="alignment-label">de votes alignés avec {groupLabel}</span>
		</div>
		<div class="alignment-detail">
			{alignment.alignedVotes} votes conformes, {alignment.dissidentVotes} votes dissidents sur {alignment.totalVotes}
		</div>
	</div>
{/if}

<style>
	.group-alignment {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.alignment-bar {
		height: 8px;
		background: var(--color-bg);
		border-radius: 4px;
		overflow: hidden;
	}

	.alignment-fill {
		height: 100%;
		background: var(--color-primary);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.alignment-text {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.alignment-rate {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.alignment-label {
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.alignment-detail {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}
</style>
