type SourceReference = { repository: string; revision: string };
type SourceEntry = {
	kind: string;
	blob: string;
	source: SourceReference;
	upstreamBlob: string | null;
	upstreamChanged: boolean;
	readme: (SourceReference & { path: string }) | null;
};

export type AssetSourceManifest = {
	fork: SourceReference;
	upstream: SourceReference;
	mergeBase: string;
	assets: Record<string, SourceEntry>;
};

export function repositoryFileUrl(repository: string, revision: string, file: string) {
	return `https://github.com/${repository}/blob/${encodeURIComponent(revision)}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

export function resolveAssetProvenance(manifest: AssetSourceManifest, assetPath: string, readmePath: string) {
	const entry = manifest.assets[assetPath];
	const kind = entry?.kind ?? "unclassified";
	const source = entry?.source ?? { repository: manifest.fork.repository, revision: "asset-explorer" };
	const labels: Record<string, { label: string; collection: string }> = {
		khronos: { label: "Khronos sample asset", collection: "Khronos sample assets" },
		"needle-added": { label: "Needle sample asset", collection: "Needle sample assets" },
		"needle-modified": { label: "Modified in Needle fork", collection: "Needle fork variants" },
		unclassified: { label: "Source not compared", collection: "Unclassified samples" },
	};
	const display = labels[kind] ?? labels.unclassified;
	return {
		kind,
		...display,
		repository: source.repository,
		revision: source.revision,
		repositoryUrl: `https://github.com/${source.repository}/tree/${source.revision}`,
		fileUrl: repositoryFileUrl(source.repository, source.revision, assetPath),
		readmeUrl: entry?.readme
			? repositoryFileUrl(entry.readme.repository, entry.readme.revision, entry.readme.path)
			: repositoryFileUrl(manifest.fork.repository, manifest.fork.revision, readmePath),
		upstreamUrl: entry?.upstreamBlob
			? repositoryFileUrl(manifest.upstream.repository, manifest.upstream.revision, assetPath)
			: null,
		comparisonUrl: `https://github.com/${manifest.fork.repository}/compare/${manifest.mergeBase}...${manifest.fork.revision}`,
	};
}

export function rewriteAssetSourceLink(manifest: AssetSourceManifest, href: string): string {
	let url: URL;
	try { url = new URL(href); }
	catch { return href; }
	const model = url.searchParams.get("model");
	if (model) {
		const revised = rewriteAssetSourceLink(manifest, model);
		if (revised !== model) {
			url.searchParams.set("model", revised);
			return url.href;
		}
	}
	if (url.hostname !== "raw.githubusercontent.com") return href;
	const match = url.pathname.match(/^\/(?:KhronosGroup|needle-tools)\/glTF-Sample-Assets\/[^/]+\/(.+)$/i);
	if (!match) return href;
	const file = decodeURIComponent(match[1]);
	const source = manifest.assets[file]?.source;
	if (!source) return href;
	url.pathname = `/${source.repository}/${source.revision}/${file.split("/").map(encodeURIComponent).join("/")}`;
	return url.href;
}
