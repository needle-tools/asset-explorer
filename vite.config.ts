import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from "vite-plugin-mkcert";

// https://github.com/sapphi-red/vite-plugin-static-copy#usage
import { viteStaticCopy, type Target } from 'vite-plugin-static-copy'
import { collectFileInformation } from "./src/dynamicFiles";

export default defineConfig(async ({ command, mode }) => {

	const { files, images } = await collectFileInformation(undefined, true);

	(global as any).listOfModelFiles = files;

	const copyTargets: Target[] = [];
	copyTargets.push(...files.flatMap((file) => {
		// console.log(file.paths.threeScreenshot, file.paths.gltf)
		return [
			{
				src: file.paths.gltf,
				dest: "downloads",
			},
			{
				src: file.paths.threeUsdz,
				dest: "downloads",
			},
			{
				src: file.paths.threeScreenshot,
				dest: "downloads",
			},
			{
				src: file.paths.blenderUsdz,
				dest: "downloads",
			},
			{
				src: file.paths.blenderScreenshot,
				dest: "downloads",
			},
			{
				src: file.paths.ovUsdz,
				dest: "downloads",
			},
			{
				src: file.paths.ovScreenshot,
				dest: "downloads",
			},
			{
				src: file.paths.gucUsdz,
				dest: "downloads",
			},
			{
				src: file.paths.gucScreenshot,
				dest: "downloads",
			},
		]
	}));
	copyTargets.push(...images.map((image) => {
		return {
			src: image.absolutePath,
			dest: image.targetPath,
		}
	}));

	/*
	const { needlePlugins, useGzip, loadConfig } = await import("@needle-tools/engine/plugins/vite/index.js");
    const needleConfig = await loadConfig();
	needleConfig.useRapier = false;
	*/

	return {
		plugins: [
			mkcert(),
			viteStaticCopy({
				targets: copyTargets,
			}),
			sveltekit(),            
			// needlePlugins(command, needleConfig),
		],
		build: {
			target: "esnext",
		},
		optimizeDeps: {
			exclude: ["three"],
		},
		define: {
			NEEDLE_USE_RAPIER: false,
		}
	}
  })