#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { globSync } from "glob";
import { chromium } from "playwright";
import { conversionFamilies, activeConversionFamilies } from "../src/conversionFamilies.ts";
import { createThumbnailSettings, generatedThumbnailPath, nativeUsdEnv, renderUsdThumbnail } from "./lib/usd-thumbnail.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleAssetsDir = path.join(rootDir, "submodules/glTF-Sample-Assets");
const legacyModelsDir = path.join(rootDir, "submodules/glTF-Sample-Models");
const sourceDir = fs.existsSync(path.join(sampleAssetsDir, "Models")) ? sampleAssetsDir : legacyModelsDir;
const sourceSubfolder = sourceDir === sampleAssetsDir ? "Models" : "2.0";
const provenancePath = path.join(sourceDir, "conversion-provenance.json");

const defaults = {
    blender: "/Applications/Blender.app/Contents/MacOS/Blender",
    adobePlugin: "/Users/herbst/USD-Fileformat-plugins-2026.03-openusd-26.05",
    guc: "/Users/herbst/git/guc/build/bin/guc",
    openUsd: "/Users/herbst/OpenUSD-26.05-native",
    domeLight: path.join(rootDir, "src/lib/images/neutral.hdr"),
};

let activeCommandLog = null;

function parseArgs(argv) {
    const args = {
        converters: activeConversionFamilies.map((family) => family.id),
        filter: undefined,
        limit: undefined,
        render: true,
        dryRun: false,
        force: false,
        continueOnError: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--converters") args.converters = argv[++i].split(",").map((x) => x.trim()).filter(Boolean);
        else if (arg === "--filter") args.filter = argv[++i];
        else if (arg === "--limit") args.limit = Number(argv[++i]);
        else if (arg === "--skip-render") args.render = false;
        else if (arg === "--dry-run") args.dryRun = true;
        else if (arg === "--force") args.force = true;
        else if (arg === "--skip-existing") {
            console.warn("[deprecated] --skip-existing is now the default; use --force to rerun up-to-date conversions.");
        }
        else if (arg === "--continue-on-error") args.continueOnError = true;
        else if (arg === "--help") {
            console.log("Usage: npm run conversions -- [--filter Box] [--limit 3] [--converters three-r185,blender-5-1,openusd-adobe-gltf,needle-engine,needle-engine-usdc,guc] [--skip-render] [--force] [--continue-on-error] [--dry-run]");
            process.exit(0);
        }
        else throw new Error("Unknown argument: " + arg);
    }

    return args;
}

function run(command, args, options = {}) {
    const printable = [command, ...args].join(" ");
    activeCommandLog?.push(printable);
    console.log("$ " + printable);
    if (options.dryRun) return;
    const env = { ...process.env, ...options.env };
    for (const key of options.unsetEnv ?? []) delete env[key];
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? rootDir,
        env,
        stdio: "inherit",
        timeout: options.timeoutMs,
    });
    if (result.signal) {
        throw new Error(`Command failed (${result.signal}): ${printable}`);
    }
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error("Command failed: " + printable);
    }
}

function commandOutput(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: rootDir,
        env: { ...process.env, ...options.env },
        encoding: "utf8",
    });
    if (result.status !== 0) return null;
    return result.stdout.trim();
}

function normalize(filePath) {
    return path.resolve(filePath).replaceAll("\\", "/");
}

function parseFilterSet(filter) {
    if (!filter) return null;
    return new Set(filter.split(",").map((value) => value.trim()).filter(Boolean));
}

function discoverAssets(filter, limit) {
    const searchRoot = path.join(sourceDir, sourceSubfolder);
    let files = globSync(path.join(searchRoot, "**/glTF-Binary/*.glb")).sort();
    if (files.length === 0) files = globSync(path.join(searchRoot, "**/*.glb")).sort();

    const exclusions = new Set(["2CylinderEngine", "GearboxAssy", "ReciprocatingSaw", "Buggy", "NodePerformanceTest"]);
    const filters = parseFilterSet(filter);
    files = files.filter((file) => !exclusions.has(path.parse(file).name));
    if (filters) files = files.filter((file) => filters.has(path.parse(file).name));
    if (limit) files = files.slice(0, limit);
    return files;
}

function outputFor(input, family) {
    const usdz = input + "." + family.suffix + ".usdz";
    return {
        usdz,
        screenshot: generatedThumbnailPath(usdz),
    };
}

function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
        return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
}

function settingsEqual(a, b) {
    return stableJson(a ?? null) === stableJson(b ?? null);
}

function conversionSettingsForFamily(family) {
    const base = {
        converter: family.id,
        suffix: family.suffix,
        converterVersion: family.versionLabel,
    };
    if (family.id === "needle-engine" || family.id === "needle-engine-usdc") {
        return {
            ...base,
            runner: "headed Playwright Needle Engine USDZExporter",
            exporter: "USDZExporter",
            autoExportAnimations: true,
            interactive: false,
            allowCreateQuicklookButton: false,
            quickLookCompatible: false,
            geometryBackend: family.id === "needle-engine-usdc" ? "usdc" : "usda",
        };
    }
    if (family.id === "three-r185") {
        return {
            ...base,
            runner: "Playwright Chromium browser three-r185 GLTFLoader + USDZExporter",
            animations: true,
            animationFrameRate: 60,
            maxTextureSize: 4096,
        };
    }
    if (family.id === "blender-5-1") {
        return {
            ...base,
            blender: defaults.blender,
            exportTextures: true,
            convertWorldMaterial: false,
        };
    }
    if (family.id === "openusd-adobe-gltf") {
        return {
            ...base,
            openUsd: defaults.openUsd,
            adobePlugin: defaults.adobePlugin,
            assetsPath: true,
            transcodeWebpAssetsToPng: true,
        };
    }
    if (family.id === "guc") {
        return {
            ...base,
            guc: process.env.GUC_BIN || defaults.guc,
        };
    }
    return base;
}

function legacyConversionSettingsAreCurrent(existing, family) {
    // Provenance before conversionSettings was added was generated with the current
    // settings for all active converters except Needle, whose QuickLook mode is
    // intentionally changing in this update.
    return !existing?.conversionSettings && family.id !== "needle-engine" && family.id !== "needle-engine-usdc";
}

function conversionIsCurrent(existing, family, conversionSettings, output) {
    if (!existing || existing.status !== "success") return false;
    if (!fs.existsSync(output.usdz)) return false;
    if (existing.conversionSettings) return settingsEqual(existing.conversionSettings, conversionSettings);
    return legacyConversionSettingsAreCurrent(existing, family);
}

function thumbnailIsCurrent(existing, thumbnailSettings, output, render) {
    if (!render) return true;
    if (!fs.existsSync(output.screenshot)) return false;
    if (!existing?.thumbnailSettings) return false;
    return settingsEqual(existing.thumbnailSettings, thumbnailSettings);
}

async function convertThreeR185(input, output, dryRun, threeR185Session) {
    activeCommandLog?.push("Playwright browser three-r185 GLTFLoader + USDZExporter.parseAsync animations=true maxTextureSize=4096 " + input + " " + output);
    if (dryRun) {
        console.log(`[dry-run] three-r185 ${input} -> ${output}`);
        return;
    }
    if (!threeR185Session) throw new Error("three r185 session was not initialized");
    await threeR185Session.exportUsdz(input, output);
}

function convertBlender(input, output, dryRun) {
    activeCommandLog?.push("Blender USD export generate_preview_surface=true relative_paths=true export_animation=true export_textures=true convert_world_material=false " + input + " " + output);
    run(defaults.blender, [
        "--factory-startup",
        "-b",
        "-P", "blender/blender_gltf_converter.py",
        "--",
        "--model-path", input,
        "--output-path", output,
    ], { dryRun, unsetEnv: ["PXR_PLUGINPATH_NAME", "DYLD_LIBRARY_PATH"] });
}

function adobeEnv() {
    return {
        PXR_PLUGINPATH_NAME: path.join(defaults.adobePlugin, "plugin/usd"),
        DYLD_LIBRARY_PATH: path.join(defaults.adobePlugin, "lib") + (process.env.DYLD_LIBRARY_PATH ? ":" + process.env.DYLD_LIBRARY_PATH : ""),
    };
}

function convertAdobe(input, output, dryRun) {
    const tempDir = output.replace(/\.usdz$/i, ".openusd-adobe-gltf-tmp");
    const tempUsdName = path.basename(output).replace(/\.usdz$/i, ".usdc");
    const tempUsd = path.join(tempDir, tempUsdName);
    const inputWithArgs = `${input}:SDF_FORMAT_ARGS:assetsPath=${tempDir}`;

    if (!dryRun) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
        run("usdcat", [inputWithArgs, "-o", tempUsd], { dryRun, env: adobeEnv() });
        transcodeAdobeWebpAssets(tempDir, tempUsd, dryRun);
        const packageFiles = dryRun
            ? [tempUsd]
            : [
                tempUsd,
                ...globSync(path.join(tempDir, "**/*"), { nodir: true })
                    .filter((file) => path.resolve(file) !== path.resolve(tempUsd))
                    .sort(),
            ];
        run("usdzip", ["-r", output, ...packageFiles.map((file) => path.relative(tempDir, file))], {
            dryRun,
            env: adobeEnv(),
            cwd: tempDir,
        });
    }
    finally {
        if (!dryRun) fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

function transcodeAdobeWebpAssets(tempDir, tempUsd, dryRun) {
    const webpFiles = dryRun ? [] : globSync(path.join(tempDir, "**/*.webp"), { nodir: true }).sort();
    if (webpFiles.length === 0) return;

    const replacements = new Map();
    for (const webpFile of webpFiles) {
        const pngFile = webpFile.replace(/\.webp$/i, ".png");
        run("sips", ["-s", "format", "png", webpFile, "--out", pngFile], { dryRun });
        replacements.set(path.relative(tempDir, webpFile).replaceAll("\\", "/"), path.relative(tempDir, pngFile).replaceAll("\\", "/"));
        if (!dryRun) fs.rmSync(webpFile);
    }

    const tempUsda = tempUsd.replace(/\.usdc$/i, ".rewrite.usda");
    run("usdcat", [tempUsd, "-o", tempUsda], { dryRun, env: adobeEnv() });
    if (!dryRun) {
        let layerText = fs.readFileSync(tempUsda, "utf8");
        for (const [from, to] of replacements) {
            layerText = layerText.split(from).join(to);
        }
        fs.writeFileSync(tempUsda, layerText);
    }
    run("usdcat", [tempUsda, "-o", tempUsd], { dryRun, env: adobeEnv() });
    if (!dryRun) fs.rmSync(tempUsda);
}

function convertGuc(input, output, dryRun) {
    const guc = process.env.GUC_BIN || (fs.existsSync(defaults.guc) ? defaults.guc : commandOutput("which", ["guc"]));
    if (!guc) throw new Error("GUC converter not found. Set GUC_BIN or add guc to PATH.");
    run(guc, [input, output], {
        dryRun,
        env: nativeUsdEnv(defaults.openUsd),
    });
}

async function startViteServer(exportRunner) {
    const ports = {
        "needle-engine": 5179,
        "three-r185": 5180,
    };
    const port = ports[exportRunner] ?? 5179;
    const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
        cwd: rootDir,
        env: {
            ...process.env,
            CONVERSION_EXPORT_RUNNER: exportRunner,
            ...(exportRunner === "needle-engine" ? { NEEDLE_EXPORT_RUNNER: "1" } : {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    let ready = false;
    const waitForReady = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for Vite server")), 30000);
        const onData = (data) => {
            const text = data.toString();
            process.stdout.write(text);
            if (!ready && text.includes("Local:")) {
                ready = true;
                clearTimeout(timeout);
                resolve();
            }
        };
        server.stdout.on("data", onData);
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

async function createNeedleSession() {
    const vite = await startViteServer("needle-engine");
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true });
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
                const line = `[needle-browser:${message.type()}] ${message.text()}`;
                rememberPageMessage(line);
                if (message.type() === "error" || message.type() === "warning") console.warn(line);
            });
            page.on("pageerror", (error) => {
                const line = `[needle-browser:pageerror] ${error.stack || error.message}`;
                rememberPageMessage(line);
                console.warn(line);
            });
        }
        if (!page.url().startsWith(vite.baseUrl + "/needle-exporter")) {
            await page.goto(vite.baseUrl + "/needle-exporter", { waitUntil: "domcontentloaded" });
        }
        try {
            await page.waitForFunction(() => typeof window.runNeedleUsdzExport === "function", { timeout: 30000 });
        }
        catch {
            await page.goto(vite.baseUrl + "/needle-exporter", { waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => typeof window.runNeedleUsdzExport === "function", { timeout: 30000 });
        }
        await page.waitForTimeout(500);
        return page;
    }

    return {
        async exportUsdz(input, output, geometryBackend = "usda") {
            const inputUrl = vite.baseUrl + "/@fs/" + normalize(input);
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    recentPageMessages = [];
                    const exporterPage = await getPage();
                    const [download] = await Promise.all([
                        exporterPage.waitForEvent("download", { timeout: 300000 }),
                        exporterPage.evaluate(async (payload) => {
                            return await window.runNeedleUsdzExport(payload);
                        }, {
                            inputUrl,
                            fileName: path.basename(output),
                            quickLookCompatible: false,
                            geometryBackend,
                        }),
                    ]);
                    await download.saveAs(output);
                    return;
                }
                catch (error) {
                    const suffix = recentPageMessages.length ? "\nRecent Needle browser messages:\n" + recentPageMessages.join("\n") : "";
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
                    if (attempt < 3) {
                        console.warn(`[needle-engine] retrying export in shared browser session (${attempt}/3)`);
                    }
                }
            }
            throw lastError ?? new Error("Needle export failed");
        },
        async close() {
            await page?.close().catch(() => {});
            await context.close().catch(() => {});
            await browser.close().catch(() => {});
            vite.close();
        },
    };
}

async function createThreeR185Session() {
    const vite = await startViteServer("three-r185");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true });
    let page = null;
    let recentPageMessages = [];
    const printedMessageCounts = new Map();

    function rememberPageMessage(line) {
        recentPageMessages.push(line);
        if (recentPageMessages.length > 40) recentPageMessages.shift();
    }

    function printPageMessage(line) {
        const count = (printedMessageCounts.get(line) ?? 0) + 1;
        printedMessageCounts.set(line, count);
        if (count <= 3) {
            console.warn(line);
        }
        else if (count === 4) {
            console.warn(line + " (repeated; suppressing further identical messages)");
        }
    }

    async function getPage() {
        if (!page || page.isClosed()) {
            page = await context.newPage();
            page.on("console", (message) => {
                const line = `[three-r185-browser:${message.type()}] ${message.text()}`;
                rememberPageMessage(line);
                if (message.type() === "error" || message.type() === "warning") printPageMessage(line);
            });
            page.on("pageerror", (error) => {
                const line = `[three-r185-browser:pageerror] ${error.stack || error.message}`;
                rememberPageMessage(line);
                console.warn(line);
            });
        }
        if (!page.url().startsWith(vite.baseUrl + "/three-r185-exporter")) {
            await page.goto(vite.baseUrl + "/three-r185-exporter", { waitUntil: "domcontentloaded" });
        }
        try {
            await page.waitForFunction(() => typeof window.runThreeR185UsdzExport === "function", { timeout: 30000 });
        }
        catch {
            await page.goto(vite.baseUrl + "/three-r185-exporter", { waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => typeof window.runThreeR185UsdzExport === "function", { timeout: 30000 });
        }
        await page.waitForTimeout(250);
        return page;
    }

    return {
        async exportUsdz(input, output) {
            const inputUrl = vite.baseUrl + "/@fs/" + normalize(input);
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    recentPageMessages = [];
                    const exporterPage = await getPage();
                    const [download] = await Promise.all([
                        exporterPage.waitForEvent("download", { timeout: 300000 }),
                        exporterPage.evaluate(async (payload) => {
                            return await window.runThreeR185UsdzExport(payload);
                        }, { inputUrl, fileName: path.basename(output) }),
                    ]);
                    await download.saveAs(output);
                    return;
                }
                catch (error) {
                    const suffix = recentPageMessages.length ? "\nRecent three r185 browser messages:\n" + recentPageMessages.join("\n") : "";
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
                    if (attempt < 3) {
                        console.warn(`[three-r185] retrying export in shared browser session (${attempt}/3)`);
                    }
                }
            }
            throw lastError ?? new Error("three r185 export failed");
        },
        async close() {
            await page?.close().catch(() => {});
            await context.close().catch(() => {});
            await browser.close().catch(() => {});
            vite.close();
        },
    };
}

async function convertNeedle(input, output, dryRun, needleSession, geometryBackend) {
    activeCommandLog?.push(`headed Playwright Needle Engine USDZExporter.export autoExportAnimations=true quickLookCompatible=false geometryBackend=${geometryBackend} ${input} ${output}`);
    if (dryRun) {
        console.log(`[dry-run] needle-engine ${geometryBackend} ${input} -> ${output}`);
        return;
    }
    if (!needleSession) throw new Error("Needle session was not initialized");
    await needleSession.exportUsdz(input, output, geometryBackend);
}

function renderThumbnail(input, screenshot, dryRun) {
    return renderUsdThumbnail({
        usdzPath: input,
        screenshotPath: screenshot,
        rootDir,
        openUsd: defaults.openUsd,
        domeLight: defaults.domeLight,
        dryRun,
        onCommand: (command) => activeCommandLog?.push(command),
    });
}

function checkUsd(input, dryRun) {
    run("usdchecker", [input], { dryRun, env: nativeUsdEnv(defaults.openUsd), timeoutMs: 300000 });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const families = args.converters.map((id) => {
        const family = conversionFamilies.find((candidate) => candidate.id === id);
        if (!family) throw new Error("Unknown converter: " + id);
        return family;
    });
    const assets = discoverAssets(args.filter, args.limit);
    const replacementKeys = new Set(assets.flatMap((input) => {
        const normalizedInput = normalize(input);
        return families.map((family) => `${normalizedInput}|${family.id}`);
    }));
    const previousProvenance = fs.existsSync(provenancePath)
        ? JSON.parse(fs.readFileSync(provenancePath, "utf8"))
        : null;
    const preservedConversions = (previousProvenance?.conversions ?? []).filter((conversion) => {
        return !replacementKeys.has(`${normalize(conversion.input)}|${conversion.converter}`);
    });
    const preservedFailures = (previousProvenance?.failures ?? []).filter((conversion) => {
        return !replacementKeys.has(`${normalize(conversion.input)}|${conversion.converter}`);
    });
    const previousConversionByKey = new Map((previousProvenance?.conversions ?? []).map((conversion) => {
        return [`${normalize(conversion.input)}|${conversion.converter}`, conversion];
    }));
    const gucBin = process.env.GUC_BIN || (fs.existsSync(defaults.guc) ? defaults.guc : commandOutput("which", ["guc"]));
    const gucSourceDir = path.resolve(path.dirname(defaults.guc), "../..");
    const thumbnailSettings = createThumbnailSettings({ domeLight: defaults.domeLight });
    const provenance = {
        ...(previousProvenance ?? {}),
        generatedAt: new Date().toISOString(),
        source: {
            directory: normalize(sourceDir),
            repository: sourceDir === sampleAssetsDir ? "https://github.com/KhronosGroup/glTF-Sample-Assets" : "https://github.com/KhronosGroup/glTF-Sample-Models",
            commit: commandOutput("git", ["-C", sourceDir, "rev-parse", "HEAD"]),
        },
        thumbnailSettings,
        tools: {
            blender: {
                path: defaults.blender,
                version: commandOutput(defaults.blender, ["--version"])?.split("\n")[0] ?? null,
            },
            openusd: {
                path: defaults.openUsd,
                version: "26.05",
            },
            adobeGltfPlugin: {
                path: defaults.adobePlugin,
                version: "2026.03",
            },
            threeR185: {
                package: "three-r185",
                version: commandOutput("node", ["-e", "console.log(require('./node_modules/three-r185/package.json').version)"]),
                runtime: "Playwright Chromium browser export page",
                exporter: "USDZExporter",
                animations: true,
                animationFrameRate: 60,
                maxTextureSize: 4096,
            },
            needleEngine: {
                package: "needle-engine-latest",
                version: commandOutput("node", ["-e", "console.log(require('./node_modules/needle-engine-latest/package.json').version)"]),
                exporter: "USDZExporter",
                autoExportAnimations: true,
                quickLookCompatible: false,
            },
            guc: {
                path: gucBin,
                version: gucBin ? commandOutput(gucBin, ["--help"], { env: nativeUsdEnv(defaults.openUsd) })?.split("\n")[0] ?? null : null,
                sourceCommit: fs.existsSync(gucSourceDir) ? commandOutput("git", ["-C", gucSourceDir, "rev-parse", "HEAD"]) : null,
            },
        },
        conversions: preservedConversions,
        failures: preservedFailures,
    };
    const runFailures = [];

    console.log(`Assets: ${assets.length}`);
    console.log(`Converters: ${families.map((family) => family.id).join(", ")}`);
    const writeProvenance = () => {
        if (!args.dryRun) {
            fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
        }
    };
    let needleSession = null;
    let threeR185Session = null;
    const getNeedleSession = async () => {
        if (!needleSession) needleSession = await createNeedleSession();
        return needleSession;
    };
    const getThreeR185Session = async () => {
        if (!threeR185Session) threeR185Session = await createThreeR185Session();
        return threeR185Session;
    };

    try {
        for (const input of assets) {
            for (const family of families) {
                const output = outputFor(input, family);
                const conversionSettings = conversionSettingsForFamily(family);
                const previousConversion = previousConversionByKey.get(`${normalize(input)}|${family.id}`) ?? null;
                const commands = [];
                activeCommandLog = commands;
                let skipped = false;
                console.log(`\n[${family.id}] ${path.basename(input)}`);
                try {
                    const conversionCurrent = !args.force && conversionIsCurrent(previousConversion, family, conversionSettings, output);
                    const thumbnailCurrent = thumbnailIsCurrent(previousConversion, thumbnailSettings, output, args.render);
                    if (conversionCurrent && thumbnailCurrent) {
                        skipped = true;
                        commands.push("skip: conversion and thumbnail are up to date");
                        console.log(`[skip-current] ${path.basename(output.usdz)}`);
                        provenance.conversions.push({
                            ...previousConversion,
                            skipped,
                            skipReason: "up-to-date",
                            commands,
                            conversionSettings,
                        });
                        continue;
                    }
                    if (conversionCurrent) {
                        skipped = true;
                        commands.push("skip: conversion is up to date; regenerating thumbnail");
                        console.log(`[skip-conversion] ${path.basename(output.usdz)}`);
                    }
                    else if (family.id === "three-r185") await convertThreeR185(input, output.usdz, args.dryRun, args.dryRun ? null : await getThreeR185Session());
                    else if (family.id === "blender-5-1") convertBlender(input, output.usdz, args.dryRun);
                    else if (family.id === "openusd-adobe-gltf") convertAdobe(input, output.usdz, args.dryRun);
                    else if (family.id === "needle-engine" || family.id === "needle-engine-usdc") await convertNeedle(input, output.usdz, args.dryRun, args.dryRun ? null : await getNeedleSession(), family.id === "needle-engine-usdc" ? "usdc" : "usda");
                    else if (family.id === "guc") convertGuc(input, output.usdz, args.dryRun);
                    else throw new Error("Converter is display-only or not runnable here: " + family.id);

                    if (!fs.existsSync(output.usdz) && !args.dryRun) {
                        throw new Error("Conversion did not create " + output.usdz);
                    }

                    checkUsd(output.usdz, args.dryRun);
                    if (args.render && (!thumbnailCurrent || !conversionCurrent)) renderThumbnail(output.usdz, output.screenshot, args.dryRun);
                    provenance.conversions.push({
                        input: normalize(input),
                        converter: family.id,
                        converterVersion: family.versionLabel,
                        suffix: family.suffix,
                        status: "success",
                        skipped,
                        usdz: normalize(output.usdz),
                        screenshot: args.render ? normalize(output.screenshot) : null,
                        conversionSettings,
                        commands,
                        thumbnailSettings: args.render ? thumbnailSettings : null,
                    });
                }
                catch (error) {
                    const failure = {
                        input: normalize(input),
                        converter: family.id,
                        converterVersion: family.versionLabel,
                        suffix: family.suffix,
                        status: "failed",
                        usdz: normalize(output.usdz),
                        screenshot: args.render ? normalize(output.screenshot) : null,
                        conversionSettings,
                        commands,
                        error: error instanceof Error ? error.message : String(error),
                    };
                    provenance.conversions.push(failure);
                    provenance.failures.push(failure);
                    runFailures.push(failure);
                    if (!args.continueOnError) throw error;
                    console.error(`[failed] ${family.id} ${input}: ${failure.error}`);
                }
                finally {
                    activeCommandLog = null;
                    writeProvenance();
                }
            }
        }
    }
    finally {
        await threeR185Session?.close();
        await needleSession?.close();
    }

    writeProvenance();
    if (runFailures.length > 0) {
        throw new Error(`${runFailures.length} conversion(s) failed in this run. See ${provenancePath}.`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
