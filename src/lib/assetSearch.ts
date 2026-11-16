type SearchableAsset = {
	name: string;
	subheadline?: string;
	groups?: string[];
	extras?: { info?: Record<string, unknown> };
};

function normalize(text: string) {
	return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]/g, " ");
}

function matchScore(text: string, query: string) {
	if (!text) return 0;
	if (text === query) return 1.2;
	if (text.startsWith(query)) return 1.1;
	if (text.includes(query)) return 1;
	// Fuzzy subsequence matches tolerate omitted letters without matching tiny fragments.
	if (query.length < 3) return 0;
	let best = 0;
	for (const word of text.split(/\s+/)) {
		let cursor = 0;
		for (const character of word) {
			if (character === query[cursor]) cursor++;
		}
		if (cursor === query.length && query.length / word.length >= 0.5) {
			best = Math.max(best, 0.5 * query.length / word.length);
		}
	}
	return best;
}

export function scoreAssetSearch(asset: SearchableAsset, query: string) {
	const words = normalize(query).trim().split(/\s+/).filter(Boolean);
	if (!words.length) return 1;
	const info = Object.entries(asset.extras?.info ?? {}).filter(([key, value]) =>
		Boolean(value) && !["generator", "source", "copyright", "fileSize"].includes(key) && (key !== "scenes" || Number(value) > 1));
	const fields: [string, number][] = [
		[normalize(asset.name), 100],
		[normalize(asset.subheadline ?? ""), 60],
		[normalize(info.filter(([key]) => /^[A-Z][A-Z0-9]+_/.test(key)).map(([key]) => key).join(" ")), 45],
		[normalize((asset.groups ?? []).join(" ")), 30],
		[normalize(info.filter(([key]) => !/^[A-Z][A-Z0-9]+_/.test(key)).map(([key]) => key + " " + key.replace(/([a-z])([A-Z])/g, "$1 $2")).join(" ")), 20],
	];
	let total = 0;
	for (const word of words) {
		const score = Math.max(...fields.map(([text, weight]) => matchScore(text, word) * weight));
		if (!score) return 0;
		total += score;
	}
	return total;
}
