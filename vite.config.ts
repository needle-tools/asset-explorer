import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// https://github.com/sapphi-red/vite-plugin-static-copy#usage
import { viteStaticCopy, type Target } from 'vite-plugin-static-copy'
import { collectFileInformation } from "./dynamicFiles";

export default defineConfig(async ({ command, mode }) => {
	
	const { files, images } = await collectFileInformation();

	(global as any).listOfModelFiles = files;

	const copyTargets: Target[] = [];
	copyTargets.push(...files.map((file) => {
		return {
			src: file.path,
			dest: "downloads",
		}
	}));
	copyTargets.push(...images.map((image) => {
		return {
			src: image.absolutePath,
			dest: image.targetPath,
		}
	}));

	// console.log(copyTargets)

	return {
		plugins: [
			viteStaticCopy({
				targets: copyTargets,
			}),
			sveltekit(),
		],
		build: {
			target: "esnext",
		},
	}
  })