import { collectFileInformation } from '../../dynamicFiles';

// Prerendered at build time -> emits a static /model-index.json file.
export const prerender = true;

// Canonical public origin (custom domain maps to repo root).
const BASE_URL = 'https://asset-explorer.needle.tools';

function absolute(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith('http://') || path.startsWith('https://')) return path;
	return BASE_URL + (path.startsWith('/') ? '' : '/') + path;
}

function conversionVariantName(conversion: any): string {
	return `USDZ-${conversion.id ?? conversion.suffix ?? conversion.converter}`;
}

export async function GET() {
	const { files } = await collectFileInformation();

	const models = files.filter(Boolean).map((file: any) => {
		const variants: Record<string, string> = {};
		const variantThumbnails: Record<string, string> = {};

		const glb = absolute(file.downloadUri);
		if (glb) variants['glTF-Binary'] = glb;

		for (const conversion of file.conversions ?? []) {
			if (!conversion.available || !conversion.usdzUri) continue;

			const variantName = conversionVariantName(conversion);
			const usdz = absolute(conversion.usdzUri);
			if (usdz) variants[variantName] = usdz;

			const thumbnail = absolute(conversion.screenshotAvailable ? conversion.screenshotUri : file.previewUri);
			if (thumbnail) variantThumbnails[variantName] = thumbnail;
		}

		const screenshot = absolute(file.previewUri);

		return {
			name: file.slug,
			label: file.displayName,
			screenshot,
			thumbnail: screenshot,
			tags: file.groups ?? [],
			variants,
			variantThumbnails,
		};
	});

	return new Response(JSON.stringify(models, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*'
		}
	});
}
