#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleAssetsDir = path.join(rootDir, "submodules/glTF-Sample-Assets");
const legacyModelsDir = path.join(rootDir, "submodules/glTF-Sample-Models");
const sourceDir = fs.existsSync(path.join(sampleAssetsDir, "Models")) ? sampleAssetsDir : legacyModelsDir;
const sourceSubfolder = sourceDir === sampleAssetsDir ? "Models" : "2.0";
const provenancePath = path.join(sourceDir, "conversion-provenance.json");
const domeLight = path.join(rootDir, "src/lib/images/neutral.hdr");
const imageFormat = {
    extension: "webp",
    mimeType: "image/webp",
    quality: 0.9,
};

const renderSettings = {
    renderer: "three.js",
    package: "three-r185",
    version: JSON.parse(fs.readFileSync(path.join(rootDir, "node_modules/three-r185/package.json"), "utf8")).version,
    environment: normalize(domeLight),
    background: "transparent",
    toneMapping: "NoToneMapping",
    outputColorSpace: "SRGBColorSpace",
    environmentMirrorX: false,
    environmentMirrorY: false,
    environmentTextureFlipY: true,
    environmentRotationX: 0,
    environmentRotationY: Math.PI * 1.5,
    environmentRotationZ: 0,
    fieldOfView: 35,
    cameraPadding: 1.12,
    clipping: "near=max(distance*0.001, 0.000001), far=distance+maxExtent*10",
    transparentSort: "world-bounds-depth, far-to-near",
    width: 900,
    height: 760,
    extension: imageFormat.extension,
    imageFormat,
};

function normalize(filePath) {
    return path.resolve(filePath).replaceAll("\\", "/");
}

function parseArgs(argv) {
    const args = {
        filter: null,
        limit: null,
        dryRun: false,
        skipExisting: false,
        startAfter: null,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--filter") args.filter = argv[++i];
        else if (arg === "--limit") args.limit = Number(argv[++i]);
        else if (arg === "--start-after") args.startAfter = argv[++i];
        else if (arg === "--skip-existing") args.skipExisting = true;
        else if (arg === "--dry-run") args.dryRun = true;
        else if (arg === "--help") {
            console.log("Usage: node scripts/render-gltf-references.mjs [--filter Box] [--limit 3] [--skip-existing] [--start-after Asset.glb] [--dry-run]");
            process.exit(0);
        }
        else throw new Error("Unknown argument: " + arg);
    }

    return args;
}

function discoverAssets(filter, limit) {
    const searchRoot = path.join(sourceDir, sourceSubfolder);
    let files = globSync(path.join(searchRoot, "**/glTF-Binary/*.glb")).sort();
    if (files.length === 0) files = globSync(path.join(searchRoot, "**/*.glb")).sort();

    const exclusions = new Set(["2CylinderEngine", "GearboxAssy", "ReciprocatingSaw", "Buggy"]);
    files = files.filter((file) => !exclusions.has(path.parse(file).name));
    if (filter) files = files.filter((file) => path.parse(file).name === filter);
    if (limit) files = files.slice(0, limit);
    return files;
}

async function startViteServer() {
    const port = 5181;
    const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
        cwd: rootDir,
        env: {
            ...process.env,
            CONVERSION_EXPORT_RUNNER: "gltf-reference",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    let ready = false;
    const waitForReady = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for Vite server")), 30000);
        server.stdout.on("data", (data) => {
            const text = data.toString();
            process.stdout.write(text);
            if (!ready && text.includes("Local:")) {
                ready = true;
                clearTimeout(timeout);
                resolve();
            }
        });
        server.stderr.on("data", (data) => process.stderr.write(data.toString()));
        server.on("exit", (code) => {
            if (!ready) reject(new Error("Vite exited before ready: " + code));
        });
    });

    await waitForReady;
    return {
        baseUrl: `https://127.0.0.1:${port}`,
        close() {
            server.kill("SIGTERM");
        },
    };
}

function readProvenance() {
    if (!fs.existsSync(provenancePath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(provenancePath, "utf8"));
}

function writeProvenance(provenance) {
    fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
}

function upsertReferenceRender(provenance, entry) {
    const renders = provenance.sourceReferenceRenders ?? [];
    const index = renders.findIndex((render) => normalize(render.input) === normalize(entry.input));
    if (index >= 0) renders[index] = entry;
    else renders.push(entry);
    provenance.sourceReferenceRenders = renders.sort((a, b) => a.input.localeCompare(b.input));
    provenance.sourceReferenceRenderSettings = renderSettings;
}

function outputFor(input) {
    return input + ".gltf-reference." + imageFormat.extension;
}

function dataUrlToBuffer(dataUrl) {
    const match = /^data:image\/webp;base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error("Renderer did not return a WebP data URL");
    return Buffer.from(match[1], "base64");
}

async function createRenderSession() {
    const vite = await startViteServer();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: renderSettings.width, height: renderSettings.height },
    });
    let page = null;
    let recentPageMessages = [];

    function rememberPageMessage(line) {
        recentPageMessages.push(line);
        if (recentPageMessages.length > 40) recentPageMessages.shift();
    }

    async function getPage() {
        if (!page || page.isClosed()) {
            page = await context.newPage();
            page.on("console", (message) => {
                const line = `[gltf-reference-browser:${message.type()}] ${message.text()}`;
                rememberPageMessage(line);
                if (message.type() === "error" || message.type() === "warning") console.warn(line);
            });
            page.on("pageerror", (error) => {
                const line = `[gltf-reference-browser:pageerror] ${error.stack || error.message}`;
                rememberPageMessage(line);
                console.warn(line);
            });
        }
        if (!page.url().startsWith(vite.baseUrl + "/gltf-reference-renderer")) {
            await page.goto(vite.baseUrl + "/gltf-reference-renderer", { waitUntil: "domcontentloaded" });
        }
        try {
            await page.waitForFunction(() => typeof window.runGltfReferenceRender === "function", { timeout: 30000 });
        }
        catch {
            await page.goto(vite.baseUrl + "/gltf-reference-renderer", { waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => typeof window.runGltfReferenceRender === "function", { timeout: 30000 });
        }
        return page;
    }

    return {
        async render(input) {
            const inputUrl = vite.baseUrl + "/@fs/" + normalize(input);
            const environmentUrl = vite.baseUrl + "/@fs/" + normalize(domeLight);
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    recentPageMessages = [];
                    const rendererPage = await getPage();
                    return await rendererPage.evaluate(async (payload) => {
                        return await window.runGltfReferenceRender(payload);
                    }, {
                        inputUrl,
                        environmentUrl,
                        environmentMirrorX: renderSettings.environmentMirrorX,
                        environmentMirrorY: renderSettings.environmentMirrorY,
                        environmentTextureFlipY: renderSettings.environmentTextureFlipY,
                        environmentRotationX: renderSettings.environmentRotationX,
                        environmentRotationY: renderSettings.environmentRotationY,
                        environmentRotationZ: renderSettings.environmentRotationZ,
                        width: renderSettings.width,
                        height: renderSettings.height,
                        fieldOfView: renderSettings.fieldOfView,
                        cameraPadding: renderSettings.cameraPadding,
                        imageMimeType: imageFormat.mimeType,
                        imageQuality: imageFormat.quality,
                    });
                }
                catch (error) {
                    const suffix = recentPageMessages.length ? "\nRecent glTF reference browser messages:\n" + recentPageMessages.join("\n") : "";
                    lastError = error instanceof Error ? new Error(error.message + suffix, { cause: error }) : new Error(String(error) + suffix);
                    if (page && !page.isClosed()) {
                        await page.reload({ waitUntil: "domcontentloaded" }).catch(async () => {
                            await page?.close().catch(() => {});
                            page = null;
                        });
                    }
                    else {
                        page = null;
                    }
                    if (attempt < 3) console.warn(`[gltf-reference] retrying render in shared browser session (${attempt}/3)`);
                }
            }
            throw lastError ?? new Error("glTF reference render failed");
        },
        async close() {
            await page?.close().catch(() => {});
            await context.close().catch(() => {});
            await browser.close().catch(() => {});
            vite.close();
        },
    };
}

const args = parseArgs(process.argv.slice(2));
let assets = discoverAssets(args.filter, args.limit);

if (args.startAfter) {
    const index = assets.findIndex((asset) => path.basename(asset) === args.startAfter || asset === args.startAfter);
    if (index >= 0) assets = assets.slice(index + 1);
}
if (args.skipExisting) {
    assets = assets.filter((asset) => !fs.existsSync(outputFor(asset)));
}

console.log(`Rendering ${assets.length} glTF reference thumbnail(s).`);

let session = null;
let completed = 0;
let provenance = readProvenance();
provenance.sourceReferenceRenderSettings = renderSettings;

try {
    if (!args.dryRun) session = await createRenderSession();
    for (const input of assets) {
        completed++;
        const output = outputFor(input);
        const label = `${path.basename(input)} (${completed}/${assets.length})`;
        console.log("\n[gltf-reference] " + label);

        if (args.dryRun) {
            console.log(`[dry-run] ${input} -> ${output}`);
            continue;
        }

        try {
            const result = await session.render(input);
            fs.writeFileSync(output, dataUrlToBuffer(result.dataUrl));
            upsertReferenceRender(provenance, {
                input: normalize(input),
                screenshot: normalize(output),
                status: "success",
                renderedAt: new Date().toISOString(),
                settings: renderSettings,
                bounds: result.bounds,
                camera: result.camera,
            });
            writeProvenance(provenance);
        }
        catch (error) {
            upsertReferenceRender(provenance, {
                input: normalize(input),
                screenshot: normalize(output),
                status: "failed",
                renderedAt: new Date().toISOString(),
                settings: renderSettings,
                error: error instanceof Error ? error.message : String(error),
            });
            writeProvenance(provenance);
            throw error;
        }
    }
}
finally {
    await session?.close();
}

console.log(`Rendered ${completed} glTF reference thumbnail(s).`);
