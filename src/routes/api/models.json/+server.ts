import { collectFileInformation } from '../../../dynamicFiles';

// Prerendered at build time -> emits a static /api/models.json file.
export const prerender = true;

// Canonical public origin (custom domain maps to repo root).
const BASE_URL = 'https://asset-explorer.needle.tools';

function absolute(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith('http://') || path.startsWith('https://')) return path;
	return BASE_URL + (path.startsWith('/') ? '' : '/') + path;
}

export async function GET() {
	const { files } = await collectFileInformation();

	const models = files.filter(Boolean).map((file: any) => {
		const info = file.info ?? {};
		const extensions = Object.keys(info).filter((k) => /^[A-Z][A-Z0-9]+_/.test(k) && info[k]);
		const glb = absolute(file.downloadUri);
		const usdz = (suffix: string) => (glb ? glb.replace('.glb', `.glb.${suffix}.usdz`) : null);

		return {
			slug: file.slug,
			name: file.displayName,
			detailUrl: `${BASE_URL}/${file.slug}`,
			thumbnail: absolute(file.previewUri),
			assets: {
				glb,
				usdz: {
					three: usdz('three'),
					blender: usdz('blender'),
					omniverse: usdz('ov')
				}
			},
			size: file.size,
			extensions,
			info
		};
	});

	const body = JSON.stringify({ count: models.length, baseUrl: BASE_URL, models }, null, 2);

	return new Response(body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			// Served as a static file on GitHub Pages (which itself adds ACAO:*);
			// this header still applies in dev/SSR.
			'access-control-allow-origin': '*'
		}
	});
}
