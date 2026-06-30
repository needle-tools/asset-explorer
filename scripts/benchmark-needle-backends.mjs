#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { globSync } from "glob";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleAssetsDir = path.join(rootDir, "submodules/glTF-Sample-Assets");
const legacyModelsDir = path.join(rootDir, "submodules/glTF-Sample-Models");
const sourceDir = fs.existsSync(path.join(sampleAssetsDir, "Models")) ? sampleAssetsDir : legacyModelsDir;
const sourceSubfolder = sourceDir === sampleAssetsDir ? "Models" : "2.0";
const defaultOutput = path.join(sourceDir, "needle-backend-benchmark.json");
const defaultTempDir = path.join(sourceDir, ".needle-backend-benchmark");

function parseArgs(argv) {
    const args = {
        filter: "BoxAnimated,CesiumMan,RiggedSimple,TextureSettingsTest,TransmissionRoughnessTest",
        limit: undefined,
        repeat: 1,
        output: defaultOutput,
        tempDir: defaultTempDir,
        headless: true,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--filter") args.filter = argv[++i];
        else if (arg === "--limit") args.limit = Number(argv[++i]);
        else if (arg === "--repeat") args.repeat = Number(argv[++i]);
        else if (arg === "--output") args.output = argv[++i];
        else if (arg === "--temp-dir") args.tempDir = argv[++i];
        else if (arg === "--headed") args.headless = false;
        else if (arg === "--help") {
            console.log("Usage: npm run benchmark:needle-backends -- [--filter BoxAnimated,CesiumMan] [--limit 10] [--repeat 2] [--headed]");
            process.exit(0);
        }
        else throw new Error("Unknown argument: " + arg);
    }
    return args;
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

function normalize(filePath) {
    return path.resolve(filePath).replaceAll("\\", "/");
}

function processSetRssMb(pids) {
    if (pids.length === 0) return 0;
    const result = spawnSync("ps", ["-o", "rss=", "-p", pids.join(",")], { encoding: "utf8" });
    if (result.status !== 0) return 0;
    const rssKb = result.stdout.trim()
        .split(/\s+/)
        .map((value) => Number(value))
        .filter(Boolean)
        .reduce((sum, value) => sum + value, 0);
    return rssKb / 1024;
}

async function startViteServer() {
    const port = 5179;
    const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
        cwd: rootDir,
        env: {
            ...process.env,
            CONVERSION_EXPORT_RUNNER: "needle-engine",
            NEEDLE_EXPORT_RUNNER: "1",
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

async function readHeapMetric(cdpSession) {
    const metrics = await cdpSession.send("Performance.getMetrics");
    const byName = new Map(metrics.metrics.map((metric) => [metric.name, metric.value]));
    return {
        jsHeapUsedMb: (byName.get("JSHeapUsedSize") ?? 0) / 1024 / 1024,
        jsHeapTotalMb: (byName.get("JSHeapTotalSize") ?? 0) / 1024 / 1024,
    };
}

async function readBrowserRssMb(browserSession) {
    const info = await browserSession.send("SystemInfo.getProcessInfo");
    const pids = info.processInfo
        .map((process) => Number(process.id))
        .filter(Boolean);
    return processSetRssMb(pids);
}

async function runExport(vite, input, backend, args, iteration) {
    const browser = await chromium.launch({ headless: args.headless });
    const browserSession = await browser.newBrowserCDPSession();
    const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true });
    const page = await context.newPage();
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send("Performance.enable");

    const messages = [];
    page.on("console", (message) => {
        const line = `[needle-browser:${message.type()}] ${message.text()}`;
        messages.push(line);
        if (message.type() === "error" || message.type() === "warning") console.warn(line);
    });
    page.on("pageerror", (error) => messages.push(`[needle-browser:pageerror] ${error.stack || error.message}`));

    const outputDir = path.resolve(args.tempDir);
    fs.mkdirSync(outputDir, { recursive: true });
    const output = path.join(outputDir, `${path.parse(input).name}.${backend}.${iteration}.usdz`);
    const inputUrl = vite.baseUrl + "/@fs/" + normalize(input);

    let peakRssMb = 0;
    const rssSamples = [];
    let rssSampling = false;
    const rssTimer = setInterval(async () => {
        if (rssSampling) return;
        rssSampling = true;
        const rssMb = await readBrowserRssMb(browserSession).catch(() => 0);
        if (rssMb > peakRssMb) peakRssMb = rssMb;
        rssSamples.push(rssMb);
        rssSampling = false;
    }, 100);

    try {
        await page.goto(vite.baseUrl + "/needle-exporter", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => typeof window.runNeedleUsdzExport === "function", { timeout: 30000 });
        await page.waitForTimeout(500);
        const beforeHeap = await readHeapMetric(cdpSession);
        const beforeRssMb = await readBrowserRssMb(browserSession);
        const start = performance.now();
        const [download, result] = await Promise.all([
            page.waitForEvent("download", { timeout: 300000 }),
            page.evaluate(async (payload) => {
                return await window.runNeedleUsdzExport(payload);
            }, {
                inputUrl,
                fileName: path.basename(output),
                quickLookCompatible: false,
                geometryBackend: backend,
            }),
        ]);
        await download.saveAs(output);
        const durationMs = performance.now() - start;
        const afterHeap = await readHeapMetric(cdpSession);
        const afterRssMb = await readBrowserRssMb(browserSession);
        return {
            asset: path.parse(input).name,
            input: normalize(input),
            backend,
            iteration,
            output: normalize(output),
            bytes: result?.bytes ?? fs.statSync(output).size,
            durationMs,
            beforeRssMb,
            afterRssMb,
            peakRssMb: Math.max(peakRssMb, beforeRssMb, afterRssMb),
            rssSampleCount: rssSamples.length,
            beforeHeap,
            afterHeap,
            messages: messages.slice(-20),
        };
    }
    finally {
        clearInterval(rssTimer);
        await browserSession.detach().catch(() => {});
        await cdpSession.detach().catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

function summarize(results) {
    const groups = new Map();
    for (const result of results) {
        const key = result.asset;
        if (!groups.has(key)) groups.set(key, {});
        const group = groups.get(key);
        if (!group[result.backend]) group[result.backend] = [];
        group[result.backend].push(result);
    }

    const avg = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const summary = [];
    for (const [asset, group] of groups) {
        if (!group.usda || !group.usdc) continue;
        const usdaDuration = avg(group.usda.map((result) => result.durationMs));
        const usdcDuration = avg(group.usdc.map((result) => result.durationMs));
        const usdaPeakRss = avg(group.usda.map((result) => result.peakRssMb));
        const usdcPeakRss = avg(group.usdc.map((result) => result.peakRssMb));
        const usdaHeap = avg(group.usda.map((result) => result.afterHeap.jsHeapUsedMb));
        const usdcHeap = avg(group.usdc.map((result) => result.afterHeap.jsHeapUsedMb));
        summary.push({
            asset,
            usdaDurationMs: usdaDuration,
            usdcDurationMs: usdcDuration,
            durationRatio: usdcDuration / usdaDuration,
            usdaPeakRssMb: usdaPeakRss,
            usdcPeakRssMb: usdcPeakRss,
            peakRssRatio: usdcPeakRss / usdaPeakRss,
            usdaAfterHeapMb: usdaHeap,
            usdcAfterHeapMb: usdcHeap,
            heapRatio: usdcHeap / usdaHeap,
            usdcFaster: usdcDuration < usdaDuration,
            usdcLowerPeakRss: usdcPeakRss < usdaPeakRss,
        });
    }
    return summary;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const assets = discoverAssets(args.filter, args.limit);
    const vite = await startViteServer();
    const results = [];

    try {
        for (const input of assets) {
            for (let iteration = 1; iteration <= args.repeat; iteration++) {
                for (const backend of ["usda", "usdc"]) {
                    console.log(`[benchmark] ${path.parse(input).name} ${backend} ${iteration}/${args.repeat}`);
                    const result = await runExport(vite, input, backend, args, iteration);
                    results.push(result);
                    console.log(
                        `  ${Math.round(result.durationMs)}ms peakRSS=${result.peakRssMb.toFixed(1)}MB `
                        + `heap=${result.afterHeap.jsHeapUsedMb.toFixed(1)}MB bytes=${result.bytes}`,
                    );
                }
            }
        }
    }
    finally {
        vite.close();
    }

    const output = {
        generatedAt: new Date().toISOString(),
        schemaVersion: 1,
        source: { directory: normalize(sourceDir) },
        settings: {
            filter: args.filter,
            limit: args.limit ?? null,
            repeat: args.repeat,
            needleEnginePackageRoot: process.env.NEEDLE_ENGINE_PACKAGE_ROOT ?? null,
        },
        results,
        summary: summarize(results),
    };
    fs.writeFileSync(args.output, JSON.stringify(output, null, 2) + "\n");
    console.log(`[benchmark] wrote ${args.output}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
