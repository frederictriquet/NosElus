<svelte:head>
	<title>FAQ - NosElus</title>
	<meta
		name="description"
		content="Questions fréquemment posées sur NosElus, les données parlementaires et le fonctionnement des votes."
	/>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Questions fréquentes</h1>
	<p class="page-subtitle">Comprendre les données parlementaires et le fonctionnement de NosElus</p>
</div>

<div class="faq-content">
	<details class="faq-item">
		<summary
			>Pourquoi un texte apparaît-il comme « rejeté » alors que tous les votes sont « pour » ?</summary
		>
		<div class="faq-answer">
			<p>
				Cela se produit notamment lors des <strong>motions de censure</strong> (article 49 de la
				Constitution). Pour ces votes, seuls les députés <em>favorables</em> à la motion se manifestent
				en votant « pour ». Les députés opposés à la motion ne votent tout simplement pas : ils ne sont
				enregistrés ni comme « contre », ni comme « abstention ».
			</p>
			<p>
				Pour qu'une motion de censure soit adoptée, il faut réunir la
				<strong>majorité absolue des membres de l'Assemblée</strong>, soit 289 voix sur 577. Si le
				nombre de votes « pour » n'atteint pas ce seuil, la motion est rejetée, même en l'absence de
				votes « contre ».
			</p>
			<p>
				C'est un mécanisme constitutionnel volontaire : ne pas voter équivaut à s'opposer à la
				motion. Les données affichées sur NosElus reflètent fidèlement celles publiées par
				l'Assemblée nationale.
			</p>
		</div>
	</details>

	<details class="faq-item">
		<summary>D'où proviennent les données ?</summary>
		<div class="faq-answer">
			<p>
				Toutes les données affichées sur NosElus proviennent exclusivement de
				<strong>sources ouvertes et publiques</strong> :
			</p>
			<ul>
				<li>
					<a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer"
						>Open Data Assemblée nationale</a
					>
				</li>
				<li>
					<a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer"
						>Open Data Sénat</a
					>
				</li>
				<li>
					<a href="https://data.europarl.europa.eu" target="_blank" rel="noopener noreferrer"
						>Open Data Parlement européen</a
					>
				</li>
			</ul>
			<p>
				Pour plus de détails, consultez la page <a href="/sources">Sources de données</a>.
			</p>
		</div>
	</details>

	<details class="faq-item">
		<summary>À quelle fréquence les données sont-elles mises à jour ?</summary>
		<div class="faq-answer">
			<p>
				Les données sont mises à jour régulièrement à partir des flux officiels. Un délai peut
				exister entre la publication par les institutions et leur intégration sur NosElus.
			</p>
		</div>
	</details>

	<details class="faq-item">
		<summary>Que signifient les différentes positions de vote ?</summary>
		<div class="faq-answer">
			<ul>
				<li><strong>Pour</strong> : le député a voté en faveur du texte.</li>
				<li><strong>Contre</strong> : le député a voté contre le texte.</li>
				<li>
					<strong>Abstention</strong> : le député a participé au vote mais s'est abstenu de se prononcer
					pour ou contre.
				</li>
				<li>
					<strong>Non-votant</strong> : le député était présent mais n'a pas pris part au vote. C'est
					notamment le cas du président de séance, qui ne vote que pour départager en cas d'égalité.
				</li>
			</ul>
		</div>
	</details>

	<details class="faq-item">
		<summary>Comment un texte est-il adopté ou rejeté ?</summary>
		<div class="faq-answer">
			<p>
				En règle générale, un texte est adopté s'il recueille plus de votes « pour » que de votes «
				contre » parmi les suffrages exprimés (les abstentions ne comptent pas). C'est la
				<strong>majorité simple</strong>.
			</p>
			<p>
				Certains votes requièrent cependant une <strong>majorité qualifiée</strong> : majorité absolue
				des membres (289 sur 577 à l'Assemblée) ou majorité des trois cinquièmes du Congrès. Dans ces
				cas, un texte peut être rejeté même si tous les votants ont voté « pour », faute d'avoir atteint
				le seuil requis.
			</p>
		</div>
	</details>

	<details class="faq-item">
		<summary>Je constate une erreur, comment la signaler ?</summary>
		<div class="faq-answer">
			<p>
				Si vous repérez une erreur ou une incohérence, vous pouvez
				<a
					href="https://github.com/frederictriquet/NosElus/issues"
					target="_blank"
					rel="noopener noreferrer">ouvrir un ticket sur GitHub</a
				>
				ou contacter l'éditeur via la page <a href="/mentions-legales">Mentions légales</a>.
			</p>
		</div>
	</details>
</div>

<style>
	.faq-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 800px;
	}

	.faq-item {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.faq-item summary {
		padding: 1rem 1.25rem;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item summary::before {
		content: '▶';
		font-size: 0.7rem;
		color: var(--color-text-muted);
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.faq-item[open] summary::before {
		transform: rotate(90deg);
	}

	.faq-item summary:hover {
		color: var(--color-primary);
	}

	.faq-answer {
		padding: 0 1.25rem 1.25rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.faq-answer p {
		margin: 0 0 0.75rem;
	}

	.faq-answer p:last-child {
		margin-bottom: 0;
	}

	.faq-answer ul {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.faq-answer li {
		margin-bottom: 0.5rem;
	}

	.faq-answer a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.faq-answer a:hover {
		text-decoration: underline;
	}
</style>
