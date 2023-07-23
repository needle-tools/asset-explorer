import { vitePreprocess } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';

const dev = process.argv.includes('dev');

// import { files } from "./dynamicFiles.js";
// const files = global.listOfModelFiles;

// https://github.com/sveltejs/kit/issues/2576#issuecomment-1264586432
// console.log("FILE COUNT: " + global.listOfModelFiles.length);

// console.log(files);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter({
            // default options are shown. On some platforms
            // these options are set automatically — see below
            pages: 'build',
            assets: 'build',
            fallback: null,
            precompress: false,
            strict: true,
        }),
		paths: {
            base: dev ? '' : process.env.BASE_PATH, // process.env.BASE_PATH,
        },
		prerender: {
			// entries: [],
			// Not needed because the models overview page has links to all the models – and sveltekit will automatically pre-render all reachable links!
			// entries: ['*', ...files.map((file) => file.uri)],
			handleHttpError: 'warn',
		}
	}
};

export default config;
