import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// https://github.com/sapphi-red/vite-plugin-static-copy#usage
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { files } from "./dynamicFiles";

(global as any).listOfModelFiles = files;

export default defineConfig({
	plugins: [
		viteStaticCopy({
			targets: files.map((file) => {
				return {
					src: file.path,
					dest: "downloads",
				}
			}),
		}),
		sveltekit(),
	]
});
