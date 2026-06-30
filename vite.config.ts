import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import mkcert from "vite-plugin-mkcert";
import path from 'path';
import fs from 'fs';

// https://github.com/sapphi-red/vite-plugin-static-copy#usage
import { viteStaticCopy, type Target } from 'vite-plugin-static-copy'
import { collectFileInformation } from "./src/dynamicFiles";

const sampleAssetsAnalysisDir = "submodules/glTF-Sample-Assets/conversion-analysis";
const legacyAnalysisDir = "conversion-analysis";
const needleEnginePackageRoot = process.env.NEEDLE_ENGINE_PACKAGE_ROOT
	? path.resolve(process.env.NEEDLE_ENGINE_PACKAGE_ROOT)
	: path.resolve("node_modules/needle-engine-latest");

function needleExportDecoderMiddleware(): Plugin {
	const decoderRoots = new Map([
		["/include/draco/", path.join(needleEnginePackageRoot, "node_modules/three/examples/jsm/libs/draco/gltf")],
		["/include/ktx2/", path.join(needleEnginePackageRoot, "node_modules/three/examples/jsm/libs/basis")],
	]);

	const contentTypes: Record<string, string> = {
		".js": "text/javascript",
		".wasm": "application/wasm",
	};

	return {
		name: "needle-export-decoder-middleware",
		configureServer(server) {
			server.middlewares.use((req: any, res: any, next: any) => {
				const requestPath = decodeURIComponent(req.url?.split("?")[0] ?? "");
				for (const [prefix, root] of decoderRoots) {
					if (!requestPath.startsWith(prefix)) continue;
					const file = path.join(root, path.basename(requestPath));
					if (!fs.existsSync(file)) break;
					res.setHeader("Content-Type", contentTypes[path.extname(file)] ?? "application/octet-stream");
					fs.createReadStream(file).pipe(res);
					return;
				}
				next();
			});
		},
	};
}

export default defineConfig(async ({ command, mode }) => {
	const exportRunner = process.env.CONVERSION_EXPORT_RUNNER;
	const isExportRunner = Boolean(exportRunner);
	const isNeedleExportRunner = exportRunner === "needle-engine" || Boolean(process.env.NEEDLE_EXPORT_RUNNER);

	const { files, images } = isExportRunner
		? { files: [], images: [] }
		: await collectFileInformation(undefined, true);

	(global as any).listOfModelFiles = files;

	const copyTargets: Target[] = [];
	copyTargets.push(...files.flatMap((file) => {
		const targets = [
			{
				src: file.paths.gltf,
				dest: "downloads",
			},
		];
		if (file.sourcePreview?.available) {
			targets.push({
				src: file.sourcePreview.screenshotPath,
				dest: "downloads",
			});
		}
		for (const conversion of file.conversions ?? []) {
			if (conversion.available) {
				targets.push({
					src: conversion.usdzPath,
					dest: "downloads",
				});
			}
			if (conversion.screenshotAvailable) {
				targets.push({
					src: conversion.screenshotPath,
					dest: "downloads",
				});
			}
		}
		return targets;
	}));
	copyTargets.push(...images.map((image) => {
		return {
			src: image.absolutePath,
			dest: image.targetPath,
		}
	}));
	const analysisDir = fs.existsSync(sampleAssetsAnalysisDir) ? sampleAssetsAnalysisDir : legacyAnalysisDir;
	if (fs.existsSync(analysisDir)) {
		copyTargets.push({
			src: `${analysisDir}/**/*.json`,
			dest: "analysis",
		});
	}

	/*
	const { needlePlugins, useGzip, loadConfig } = await import("@needle-tools/engine/plugins/vite/index.js");
    const needleConfig = await loadConfig();
	needleConfig.useRapier = false;
	*/

	const config: UserConfig = {
		plugins: [
			mkcert(),
			...(isNeedleExportRunner ? [needleExportDecoderMiddleware()] : []),
			...(!isExportRunner ? [viteStaticCopy({
				targets: copyTargets,
			})] : []),
			sveltekit(),            
			// needlePlugins(command, needleConfig),
		],
		build: {
			target: "esnext",
		},
		optimizeDeps: {
			exclude: isNeedleExportRunner ? ["three", "@needle-tools/materialx"] : ["three"],
		},
		resolve: {
			alias: isNeedleExportRunner
				? {
					"needle-engine-latest": needleEnginePackageRoot,
					three: path.join(needleEnginePackageRoot, "node_modules/three"),
				}
					: exportRunner === "three-r185" || exportRunner === "gltf-reference"
					? {
						three: path.resolve("node_modules/three-r185"),
					}
					: {},
		},
		define: {
			NEEDLE_USE_RAPIER: false,
		}
	};

	if (isExportRunner) {
		config.server = {
			fs: {
				allow: [path.resolve(".")],
			},
		};
	}
	return config;
})
