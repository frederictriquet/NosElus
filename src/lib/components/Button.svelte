<script lang="ts">
	interface Props {
		variant?: 'primary' | 'secondary';
		disabled?: boolean;
		onclick?: () => void;
		children: any;
	}

	let { variant = 'primary', disabled = false, onclick, children }: Props = $props();
</script>

<button class="btn btn-{variant}" {disabled} {onclick}>
	{@render children()}
</button>

<style>
	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.25rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #667eea;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #5568d3;
	}

	.btn-secondary {
		background: #e2e8f0;
		color: #334155;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #cbd5e1;
	}
</style>
