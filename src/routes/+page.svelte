<script>
	import 'leaflet/dist/leaflet.css';
	import Map from '$lib/components/Map.svelte';
	import walks from '$lib/data/walks.json';

	export const prerender = true;

	const days = [
		{ key: 'fri', label: 'Friday', date: 'May 1' },
		{ key: 'sat', label: 'Saturday', date: 'May 2' },
		{ key: 'sun', label: 'Sunday', date: 'May 3' }
	];
	let selectedDays = days.map((day) => day.key);

	const dayLookup = {
		'May 1': 'fri',
		'May 2': 'sat',
		'May 3': 'sun'
	};

	const dayColors = {
		fri: '#1c3c35',
		sat: '#c48b1d',
		sun: '#c4553d'
	};

	const normalizeDayKey = (value) => {
		if (!value) return '';
		const text = String(value).toLowerCase();

		if (text.includes('fri')) return 'fri';
		if (text.includes('sat')) return 'sat';
		if (text.includes('sun')) return 'sun';
		if (dayLookup[value]) return dayLookup[value];

		const match = text.match(/may\s*(\d{1,2})/i);
		if (match) {
			return dayLookup[`May ${Number(match[1])}`] ?? '';
		}

		return '';
	};

	const countByDay = (list) =>
		days.reduce((acc, day) => {
			acc[day.key] = list.filter(
				(walk) => normalizeDayKey(walk.day) === day.key && walk.lat && walk.lng
			).length;
			return acc;
		}, {});

	const coreThemes = [
		'Advocacy and Politics',
		'Architecture and Urban Planning',
		'Arts and Culture',
		'Environment and Sustainability',
		'Food and Drinks',
		'History and Places',
		'Lived experiences and personal perspectives',
		'People and Communities',
		'Transit and Accessibility'
	];

	const coreThemeSet = new Set(coreThemes.map((theme) => theme.toLowerCase()));

	const parseThemes = (value) => {
		if (!value) return [];
		return String(value)
			.split(/[,;/|]+/g)
			.map((theme) => theme.trim())
			.filter(Boolean);
	};

	const mapToCoreThemes = (value) => {
		const themes = parseThemes(value);
		const mapped = themes
			.map((theme) => {
				const lower = theme.toLowerCase();
				const match = coreThemes.find((core) => core.toLowerCase() === lower);
				return match ?? null;
			})
			.filter(Boolean);

		const unique = Array.from(new Set(mapped));
		return unique.length ? unique : ['Other'];
	};

	const timeToMinutes = (timeStr) => {
		if (!timeStr) return 0;
		const match = timeStr.match(/(\d+):?(\d*)\s*(am|pm)?/i);
		if (!match) return 0;
		let [_, hours, minutes, period] = match;
		hours = parseInt(hours, 10);
		minutes = parseInt(minutes || 0, 10);
		if (period && period.toLowerCase() === 'pm' && hours < 12) hours += 12;
		if (period && period.toLowerCase() === 'am' && hours === 12) hours = 0;
		return hours * 60 + minutes;
	};

	const formatDuration = (val) => {
		if (!val) return '';
		const str = String(val);
		const m = str.match(/(\d{1,2}):(\d{2})/);
		if (m) {
			return `${m[1]}:${m[2]}`;
		}
		return str;
	};

	const allThemes = [
		...coreThemes,
		...(walks.some((walk) => mapToCoreThemes(walk.themes).includes('Other')) ? ['Other'] : [])
	];

	let selectedThemes = [...allThemes];

	const selectAllThemes = () => { selectedThemes = [...allThemes]; };
	const clearAllThemes = () => { selectedThemes = []; };

	const toggleDay = (key) => {
		if (selectedDays.includes(key)) {
			selectedDays = selectedDays.filter((day) => day !== key);
		} else {
			selectedDays = [...selectedDays, key];
		}
	};

	const toggleTheme = (theme) => {
		if (selectedThemes.includes(theme)) {
			selectedThemes = selectedThemes.filter((value) => value !== theme);
		} else {
			selectedThemes = [...selectedThemes, theme];
		}
	};

	let selectedWalk = null;

	const openModal = (walk) => {
		selectedWalk = walk;
	};

	const closeModal = () => {
		selectedWalk = null;
	};

	$: dayCounts = countByDay(walks);
	$: selectedDayKeys = selectedDays;
	$: selectedThemeKeys = selectedThemes;
	$: filteredWalks = walks.filter((walk) => {
		if (selectedDays.length === 0) return false;
		const matchesDay = selectedDays.includes(normalizeDayKey(walk.day));
		const themeMatches = mapToCoreThemes(walk.themes);
		const matchesTheme = selectedThemes.length === 0 || themeMatches.some((theme) => selectedThemes.includes(theme));
		return matchesDay && matchesTheme;
	});
	$: missingLocations = walks.filter((walk) => !walk.lat || !walk.lng).length;
</script>

<svelte:head>
	<title>Jane's Walk Festival Map</title>
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Assistant:wght@300;400;600&display=swap"
	/>
</svelte:head>

<section class="page">
	<header class="hero">
		<p class="eyebrow"><a href="https://www.linkedin.com/in/yihoi-jung-0b95351b5/">Yihoi Jung</a></p>
		<h1>Jane's Walk Festival Map</h1>
		<p class="lede">
			Map view of the festival inspired by <a href="https://www.torontotechweek.com/">Toronto Tech Week</a> 2025. Select a day to see walk starting points and
			open a marker for details. Used latitude and longitude of the start location.
		</p>
	</header>

	<div class="controls">
		<div class="tab-group" role="group" aria-label="Select days">
			{#each days as day}
				<button
					class={`day-btn day-btn-${day.key}`}
					class:active={selectedDays.includes(day.key)}
					aria-pressed={selectedDays.includes(day.key)}
					on:click={() => toggleDay(day.key)}
				>
					<span>{day.label}</span>
					<small>{day.date}</small>
					<small>{dayCounts[day.key] ?? 0} walks</small>
				</button>
			{/each}
		</div>
		<div class="theme-group" role="group" aria-label="Filter by theme">
			<button class="theme-action" on:click={selectAllThemes}>
				<span>Select All</span>
			</button>
			<button class="theme-action" on:click={clearAllThemes}>
				<span>Clear All</span>
			</button>

			{#each allThemes as theme}
				<button
					class:active={selectedThemes.includes(theme)}
					class="theme-button"
					aria-pressed={selectedThemes.includes(theme)}
					on:click={() => toggleTheme(theme)}
				>
					<span>{theme}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="map-bleed">
		<Map
			{walks}
			selectedDays={selectedDayKeys}
			selectedThemes={selectedThemeKeys}
			coreThemes={coreThemes}
		/>
	</div>

	<section class="list">
		<h2>Walks</h2>
		{#if filteredWalks.length === 0}
			<p class="empty">No walks loaded yet. Run the data prep script to import the Excel list.</p>
		{:else}
			{#each days as day}
				{#if selectedDays.includes(day.key)}
					{@const dayWalks = filteredWalks
						.filter((walk) => normalizeDayKey(walk.day) === day.key)
						.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))}
					
					{#if dayWalks.length > 0}
						<h3 class="day-header">{day.label}</h3>
						<div class="cards">
							{#each dayWalks as walk}
								<article class={`card day-${normalizeDayKey(walk.day)}`}>
									<h4>
										{#if walk.link}
											<a href={walk.link} target="_blank" rel="noreferrer">
												{walk.title || 'Untitled walk'}
											</a>
										{:else}
											{walk.title || 'Untitled walk'}
										{/if}
									</h4>
									<div class="card-body">
										{#if walk.time}
											<p class="time">{walk.time}</p>
										{/if}
										{#if walk.location}
											<p class="location">{walk.location}</p>
										{/if}
									</div>
									<button class="read-more" on:click={() => openModal(walk)}>
										Read more
									</button>
								</article>
							{/each}
						</div>
					{/if}
				{/if}
			{/each}
		{/if}
	</section>
</section>

{#if selectedWalk}
	<div class="modal-backdrop" on:click|self={closeModal}>
		<div class="modal" role="dialog" aria-modal="true">
			<button class="modal-close" on:click={closeModal} aria-label="Close details">
				×
			</button>
			<h3>
				{#if selectedWalk.link}
					<a href={selectedWalk.link} target="_blank" rel="noreferrer">
						{selectedWalk.title || 'Untitled walk'}
					</a>
				{:else}
					{selectedWalk.title || 'Untitled walk'}
				{/if}
			</h3>
			{#if selectedWalk.time}
				<p class="modal-time">{selectedWalk.time}</p>
			{/if}
			{#if selectedWalk.location}
				<p class="modal-location">{selectedWalk.location}</p>
			{/if}
			{#if selectedWalk.identify}
				<p class="modal-location">{selectedWalk.identify}</p>
			{/if}
			{#if selectedWalk.duration}
				<p class="modal-location">Duration: {formatDuration(selectedWalk.duration)}</p>
			{/if}
			{#if selectedWalk.endLocation}
				<p class="modal-location">End location: {selectedWalk.endLocation}</p>
			{/if}
			{#if selectedWalk.leaders}
				<p class="modal-location">Leader(s): {selectedWalk.leaders}</p>
			{/if}
			{#if selectedWalk.organization}
				<p class="modal-location">Organization: {selectedWalk.organization}</p>
			{/if}
			{#if selectedWalk.language}
				<p class="modal-location">Language(s): {selectedWalk.language}</p>
			{/if}
			{#if selectedWalk.themes}
				<p class="modal-location">Theme(s): {selectedWalk.themes}</p>
			{/if}
			{#if selectedWalk.accessibility}
				<p class="modal-accessibility">Accessibility: {selectedWalk.accessibility}</p>
			{/if}
			{#if selectedWalk.summary}
				<p class="modal-summary">{selectedWalk.summary}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: 'Assistant', 'Helvetica Neue', sans-serif;
		background: radial-gradient(circle at top, #f3efe7 0%, #f6f2ea 28%, #eef4f2 60%, #e6eee9 100%);
		color: #1a2f2a;
	}

	.page {
		min-height: 100vh;
		padding: clamp(2rem, 4vw, 3.5rem);
		max-width: 1180px;
		margin: 0 auto;
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.6rem);
	}

	.hero {
		display: grid;
		gap: 0.6rem;
		position: relative;
		padding: 1.2rem 1.6rem;
		border-radius: 4px;
		background: linear-gradient(135deg, rgba(255, 250, 239, 0.85), rgba(234, 245, 240, 0.9));
		box-shadow: inset 0 0 0 1px rgba(86, 114, 105, 0.12);
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.75rem;
		color: #35564d;
		margin: 0;
		font-weight: 600;
	}

	h1 {
		font-family: 'Montserrat', sans-serif;
		font-weight: 800;
		font-size: clamp(2.4rem, 5vw, 3.6rem);
		margin: 0;
		color: #112620;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.lede {
		max-width: 720px;
		font-size: 1.05rem;
		line-height: 1.6;
		color: #2b4a42;
		margin: 0;
	}

	.controls {
		display: grid;
		gap: 0.8rem;
	}

	.map-bleed {
		width: min(90vw - 2rem, 1200px);
		margin: 0 auto;
		padding: 0 1rem;
	}

	.tab-group {
		display: flex;
		width: 100%;
		gap: 0.6rem;
	}

	button {
		border: 1px solid rgba(32, 70, 62, 0.2);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.8);
		padding: 0.6rem 1.2rem;
		font-family: inherit;
		cursor: pointer;
		display: grid;
		gap: 0.1rem;
		align-items: center;
		transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
	}

	button span {
		font-weight: 600;
	}

	button small {
		font-size: 0.75rem;
		color: #2e544a;
	}

	.day-btn {
		flex: 1;
		color: #fff;
		border: none;
		opacity: 0.65;
	}

	.day-btn small {
		color: rgba(255, 255, 255, 0.85);
	}

	.day-btn-fri { background: #1c3c35; }
	.day-btn-sat { background: #c48b1d; }
	.day-btn-sun { background: #c4553d; }

	.day-btn.active {
		opacity: 1;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
	}

	button.theme-button.active {
		background: #1c3c35;
		color: #f7f3ea;
		border-color: transparent;
		box-shadow: 0 4px 12px rgba(25, 60, 53, 0.25);
	}

	button:hover {
		transform: translateY(-2px);
	}

	.note {
		font-size: 0.85rem;
		color: #3f5d55;
		margin: 0;
	}

	.mono {
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		background: rgba(27, 69, 61, 0.08);
		padding: 0.2rem 0.4rem;
		border-radius: 2px;
	}

	.list h2 {
		font-family: 'Montserrat', sans-serif;
		font-weight: 800;
		font-size: 1.7rem;
		margin: 0 0 1rem;
		letter-spacing: -0.01em;
	}

	.day-header {
		font-family: 'Montserrat', sans-serif;
		font-weight: 800;
		font-size: 1.4rem;
		margin: 2rem 0 1rem;
		color: #1a2f2a;
		border-bottom: 2px solid rgba(86, 114, 105, 0.2);
		padding-bottom: 0.3rem;
		letter-spacing: -0.01em;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.card {
		background: rgba(255, 255, 255, 0.82);
		border-radius: 4px;
		padding: 1rem 1.1rem;
		box-shadow: 0 12px 24px rgba(17, 38, 32, 0.08);
		display: grid;
		gap: 0.45rem;
	}

	.card.day-fri {
		background: #1c3c35;
		color: #fff;
	}

	.card.day-sat {
		background: #c48b1d;
		color: #fff;
	}

	.card.day-sun {
		background: #c4553d;
		color: #fff;
	}

	.card h4 {
		margin: 0;
		font-family: 'Montserrat', sans-serif;
		font-weight: 700;
		line-height: 1.25;
		font-size: 1.1rem;
		color: #fff;
	}

	.card h4 a {
		color: inherit;
		text-decoration: underline;
	}

	.card h4 a:hover {
		text-decoration: underline;
	}

	.theme-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.theme-action {
		border-radius: 4px;
		padding: 0.45rem 0.8rem;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
		background: rgba(43, 74, 66, 0.1);
		border-color: transparent;
		color: #1c3c35;
	}
	
	.theme-action:hover {
		background: rgba(43, 74, 66, 0.15);
	}

	.theme-button {
		border-radius: 4px;
		padding: 0.45rem 0.8rem;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
	}


	.time {
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
	}

	.card-body {
		max-height: 80px;
		overflow: hidden;
		display: grid;
		gap: 0.35rem;
	}

	.location {
		margin: 0;
		color: rgba(255, 255, 255, 0.85);
		font-size: 0.9rem;
	}

	.read-more {
		border: 0;
		background: transparent;
		color: #fff;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		justify-self: start;
		text-decoration: underline;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(16, 29, 25, 0.45);
		display: grid;
		place-items: center;
		padding: 1.5rem;
		z-index: 1000;
	}

	.modal {
		background: #fefbf4;
		color: #1a2f2a;
		border-radius: 4px;
		max-width: 640px;
		width: 100%;
		padding: 1.6rem 1.8rem;
		box-shadow: 0 25px 55px rgba(14, 33, 29, 0.25);
		position: relative;
		display: grid;
		gap: 0.7rem;
	}

	.modal h3 {
		margin: 0;
		font-family: 'Montserrat', sans-serif;
		font-weight: 800;
		font-size: 1.4rem;
		line-height: 1.25;
		letter-spacing: -0.01em;
	}

	.modal h3 a {
		color: inherit;
		text-decoration: none;
	}

	.modal h3 a:hover {
		text-decoration: underline;
	}

	.modal-time {
		font-weight: 600;
		color: #1f4c43;
		margin: 0;
	}

	.modal-location,
	.modal-accessibility,
	.modal-summary {
		margin: 0;
		color: #2f3f3b;
		line-height: 1.5;
	}

	.modal-close {
		position: absolute;
		top: 0.6rem;
		right: 0.8rem;
		border: 0;
		background: transparent;
		font-size: 1.6rem;
		cursor: pointer;
		color: #2f3f3b;
	}

	.empty {
		margin: 0;
		color: #405b54;
		background: rgba(255, 255, 255, 0.7);
		padding: 1rem;
		border-radius: 4px;
	}

	@media (max-width: 700px) {
		.hero {
			padding: 1rem 1.2rem;
		}

		button {
			width: 100%;
			align-items: center;
		}
	}
</style>
