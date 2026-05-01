<script>
	import { onMount } from 'svelte';

	export let walks = [];
	export let selectedDays = [];
	export let selectedThemes = [];
	export let coreThemes = [];

	let mapEl;
	let map;
	let markersLayer;
	let leafletRef;

	const torontoCenter = [43.6532, -79.3832];

	const normalizeDayKey = (value) => {
		if (!value) return '';
		const text = String(value).toLowerCase();

		if (text.includes('fri')) return 'fri';
		if (text.includes('sat')) return 'sat';
		if (text.includes('sun')) return 'sun';

		const match = text.match(/may\s*(\d{1,2})/i);
		if (match) {
			switch (Number(match[1])) {
				case 1:
					return 'fri';
				case 2:
					return 'sat';
				case 3:
					return 'sun';
			}
		}

		return '';
	};

	const dayColors = {
		fri: '#1c3c35',
		sat: '#c48b1d',
		sun: '#c4553d'
	};

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

	const getSelectedDays = () =>
		Array.isArray(selectedDays) ? selectedDays : Array.from(selectedDays ?? []);
	const getSelectedThemes = () =>
		Array.isArray(selectedThemes) ? selectedThemes : Array.from(selectedThemes ?? []);

	const escapeHtml = (value) =>
		String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');

	const formatDuration = (val) => {
		if (!val) return '';
		const str = String(val);
		const m = str.match(/(\d{1,2}):(\d{2})/);
		if (m) {
			return `${m[1]}:${m[2]}`;
		}
		return str;
	};

	const buildPopupHtml = (walk) => {
		const title = escapeHtml(walk.title || 'Untitled walk');
		const time = walk.time ? `Start: ${escapeHtml(walk.time)}` : '';
		const duration = walk.duration ? `Duration: ${escapeHtml(formatDuration(walk.duration))}` : '';
		const schedule = [duration, time].filter(Boolean).join(' | ');
		const location = walk.location
			? `<div class="popup-location">${escapeHtml(walk.location)}</div>`
			: '';
		const identify = walk.identify
			? `<div class="popup-identify">${escapeHtml(walk.identify)}</div>`
			: '';
		const accessibility = walk.accessibility
			? `<div class="popup-accessibility">Accessibility: ${escapeHtml(walk.accessibility)}</div>`
			: '';
		const scheduleHtml = schedule ? `<div class="popup-time">${schedule}</div>` : '';

		return `<div class="popup"><h4>${title}</h4>${location}${identify}${scheduleHtml}${accessibility}</div>`;
	};


	const updateMarkers = (L) => {
		if (!markersLayer) return;

		markersLayer.clearLayers();

		const dayFilters = getSelectedDays();
		const themeFilters = getSelectedThemes();

		const filtered = walks.filter((walk) => {
			if (!dayFilters.length) return false;
			const lat = Number(walk.lat);
			const lng = Number(walk.lng);
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
			const dayKey = normalizeDayKey(walk.day);
			const walkThemes = mapToCoreThemes(walk.themes);
			const matchesTheme =
				!themeFilters.length || walkThemes.some((theme) => themeFilters.includes(theme));
			return dayFilters.includes(dayKey) && matchesTheme;
		});
		const points = [];
		filtered.forEach((walk) => {
			const lat = Number(walk.lat);
			const lng = Number(walk.lng);
			const dayKey = normalizeDayKey(walk.day);
			const color = dayColors[dayKey] ?? '#1c3c35';
			points.push([lat, lng]);

			const marker = L.circleMarker([lat, lng], {
				radius: 7,
				color,
				weight: 2,
				fillColor: color,
				fillOpacity: 0.9
			});
			marker.bindPopup(buildPopupHtml(walk));
			marker.addTo(markersLayer);
		});
	};

	const initMap = async () => {
		const leaflet = await import('leaflet');
		leafletRef = leaflet.default;

		const icon2x = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
		const icon = (await import('leaflet/dist/images/marker-icon.png')).default;
		const shadow = (await import('leaflet/dist/images/marker-shadow.png')).default;

		delete leafletRef.Icon.Default.prototype._getIconUrl;
		leafletRef.Icon.Default.mergeOptions({
			iconRetinaUrl: icon2x,
			iconUrl: icon,
			shadowUrl: shadow
		});

		map = leafletRef.map(mapEl, {
			zoomControl: true,
			scrollWheelZoom: true
		}).setView(torontoCenter, 12);

		leafletRef
			.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors'
			})
			.addTo(map);

		markersLayer = leafletRef.layerGroup().addTo(map);
		updateMarkers(leafletRef);

		setTimeout(() => {
			map.invalidateSize();
		}, 0);
	};

	onMount(() => {
		initMap();

		return () => {
			if (map) {
				map.remove();
			}
		};
	});

	$: if (leafletRef && markersLayer && selectedDays && selectedThemes) {
		updateMarkers(leafletRef);
	}
</script>

<div class="map-shell">
	<div class="map" bind:this={mapEl} aria-label="Festival walk map"></div>
</div>

<style>
	.map-shell {
        margin: 0 auto;
        max-width: 1200px;
        width: 100%;
		overflow: hidden;
		box-shadow: 0 18px 45px rgba(14, 33, 29, 0.18);
		background: #f0f5f2;
	}

	.map {
		width: 100%;
		height: clamp(360px, 65vh, 620px);
	}


	:global(.popup h4) {
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: 1.05rem;
		margin: 0 0 0.35rem;
		color: #102a25;
	}

	:global(.popup-time) {
		font-weight: 600;
		color: #1f4c43;
		margin-bottom: 0.2rem;
	}

	:global(.popup-location) {
		font-size: 0.9rem;
		color: #2c5f56;
		margin-bottom: 0.35rem;
	}

	:global(.popup-identify) {
		font-size: 0.88rem;
		color: #2b4a42;
		margin-bottom: 0.25rem;
	}

	:global(.popup-accessibility) {
		font-size: 0.85rem;
		line-height: 1.35;
		color: #2a3c39;
		margin: 0.2rem 0 0;
	}
</style>
