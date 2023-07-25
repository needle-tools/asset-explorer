import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from "vite-plugin-mkcert";

// https://github.com/sapphi-red/vite-plugin-static-copy#usage
import { viteStaticCopy, type Target } from 'vite-plugin-static-copy'
import { collectFileInformation } from "./src/dynamicFiles";

export default defineConfig(async ({ command, mode }) => {
	
	const { files, images } = await collectFileInformation();

	(global as any).listOfModelFiles = files;

	const copyTargets: Target[] = [];
	copyTargets.push(...files.map((file) => {
		return {
			src: file.paths.gltf,
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
			mkcert(),
			viteStaticCopy({
				targets: copyTargets,
			}),
			sveltekit(),
		],
		build: {
			target: "esnext",
		},
		optimizeDeps: {
			exclude: [
				"three",
				"@needle-tools/engine",
			],
		},
	}
  })