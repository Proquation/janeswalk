import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.resolve(__dirname, "../data/Jane's Walk 2026 List.xlsx");
const RAW_OUTPUT = path.resolve(__dirname, '../src/lib/data/walks.raw.json');
const FINAL_OUTPUT = path.resolve(__dirname, '../src/lib/data/walks.json');
const OVERRIDES_FILE = path.resolve(__dirname, './walks-overrides.json');

const COLUMN_NAMES = {
	link: 'Walk Webpage Link',
	title: 'Title of Your Walk',
	summary: 'Walk Summary',
	themes: 'What are the theme(s) of your walk?',
	leaders: 'Name of the walk leader(s)',
	organization: 'Organization name (if applicable)',
	identify: 'How will walk attendees identify you at the meeting spot?',
	language: 'What language(s) will your walk be held in?',
	duration: 'Walk duration',
	day: 'Walk date',
	time: 'Start time',
	location: 'Walk start location',
	endLocation: 'Walk end location',
	accessibility: 'Accessibility considerations',
	latlng: 'Lat Lng'
};

const normalizeDay = (value) => {
	if (!value) return '';

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const month = value.toLocaleString('en-US', { month: 'long' });
		const day = value.getDate();
		return `${month} ${day}`;
	}

	const text = String(value).trim();
	if (!text) return '';

	const match = text.match(/(May)\s*(\d{1,2})/i);
	if (match) {
		return `May ${Number(match[2])}`;
	}

	return text;
};

const normalizeTime = (value) => {
	if (!value) return '';
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	return String(value).trim();
};

const findColumn = (headers, name) => {
	const normalizedName = name.trim().toLowerCase();
	const exact = headers.find((header) => header.trim().toLowerCase() === normalizedName);
	return exact ?? headers.find((header) => header.trim().toLowerCase().includes(normalizedName));
};

const parseLatLng = (value) => {
	if (!value) return null;

	const text = String(value).trim();
	if (!text) return null;

	const parts = text
		.split(/[,\s]+/)
		.map((part) => part.trim())
		.filter(Boolean);

	if (parts.length < 2) return null;

	const lat = Number(parts[0]);
	const lng = Number(parts[1]);

	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

	return { lat, lng };
};

const geocode = async (query) => {
	const url = new URL('https://nominatim.openstreetmap.org/search');
	url.searchParams.set('format', 'json');
	url.searchParams.set('limit', '1');
	url.searchParams.set('q', `${query}, Toronto, ON, Canada`);

	const response = await fetch(url, {
		headers: {
			'User-Agent': 'janeswalkmap/1.0 (local script)'
		}
	});

	if (!response.ok) {
		throw new Error(`Geocoding failed for ${query}: ${response.status}`);
	}

	const data = await response.json();
	if (!data.length) return null;

	return {
		lat: Number(data[0].lat),
		lng: Number(data[0].lon)
	};
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
	try {
		await fs.access(INPUT_FILE);
	} catch {
		console.error(`Missing Excel file: ${INPUT_FILE}`);
		console.error("Place the file at data/Jane's Walk 2026 List.xlsx and rerun.");
		process.exit(1);
	}

	const workbook = xlsx.readFile(INPUT_FILE, { cellDates: true });
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

	if (!rows.length) {
		console.error('No rows found in the first sheet.');
		process.exit(1);
	}

	const headers = Object.keys(rows[0]);
	const columnMap = {
		link: findColumn(headers, COLUMN_NAMES.link),
		title: findColumn(headers, COLUMN_NAMES.title),
		summary: findColumn(headers, COLUMN_NAMES.summary),
		themes: findColumn(headers, COLUMN_NAMES.themes),
		leaders: findColumn(headers, COLUMN_NAMES.leaders),
		organization: findColumn(headers, COLUMN_NAMES.organization),
		identify: findColumn(headers, COLUMN_NAMES.identify),
		language: findColumn(headers, COLUMN_NAMES.language),
		duration: findColumn(headers, COLUMN_NAMES.duration),
		day: findColumn(headers, COLUMN_NAMES.day),
		time: findColumn(headers, COLUMN_NAMES.time),
		location: findColumn(headers, COLUMN_NAMES.location),
		endLocation: findColumn(headers, COLUMN_NAMES.endLocation),
		accessibility: findColumn(headers, COLUMN_NAMES.accessibility),
		latlng: findColumn(headers, COLUMN_NAMES.latlng)
	};

	console.log('Detected columns:', columnMap);

	const raw = rows
		.map((row, index) => {
			const title = columnMap.title ? String(row[columnMap.title]).trim() : '';
			const day = columnMap.day ? normalizeDay(row[columnMap.day]) : '';
			const time = columnMap.time ? normalizeTime(row[columnMap.time]) : '';
			const location = columnMap.location ? String(row[columnMap.location]).trim() : '';
			const summary = columnMap.summary ? String(row[columnMap.summary]).trim() : '';
			const latlng = columnMap.latlng ? parseLatLng(row[columnMap.latlng]) : null;
			const link = columnMap.link ? String(row[columnMap.link]).trim() : '';
			const accessibility = columnMap.accessibility
				? String(row[columnMap.accessibility]).trim()
				: '';
			const themes = columnMap.themes ? String(row[columnMap.themes]).trim() : '';
			const leaders = columnMap.leaders ? String(row[columnMap.leaders]).trim() : '';
			const organization = columnMap.organization
				? String(row[columnMap.organization]).trim()
				: '';
			const identify = columnMap.identify ? String(row[columnMap.identify]).trim() : '';
			const language = columnMap.language ? String(row[columnMap.language]).trim() : '';
			const duration = columnMap.duration ? String(row[columnMap.duration]).trim() : '';
			const endLocation = columnMap.endLocation
				? String(row[columnMap.endLocation]).trim()
				: '';

			return {
				id: index + 1,
				title,
				day,
				time,
				location,
				summary,
				link,
				accessibility,
				themes,
				leaders,
				organization,
				identify,
				language,
				duration,
				endLocation,
				lat: latlng?.lat ?? null,
				lng: latlng?.lng ?? null
			};
		})
		.filter((row) => row.title || row.location);

	await fs.writeFile(RAW_OUTPUT, `${JSON.stringify(raw, null, 2)}\n`);

	let overrides = {};
	try {
		const overrideText = await fs.readFile(OVERRIDES_FILE, 'utf-8');
		overrides = JSON.parse(overrideText);
	} catch {
		overrides = {};
	}

	const shouldGeocode = process.env.GEOCODE === '1';
	const missingLocations = [];

	const final = [];
	for (const walk of raw) {
		const override = overrides[walk.location];
		if (override) {
			final.push({ ...walk, ...override });
			continue;
		}

		if (Number.isFinite(walk.lat) && Number.isFinite(walk.lng)) {
			final.push(walk);
			continue;
		}

		if (shouldGeocode && walk.location) {
			try {
				const result = await geocode(walk.location);
				if (result) {
					final.push({ ...walk, ...result });
				} else {
					missingLocations.push(walk.location);
					final.push({ ...walk, lat: null, lng: null });
				}
			} catch (error) {
				console.warn(`Geocode error: ${error.message}`);
				missingLocations.push(walk.location);
				final.push({ ...walk, lat: null, lng: null });
			}

			await sleep(1100);
			continue;
		}

		missingLocations.push(walk.location);
		final.push({ ...walk, lat: null, lng: null });
	}

	await fs.writeFile(FINAL_OUTPUT, `${JSON.stringify(final, null, 2)}\n`);

	if (missingLocations.length) {
		console.log('Missing coordinates for locations:');
		missingLocations
			.filter(Boolean)
			.slice(0, 20)
			.forEach((location) => console.log(`- ${location}`));
		if (missingLocations.length > 20) {
			console.log(`...and ${missingLocations.length - 20} more`);
		}
	}

	console.log(`Wrote ${raw.length} rows to ${RAW_OUTPUT}`);
	console.log(`Wrote ${final.length} rows to ${FINAL_OUTPUT}`);
};

main();
