<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();
	let selectedDay = $state<string | null>(null);

	const MONTHS = [
		'Janvier',
		'Février',
		'Mars',
		'Avril',
		'Mai',
		'Juin',
		'Juillet',
		'Août',
		'Septembre',
		'Octobre',
		'Novembre',
		'Décembre'
	];
	const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

	// todayStr sans new Date('string') — bug UTC J-1
	const _now = new Date();
	const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

	type ScrutinRow = {
		id: string;
		number: number;
		legislature: string;
		title: string;
		titleSimple: string | null;
		date: string | Date;
		result: string | null;
		totalVoters: number;
		totalFor: number;
		totalAgainst: number;
		totalAbstention: number;
	};

	type CalendarDay = {
		date: string | null;
		label: number;
		current: boolean;
		hasScrutins: boolean;
		anCount: number;
		peCount: number;
	};

	function getChamber(legislature: string): 'an' | 'pe' {
		return legislature.startsWith('PE-') ? 'pe' : 'an';
	}

	function computeCalendarDays(
		year: number,
		month: number,
		scrutinsByDate: Record<string, ScrutinRow[]>
	): CalendarDay[] {
		const firstDayOfMonth = new Date(year, month - 1, 1);
		const lastDayOfMonth = new Date(year, month, 0);
		const daysInMonth = lastDayOfMonth.getDate();

		// Convertir en lundi = 0
		let startDow = firstDayOfMonth.getDay();
		startDow = startDow === 0 ? 6 : startDow - 1;

		const days: CalendarDay[] = [];

		// Padding mois précédent
		for (let i = startDow - 1; i >= 0; i--) {
			const d = new Date(year, month - 1, -i);
			days.push({
				date: null,
				label: d.getDate(),
				current: false,
				hasScrutins: false,
				anCount: 0,
				peCount: 0
			});
		}

		// Jours du mois courant
		for (let d = 1; d <= daysInMonth; d++) {
			const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			const rows = scrutinsByDate[dateStr] ?? [];
			const anCount = rows.filter((s) => getChamber(s.legislature) === 'an').length;
			const peCount = rows.filter((s) => getChamber(s.legislature) === 'pe').length;
			days.push({
				date: dateStr,
				label: d,
				current: true,
				hasScrutins: rows.length > 0,
				anCount,
				peCount
			});
		}

		// Padding fin de grille
		while (days.length % 7 !== 0) {
			const extra = days.length - daysInMonth - startDow + 1;
			days.push({
				date: null,
				label: extra,
				current: false,
				hasScrutins: false,
				anCount: 0,
				peCount: 0
			});
		}

		return days;
	}

	const calendarDays = $derived(
		computeCalendarDays(data.year, data.month, data.scrutinsByDate as Record<string, ScrutinRow[]>)
	);
	const selectedScrutins = $derived(
		selectedDay ? (data.scrutinsByDate[selectedDay] ?? []) : []
	) as ScrutinRow[];
	const selectedAN = $derived(
		selectedScrutins.filter((s) => getChamber((s as ScrutinRow).legislature) === 'an')
	);
	const selectedPE = $derived(
		selectedScrutins.filter((s) => getChamber((s as ScrutinRow).legislature) === 'pe')
	);

	function prevMonth() {
		let y = data.year,
			m = data.month - 1;
		if (m === 0) {
			y--;
			m = 12;
		}
		selectedDay = null;
		goto(`/calendrier?year=${y}&month=${m}`);
	}

	function nextMonth() {
		let y = data.year,
			m = data.month + 1;
		if (m === 13) {
			y++;
			m = 1;
		}
		selectedDay = null;
		goto(`/calendrier?year=${y}&month=${m}`);
	}

	function selectDay(day: CalendarDay) {
		if (!day.current || !day.hasScrutins || !day.date) return;
		selectedDay = selectedDay === day.date ? null : day.date;
	}

	function formatSelectedDate(dateStr: string): string {
		const [y, m, d] = dateStr.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		return date.toLocaleDateString('fr-FR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<div class="page-header">
	<h1 class="page-title">Calendrier</h1>
	<p class="page-subtitle">Scrutins par date — Assemblée nationale et Parlement européen</p>
</div>

<div class="card calendar-card">
	<div class="calendar-nav">
		<button class="btn btn-secondary" onclick={prevMonth}>←</button>
		<h2 class="calendar-month-title">{MONTHS[data.month - 1]} {data.year}</h2>
		<button class="btn btn-secondary" onclick={nextMonth}>→</button>
	</div>

	<div class="calendar-grid">
		{#each DAYS_SHORT as day}
			<div class="calendar-weekday">{day}</div>
		{/each}

		{#each calendarDays as day}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="calendar-day"
				class:other-month={!day.current}
				class:has-scrutins={day.hasScrutins}
				class:selected={day.date === selectedDay}
				class:today={day.date === todayStr}
				onclick={() => selectDay(day)}
				role={day.hasScrutins && day.current ? 'button' : undefined}
				tabindex={day.hasScrutins && day.current ? 0 : undefined}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') selectDay(day);
				}}
			>
				<span class="day-number">{day.label}</span>
				{#if day.current && (day.anCount > 0 || day.peCount > 0)}
					<div class="day-chambers">
						{#if day.anCount > 0}
							<span class="day-badge day-badge-an">{day.anCount} AN</span>
						{/if}
						{#if day.peCount > 0}
							<span class="day-badge day-badge-pe">{day.peCount} PE</span>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

{#if selectedDay && selectedScrutins.length > 0}
	<section class="selected-day-scrutins">
		<h2>Scrutins du {formatSelectedDate(selectedDay)}</h2>

		{#if selectedAN.length > 0}
			<div class="chamber-group">
				<h3 class="chamber-group-title chamber-group-an">Assemblée nationale</h3>
				<div class="scrutins-list">
					{#each selectedAN as s}
						{@const total = s.totalFor + s.totalAgainst + s.totalAbstention || 1}
						<a
							href="/an/scrutins/{s.id}"
							class="scrutin-card"
							class:adopted={s.result === 'adopté'}
							class:rejected={s.result === 'rejeté'}
						>
							<div class="scrutin-header">
								<span class="scrutin-number">n°{s.number}</span>
								<span
									class="scrutin-result"
									class:adopted={s.result === 'adopté'}
									class:rejected={s.result === 'rejeté'}>{s.result}</span
								>
							</div>
							<div class="scrutin-title">{s.titleSimple ?? s.title}</div>
							<div class="scrutin-meta">
								<span>{s.totalVoters} votants</span>
								<span>{s.totalFor} pour</span>
								<span>{s.totalAgainst} contre</span>
							</div>
							<div class="vote-bar">
								<div class="vote-bar-for" style="width: {(s.totalFor / total) * 100}%"></div>
								<div
									class="vote-bar-against"
									style="width: {(s.totalAgainst / total) * 100}%"
								></div>
								<div
									class="vote-bar-abstention"
									style="width: {(s.totalAbstention / total) * 100}%"
								></div>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		{#if selectedPE.length > 0}
			<div class="chamber-group">
				<h3 class="chamber-group-title chamber-group-pe">Parlement européen</h3>
				<div class="scrutins-list">
					{#each selectedPE as s}
						{@const total = s.totalFor + s.totalAgainst + s.totalAbstention || 1}
						<a
							href="/pe/scrutins/{s.id}"
							class="scrutin-card"
							class:adopted={s.result === 'adopté'}
							class:rejected={s.result === 'rejeté'}
						>
							<div class="scrutin-header">
								<span class="scrutin-number">n°{s.number}</span>
								<span
									class="scrutin-result"
									class:adopted={s.result === 'adopté'}
									class:rejected={s.result === 'rejeté'}>{s.result}</span
								>
							</div>
							<div class="scrutin-title">{s.titleSimple ?? s.title}</div>
							<div class="scrutin-meta">
								<span>{s.totalVoters} votants</span>
								<span>{s.totalFor} pour</span>
								<span>{s.totalAgainst} contre</span>
							</div>
							<div class="vote-bar">
								<div class="vote-bar-for" style="width: {(s.totalFor / total) * 100}%"></div>
								<div
									class="vote-bar-against"
									style="width: {(s.totalAgainst / total) * 100}%"
								></div>
								<div
									class="vote-bar-abstention"
									style="width: {(s.totalAbstention / total) * 100}%"
								></div>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	.calendar-card {
		margin-bottom: 2rem;
	}

	.calendar-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.calendar-month-title {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.015em;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		border-top: 1px solid var(--color-border);
		border-left: 1px solid var(--color-border);
	}

	.calendar-weekday {
		padding: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		border-right: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.calendar-day {
		min-height: 4rem;
		padding: 0.5rem;
		border-right: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		transition: background 0.15s;
	}

	.calendar-day.other-month {
		opacity: 0.35;
	}

	.calendar-day.has-scrutins {
		background: var(--color-primary-bg);
		cursor: pointer;
	}

	.calendar-day.has-scrutins:hover {
		background: rgba(37, 99, 235, 0.15);
	}

	.calendar-day.selected {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		background: var(--color-primary-bg);
	}

	.day-number {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1;
	}

	.calendar-day.today .day-number {
		color: var(--color-primary);
		font-weight: 800;
	}

	.calendar-day.has-scrutins .day-number {
		font-weight: 700;
	}

	.day-chambers {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.day-badge {
		font-size: 0.625rem;
		font-weight: 700;
		border-radius: 3px;
		padding: 0.0625rem 0.25rem;
		width: fit-content;
		line-height: 1.4;
		letter-spacing: 0.02em;
	}

	.day-badge-an {
		color: var(--color-primary);
		background: rgba(37, 99, 235, 0.12);
	}

	.day-badge-pe {
		color: var(--chamber-pe, #0369a1);
		background: rgba(3, 105, 161, 0.12);
	}

	.chamber-group {
		margin-top: 1.5rem;
	}

	.chamber-group-title {
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-bottom: 0.75rem;
		padding-bottom: 0.375rem;
		border-bottom: 2px solid currentColor;
	}

	.chamber-group-an {
		color: var(--color-primary);
	}

	.chamber-group-pe {
		color: var(--chamber-pe, #0369a1);
	}

	.selected-day-scrutins h2 {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		margin-bottom: 1rem;
		text-transform: capitalize;
	}

	.scrutins-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.scrutin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.scrutin-number {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	@media (max-width: 640px) {
		.calendar-day {
			min-height: 3rem;
			padding: 0.25rem;
		}

		.day-chambers {
			display: none;
		}

		.calendar-weekday {
			font-size: 0.6875rem;
			padding: 0.375rem 0.25rem;
		}
	}
</style>
