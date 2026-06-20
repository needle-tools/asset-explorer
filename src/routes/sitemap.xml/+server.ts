import { collectFileInformation } from '../../dynamicFiles';

// Prerendered at build time -> emits a static /sitemap.xml
export const prerender = true;

const BASE_URL = 'https://asset-explorer.needle.tools';

export async function GET() {
	const { files } = await collectFileInformation();

	const urls = [
		{ loc: `${BASE_URL}/`, priority: '1.0' },
		{ loc: `${BASE_URL}/about`, priority: '0.5' },
		...files
			.filter(Boolean)
			.map((file: any) => ({ loc: `${BASE_URL}/${file.slug}`, priority: '0.8' }))
	];

	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		urls
			.map((u) => `\t<url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`)
			.join('\n') +
		`\n</urlset>\n`;

	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
}
