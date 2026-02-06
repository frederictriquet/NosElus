<script lang="ts">
	/**
	 * Podium affichant le top 3 des groupes les plus alignés.
	 * Design inspiré d'un podium olympique (2e-1er-3e).
	 */
	import type { AlignmentResult } from '$lib/utils/alignment';

	interface Props {
		results: AlignmentResult[]; // Doit contenir au moins 3 éléments triés
	}

	let { results }: Props = $props();

	// Extraire le podium (top 3) et réorganiser pour affichage visuel
	const first = $derived(results[0]);
	const second = $derived(results[1]);
	const third = $derived(results[2]);
</script>

{#if results.length >= 3}
	<div class="podium">
		<!-- 2ème place (gauche) -->
		<div class="podium-position second">
			<div class="medal">
				<span class="rank">2</span>
			</div>
			<div class="group-info">
				<div class="group-name">{second.groupShortName}</div>
				<div class="score">{second.score}%</div>
				<div class="details">
					{second.agreements}/{second.agreements + second.disagreements} accords
				</div>
			</div>
			<div class="platform platform-second">
				<span class="platform-label">2e</span>
			</div>
		</div>

		<!-- 1ère place (centre, plus haute) -->
		<div class="podium-position first">
			<div class="medal gold">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path
						d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
					/>
				</svg>
			</div>
			<div class="group-info">
				<div class="group-name">{first.groupShortName}</div>
				<div class="score">{first.score}%</div>
				<div class="details">
					{first.agreements}/{first.agreements + first.disagreements} accords
				</div>
			</div>
			<div class="platform platform-first">
				<span class="platform-label">1er</span>
			</div>
		</div>

		<!-- 3ème place (droite) -->
		<div class="podium-position third">
			<div class="medal">
				<span class="rank">3</span>
			</div>
			<div class="group-info">
				<div class="group-name">{third.groupShortName}</div>
				<div class="score">{third.score}%</div>
				<div class="details">
					{third.agreements}/{third.agreements + third.disagreements} accords
				</div>
			</div>
			<div class="platform platform-third">
				<span class="platform-label">3e</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.podium {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 1rem;
		padding: 2rem 1rem 0;
		min-height: 300px;
	}

	.podium-position {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		max-width: 200px;
	}

	.medal {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1rem;
		background: var(--color-border);
		color: white;
		font-weight: bold;
		font-size: 1.5rem;
		box-shadow: var(--shadow);
	}

	.medal.gold {
		background: linear-gradient(135deg, #ffd700, #ffed4e);
		color: #8b6914;
		font-size: 1.75rem;
	}

	.rank {
		font-size: 1.5rem;
	}

	.group-info {
		text-align: center;
		margin-bottom: 1rem;
		width: 100%;
	}

	.group-name {
		font-weight: 700;
		font-size: 1.125rem;
		margin-bottom: 0.5rem;
		color: var(--color-text);
	}

	.score {
		font-size: 2rem;
		font-weight: 800;
		color: var(--color-primary);
		margin-bottom: 0.25rem;
	}

	.details {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.platform {
		width: 100%;
		border-radius: var(--radius) var(--radius) 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		color: white;
		box-shadow: var(--shadow);
	}

	.platform-label {
		font-size: 1.25rem;
	}

	.platform-first {
		height: 150px;
		background: linear-gradient(135deg, #ffd700, #ffed4e);
		color: #8b6914;
	}

	.platform-second {
		height: 120px;
		background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
		color: #666;
	}

	.platform-third {
		height: 90px;
		background: linear-gradient(135deg, #cd7f32, #e8a87c);
		color: #5c3d1f;
	}

	/* Ordre visuel : 2 - 1 - 3 */
	.podium {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-areas: 'second first third';
	}

	.first {
		grid-area: first;
	}

	.second {
		grid-area: second;
	}

	.third {
		grid-area: third;
	}

	@media (max-width: 640px) {
		.podium {
			gap: 0.5rem;
			padding: 1rem 0.5rem 0;
			min-height: 250px;
		}

		.medal {
			width: 48px;
			height: 48px;
			font-size: 1.25rem;
		}

		.medal.gold {
			font-size: 1.5rem;
		}

		.group-name {
			font-size: 1rem;
		}

		.score {
			font-size: 1.5rem;
		}

		.details {
			font-size: 0.75rem;
		}

		.platform-first {
			height: 120px;
		}

		.platform-second {
			height: 100px;
		}

		.platform-third {
			height: 80px;
		}

		.platform-label {
			font-size: 1rem;
		}
	}
</style>
