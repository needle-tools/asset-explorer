#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { unflatten } from "devalue";

const hostedBaseUrl = "https://usd-assets.needle.tools/";
const hostedDataUrl = `${hostedBaseUrl}__data.json`;
const outputPath = path.resolve("usd-assets-manifest.json");
const allowedUsdExtensions = new Set([".usd", ".usda", ".usdc", ".usdz"]);

function normalizePath(value) {
    return value.split(path.sep).join("/");
}

function findUsdAssetsRoot() {
    const arg = process.argv.find((entry) => entry.startsWith("--source="));
    const candidates = [
        arg?.slice("--source=".length),
        process.env.USD_WG_ASSETS_DIR,
        path.resolve("../usd-wg-assets"),
        "/Users/herbst/git/usd-wg-assets",
    ].filter(Boolean);

    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (
            fs.existsSync(path.join(resolved, "web/src/lib/files.ts")) &&
            fs.existsSync(path.join(resolved, "test_assets")) &&
            fs.existsSync(path.join(resolved, "full_assets"))
        ) {
            return resolved;
        }
    }

    throw new Error(
        "Could not find usd-wg/assets checkout. Pass --source=/path/to/usd-wg-assets or set USD_WG_ASSETS_DIR.",
    );
}

function displayName(label) {
    if (label === "McUsd") return "McUSD";
    if (label === "USD_Mini_Car_Kit") return "USD Mini Car Kit";
    return label
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
}

function makeSlug(pathname) {
    return "usd-" + pathname.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findMatchingUsdFile(thumbnailPath) {
    const name = path.basename(thumbnailPath, path.extname(thumbnailPath));
    const pathWithUsdFiles = path.resolve(thumbnailPath, "..", "..");
    const matches = globSync(path.join(pathWithUsdFiles, `${name}.*`)).filter((file) =>
        allowedUsdExtensions.has(path.extname(file)),
    );
    return matches[0] ?? "";
}

function itemFromThumbnail(root, thumbnailPath) {
    const usdFile = findMatchingUsdFile(thumbnailPath);
    if (!usdFile) return null;

    const relativeThumbnail = normalizePath(path.relative(root, thumbnailPath));
    const relativeUsd = normalizePath(path.relative(root, usdFile));
    const label = path.basename(usdFile, path.extname(usdFile));
    const routePath = normalizePath(path.join(path.dirname(relativeUsd), label));
    const parts = routePath.split("/");
    const top = parts[0];
    const subcategoryParts = parts.slice(1, -1);

    return {
        slug: makeSlug(routePath),
        source: "usd-wg/assets",
        collection: top,
        label,
        name: displayName(label),
        path: routePath,
        usdPath: relativeUsd,
        thumbnailPath: relativeThumbnail,
        categoryPath: ["USD WG Assets", top, ...subcategoryParts],
        thumbnailUri: hostedBaseUrl + relativeThumbnail,
        externalUrl: hostedBaseUrl + routePath,
    };
}

function itemFromUsdAssetsData(item) {
    const routePath = item.path;
    const parts = routePath.split("/");
    const top = parts[0];
    const subcategoryParts = parts.slice(1, -1);

    return {
        slug: makeSlug(routePath),
        source: "usd-wg/assets",
        collection: top,
        label: item.filename,
        name: displayName(item.filename),
        path: routePath,
        usdPath: routePath + item.ext,
        thumbnailPath: item.src,
        categoryPath: ["USD WG Assets", top, ...subcategoryParts],
        thumbnailUri: hostedBaseUrl + item.src,
        externalUrl: hostedBaseUrl + routePath,
        published: true,
    };
}

function collectUsdAssets(root) {
    const thumbnails = [
        ...globSync(path.join(root, "test_assets/**/thumbnails/*.png")),
        ...globSync(path.join(root, "full_assets/**/thumbnails/*.png")),
    ];

    return thumbnails
        .map((thumbnailPath) => itemFromThumbnail(root, thumbnailPath))
        .filter(Boolean)
        .sort((a, b) => a.path.localeCompare(b.path));
}

function flattenItems(root) {
    const items = [];
    const walk = (node) => {
        items.push(...(node.items ?? []));
        for (const child of node.children ?? []) walk(child);
    };
    walk(root);
    return items;
}

async function collectPublishedUsdAssets() {
    const data = await fetch(hostedDataUrl).then((response) => {
        if (!response.ok) throw new Error(`Could not fetch ${hostedDataUrl}: ${response.status}`);
        return response.json();
    });
    const layoutNode = data.nodes?.find((node) => node?.type === "data" && Array.isArray(node.data));
    if (!layoutNode) throw new Error(`Could not find SvelteKit data node in ${hostedDataUrl}`);

    const payload = unflatten(layoutNode.data);
    return flattenItems(payload.posts)
        .map(itemFromUsdAssetsData)
        .sort((a, b) => a.path.localeCompare(b.path));
}

let sourceRoot = null;
let localAssets = [];
try {
    sourceRoot = findUsdAssetsRoot();
    localAssets = collectUsdAssets(sourceRoot);
}
catch (error) {
    console.warn(error.message);
}

let assets;
let sourceType;
if (process.argv.includes("--local")) {
    if (!localAssets.length) throw new Error("Local USD-WG asset scan produced no assets.");
    assets = localAssets;
    sourceType = "local-usd-wg-assets-getFiles-compatible-scan";
}
else {
    try {
        assets = await collectPublishedUsdAssets();
        sourceType = "hosted-usd-assets-sveltekit-data";
    }
    catch (error) {
        console.warn(`${error.message}; falling back to local USD-WG asset scan.`);
        if (!localAssets.length) throw error;
        assets = localAssets;
        sourceType = "local-usd-wg-assets-getFiles-compatible-scan";
    }
}

const localOnly = sourceRoot
    ? localAssets.filter((asset) => !assets.some((published) => published.path === asset.path))
    : [];

if (!assets.some((asset) => asset.path === "full_assets/Kitchen_set/Kitchen_set")) {
    assets.push({
        slug: "usd-full-assets-kitchen-set-kitchen-set",
        source: "needle-cloud",
        collection: "full_assets",
        label: "Kitchen_set",
        name: "Kitchen Set",
        subheadline: "Hosted on Needle Cloud",
        path: "full_assets/Kitchen_set/Kitchen_set",
        usdPath: "full_assets/Kitchen_set/Kitchen_set.usd",
        thumbnailPath: null,
        categoryPath: ["USD WG Assets", "full_assets", "Kitchen_set"],
        thumbnailUri: null,
        externalUrl: "https://cloud.needle.tools/",
        notes: "Present in the local usd-wg/assets checkout, but not discovered by the USD-WG web catalog until a matching thumbnails/Kitchen_set.png exists.",
    });
}

const outputAssets = assets.sort((a, b) => a.path.localeCompare(b.path));
const output = {
    generatedAt: new Date().toISOString(),
    source: {
        type: sourceType,
        hostedDataUrl,
        root: sourceRoot,
        webSource: sourceRoot ? normalizePath(path.join(sourceRoot, "web/src/lib/files.ts")) : null,
        hostedBaseUrl,
        discovery: [
            "test_assets/**/thumbnails/*.png",
            "full_assets/**/thumbnails/*.png",
            "matching USD file two directories above thumbnail with same basename",
        ],
        localComparison: sourceRoot ? {
            localGetFilesCompatibleCount: localAssets.length,
            localOnlyCount: localOnly.length,
            localOnlyPaths: localOnly.map((asset) => asset.path),
        } : null,
    },
    counts: {
        total: outputAssets.length,
        test_assets: outputAssets.filter((asset) => asset.collection === "test_assets").length,
        full_assets: outputAssets.filter((asset) => asset.collection === "full_assets").length,
    },
    assets: outputAssets,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote ${outputPath}: ${output.counts.total} USD assets from ${sourceRoot}`);
