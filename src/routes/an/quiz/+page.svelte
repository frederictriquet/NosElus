<script lang="ts">
	import QuizPage from '$lib/components/QuizPage.svelte';
	import { AN_QUIZ_CONFIG } from '$lib/quiz/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Quiz Politique - NosÉlus</title>
	<meta
		name="description"
		content="Découvrez votre alignement politique en votant sur de vraies lois de l'Assemblée nationale"
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Quiz Politique</h1>
	<p class="page-subtitle">
		Découvrez votre alignement avec les groupes parlementaires de {AN_QUIZ_CONFIG.chamberLabel}
	</p>
</div>

<QuizPage config={AN_QUIZ_CONFIG} allLaws={data.allLaws} availableTags={data.availableTags} />
