#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createThumbnailSettings, generatedThumbnailPath, normalize, renderUsdThumbnail } from "./lib/usd-thumbnail.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleAssetsDir = path.join(rootDir, "submodules/glTF-Sample-Assets");
const legacyModelsDir = path.join(rootDir, "submodules/glTF-Sample-Models");
const sourceDir = fs.existsSync(path.join(sampleAssetsDir, "Models")) ? sampleAssetsDir : legacyModelsDir;
const provenancePath = path.join(sourceDir, "conversion-provenance.json");
const domeLight = path.join(rootDir, "src/lib/images/neutral.hdr");
const openUsd = "/Users/herbst/OpenUSD-26.05-native";
const thumbnailSettings = createThumbnailSettings({ domeLight });

function parseArgs(argv) {
    const args = {
        converters: null,
        filter: null,
        limit: null,
        dryRun: false,
        startAfter: null,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--converters") args.converters = argv[++i].split(",").map((value) => value.trim()).filter(Boolean);
        else if (arg === "--filter") args.filter = argv[++i];
        else if (arg === "--limit") args.limit = Number(argv[++i]);
        else if (arg === "--start-after") args.startAfter = argv[++i];
        else if (arg === "--dry-run") args.dryRun = true;
        else if (arg === "--help") {
            console.log("Usage: node scripts/render-thumbnails.mjs [--filter Box] [--limit 3] [--converters three-r185,blender-5-1] [--start-after Asset.glb.converter.usdz] [--dry-run]");
            process.exit(0);
        }
        else throw new Error("Unknown argument: " + arg);
    }

    return args;
}

function renderThumbnail(conversion, dryRun) {
    return renderUsdThumbnail({
        usdzPath: conversion.usdz,
        screenshotPath: generatedThumbnailPath(conversion.usdz),
        rootDir,
        openUsd,
        domeLight,
        dryRun,
    });
}

function matchesArgs(conversion, args) {
    if (args.converters && !args.converters.includes(conversion.converter)) return false;
    if (args.filter && path.basename(conversion.input, ".glb") !== args.filter) return false;
    return conversion.status === "success" && conversion.usdz && fs.existsSync(conversion.usdz);
}

const args = parseArgs(process.argv.slice(2));
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
let conversions = provenance.conversions.filter((conversion) => matchesArgs(conversion, args));

if (args.startAfter) {
    const index = conversions.findIndex((conversion) => path.basename(conversion.usdz) === args.startAfter || conversion.usdz === args.startAfter);
    if (index >= 0) conversions = conversions.slice(index + 1);
}
if (args.limit) conversions = conversions.slice(0, args.limit);

provenance.thumbnailSettings = thumbnailSettings;
console.log(`Rendering ${conversions.length} thumbnails from ${provenancePath}`);

let completed = 0;
for (const conversion of conversions) {
    completed++;
    const label = `${path.basename(conversion.usdz)} (${completed}/${conversions.length})`;
    console.log("\n[thumbnail] " + label);

    try {
        const { screenshotPath, commands } = renderThumbnail(conversion, args.dryRun);
        conversion.screenshot = normalize(screenshotPath);
        conversion.thumbnailStatus = "success";
        conversion.thumbnailRenderedAt = new Date().toISOString();
        conversion.thumbnailSettings = thumbnailSettings;
        conversion.thumbnailCommands = commands;
        delete conversion.thumbnailError;
    }
    catch (error) {
        conversion.thumbnailStatus = "failed";
        conversion.thumbnailError = error instanceof Error ? error.message : String(error);
        fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
        throw error;
    }

    fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
}

console.log(`Rendered ${completed} thumbnail(s).`);
