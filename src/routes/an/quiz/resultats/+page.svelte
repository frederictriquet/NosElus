<script lang="ts">
	import QuizResults from '$lib/components/QuizResults.svelte';
	import { AN_QUIZ_CONFIG } from '$lib/quiz/config';
</script>

<svelte:head>
	<title>Vos Résultats - Quiz Politique - NosÉlus</title>
	<meta
		name="description"
		content="Découvrez votre alignement politique avec les groupes parlementaires"
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Vos Résultats</h1>
	<p class="page-subtitle">
		Voici votre alignement avec les groupes parlementaires de {AN_QUIZ_CONFIG.chamberLabel}
	</p>
</div>

<QuizResults config={AN_QUIZ_CONFIG} />
