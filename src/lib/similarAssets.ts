type SimilarityAsset = {
	slug: string;
	displayName: string;
	previewUri?: string | null;
	groups?: string[];
	info?: Record<string, unknown>;
};

function signals(asset: SimilarityAsset) {
	const result = new Map<string, number>();
	for (const [key, value] of Object.entries(asset.info ?? {})) {
		if (!value || ["generator", "source", "copyright", "fileSize"].includes(key) || (key === "scenes" && Number(value) <= 1)) continue;
		result.set(key, /^[A-Z][A-Z0-9]+_/.test(key) ? 4 : 1);
	}
	for (const group of asset.groups ?? []) result.set("group:" + group, 0.5);
	for (const word of asset.displayName.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2)) {
		result.set("name:" + word, 5);
	}
	return result;
}

export function findSimilarAssets(current: SimilarityAsset, assets: SimilarityAsset[], limit = 5) {
	const entries = assets.map(asset => ({ asset, signals: signals(asset) }));
	const target = signals(current);
	const frequencies = new Map<string, number>();
	for (const entry of entries) {
		for (const key of entry.signals.keys()) frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
	}
	return entries.filter(({ asset }) => asset.slug !== current.slug).map(({ asset, signals: candidate }) => {
		let shared = 0;
		let union = 0;
		const matches: string[] = [];
		for (const key of new Set([...target.keys(), ...candidate.keys()])) {
			const weight = (target.get(key) ?? candidate.get(key) ?? 0) * (1 + Math.log((assets.length + 1) / ((frequencies.get(key) ?? 0) + 1)));
			union += weight;
			if (target.has(key) && candidate.has(key)) {
				shared += weight;
				if (!key.startsWith("name:") && !key.startsWith("group:")) matches.push(key);
			}
		}
		matches.sort((a, b) => (target.get(b) ?? 0) - (target.get(a) ?? 0) || a.localeCompare(b));
		return { slug: asset.slug, name: asset.displayName, thumbnail: asset.previewUri, matches: matches.slice(0, 2), score: union ? shared / union : 0 };
	}).filter(asset => asset.score > 0)
		.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
		.slice(0, limit)
		.map(({ score, ...asset }) => asset);
}
