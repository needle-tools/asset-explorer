<script lang="ts">
import NeedleEngine from "../NeedleEngine.svelte";
import ModelInfo from "./ModelInfo.svelte";
import Icon from "$lib/Icon.svelte";
import { dev } from "$app/environment";
import { needleCloudUploadUrl } from "$lib/cloudUpload";

import { base } from "$app/paths";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import ButtonOverlay from "../ButtonOverlay.svelte";
import { track } from "$lib/analytics";

export let model: any;
export let next: any;
export let previous: any;
export let pageOrigin = "";

const ENABLE_FEATURE_SURVIVAL_TABLE = false;

$: assetProps = { asset: model.displayName, slug: model.slug };
$: availableConversions = (model.conversions ?? []).filter((conversion: any) => conversion.available);
$: analyzedConversions = availableConversions.filter((conversion: any) => conversion.analysis?.features);

const featureRows = [
    { key: "meshes", label: "Meshes" },
    { key: "primitives", label: "Primitives" },
    { key: "materials", label: "Materials" },
    { key: "textures", label: "Textures" },
    { key: "texturePixels", label: "Texture pixels" },
    { key: "textureBytes", label: "Texture bytes" },
    { key: "cameras", label: "Cameras" },
    { key: "lights", label: "Lights" },
    { key: "skins", label: "Skins" },
    { key: "animations", label: "Animations" },
    { key: "animationChannels", label: "Animation channels" },
    { key: "morphTargetPrimitives", label: "Morph targets" },
    { key: "variants", label: "Variants" },
    { key: "materialFeatures", label: "Material features" },
];

let pageUrlBase = pageOrigin;

function startAR() {
    track("view_in_ar", assetProps);
    needleEngine.startAR();
}

function toggleFullscreen() {
    track("fullscreen", assetProps);
    needleEngine.toggleFullscreen();
}

let needleEngine: NeedleEngine;
let showXROverlay = false;

function readableBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
        (bytes / Math.pow(1024, i)).toFixed(2) +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    );
}

function readablePixels(pixels: number | null | undefined) {
    if (typeof pixels !== "number") return "Unknown";
    if (pixels >= 1000000) return (pixels / 1000000).toFixed(1) + " MP";
    if (pixels >= 1000) return (pixels / 1000).toFixed(1) + " KP";
    return pixels.toString();
}

function readableOptionalBytes(bytes: number | null | undefined) {
    return typeof bytes === "number" ? readableBytes(bytes) : "Unknown";
}

function shortNumber(value: number | null | undefined) {
    return typeof value === "number" ? value.toLocaleString("en-US") : "Unknown";
}

function conversionTextureImages(conversion: any) {
    return conversion.analysis?.features?.textureImages ?? conversion.analysis?.textureImages;
}

function currentPageAssetUrl(uri: string, baseUrl: string) {
    if (!baseUrl) return uri;

    try {
        const assetUri = baseUrl.startsWith("file:") ? uri.replace(/^\/+/, "") : uri;
        return new URL(assetUri, baseUrl).href;
    }
    catch {
        return uri;
    }
}

function cloudUploadUrl(uri: string, origin: string) {
    return needleCloudUploadUrl(uri, origin || "https://asset-explorer.needle.tools", dev);
}

function usdViewerUrl(conversion: any, baseUrl: string) {
    const params = new URLSearchParams({
        file: currentPageAssetUrl(conversion.usdzUri, baseUrl),
    });
    return "https://usd-viewer.needle.tools/?" + params.toString();
}

function sourceFeatureValue(row: any) {
    if (row.key === "texturePixels") return readablePixels(model.analysis?.source?.textureImages?.totalPixels);
    if (row.key === "textureBytes") return readableOptionalBytes(model.analysis?.source?.textureImages?.totalBytes);
    if (row.key === "materialFeatures") return shortNumber(model.analysis?.source?.materialFeatures?.length);
    return shortNumber(model.analysis?.source?.counts?.[row.key]);
}

function conversionFeatureValue(conversion: any, row: any) {
    const analysis = conversion.analysis;
    if (!analysis?.features) return "Unknown";
    if (row.key === "texturePixels") return readablePixels(conversionTextureImages(conversion)?.totalPixels);
    if (row.key === "textureBytes") return readableOptionalBytes(conversionTextureImages(conversion)?.totalBytes);
    if (row.key === "materialFeatures") {
        const sourceCount = model.analysis?.source?.materialFeatures?.length ?? 0;
        const missingCount = analysis.comparison?.missingMaterialFeatures?.length ?? 0;
        const convertedCount = Math.max(0, sourceCount - missingCount);
        return sourceCount > 0 ? convertedCount + "/" + sourceCount : shortNumber(analysis.features.materialFeatures?.length);
    }
    return shortNumber(analysis.features.counts?.[row.key]);
}

function conversionFeatureStatus(conversion: any, row: any) {
    const comparison = conversion.analysis?.comparison;
    if (!comparison) return "";

    if (row.key === "texturePixels") {
        if (comparison.texturePixels?.status) return comparison.texturePixels.status;
        const source = comparison.texturePixels?.source ?? 0;
        const converted = comparison.texturePixels?.converted ?? 0;
        if (source === 0) return converted === 0 ? "absent" : "added";
        if (converted === 0) return "missing";
        if (converted < source) return "reduced";
        return "present";
    }

    if (row.key === "textureBytes") {
        const source = model.analysis?.source?.textureImages?.totalBytes ?? 0;
        const converted = conversionTextureImages(conversion)?.totalBytes ?? 0;
        if (source === 0) return converted === 0 ? "absent" : "added";
        if (converted === 0) return "missing";
        if (converted < source) return "reduced";
        return "present";
    }

    if (row.key === "materialFeatures") {
        const sourceCount = model.analysis?.source?.materialFeatures?.length ?? 0;
        const missingCount = comparison.missingMaterialFeatures?.length ?? 0;
        if (sourceCount === 0) return "absent";
        if (missingCount === 0) return "present";
        if (missingCount < sourceCount) return "reduced";
        return "missing";
    }

    return comparison.counts?.[row.key]?.status ?? "";
}

function featureTitle(conversion: any, row: any) {
    if (row.key === "materialFeatures") {
        const missing = conversion.analysis?.comparison?.missingMaterialFeatures ?? [];
        return missing.length ? "Missing: " + missing.join(", ") : "All mapped source material features found";
    }
    return conversion.analysis?.features?.error ?? "";
}

$: {
    // add more info
    model.info.fileSize = readableBytes(model.size);
}

let arSupported = false;
let vrSupported = false;

function onKeyDown(evt: KeyboardEvent) {
    if (evt.key === "ArrowLeft" && previous) {
        goto(`${base}/${previous.slug}`);
    } else if (evt.key === "ArrowRight" && next) {
        goto(`${base}/${next.slug}`);
    }
}

let hasQuickLook = false;

let isFullscreen = false;
let arSessionActive = false;

onMount(() => {
    track("asset_view", assetProps);
    pageUrlBase = window.location.protocol === "file:" ? window.location.href : window.location.origin;

    // bind left/right arrow key to goto
    const a = document.createElement("a");
    hasQuickLook = a.relList.supports("ar");

    document.addEventListener("keydown", onKeyDown);

    return () => {
        document.removeEventListener("keydown", onKeyDown);
    };
});

</script>

<div class="text-column" id="asset-preview">
    {#key "constant"}
    <NeedleEngine src={model.downloadUri} bind:this={needleEngine} 
        bind:arSupported 
        bind:vrSupported 
        bind:arSessionActive 
        bind:isFullscreen>
        
        <div class="info options ar-menu">
            <span>{model.displayName}</span>

            {#if !isFullscreen && !arSessionActive}
            <button on:click={startAR} class={!arSupported ? 'not-supported' : ''}>AR</button>
            <!--
            <button on:click={needleEngine.startVR} class={!vrSupported ? 'not-supported' : ''}>VR</button>
            -->
            {/if}

            <!--
            <button on:click={() => showXROverlay = true}>XR
                <ButtonOverlay bind:showXROverlay={showXROverlay}>
                    <button on:click={needleEngine.startAR}>AR</button>
                    <button on:click={needleEngine.startVR}>VR</button>
                    <button on:click={needleEngine.openOnQuest}>Send to Quest</button>
                </ButtonOverlay>
            </button>
            -->


        </div>
    </NeedleEngine>
    {/key}
    <!--
    <model>
        <source src={data.downloadUri.replace(".glb", ".glb.three.usdz")} type="model/vnd.usdz+zip" />
    </model>
    -->

    <div class="info">
        <div class="information-layout">
        <section class="metadata-panel" id="asset-information"><h3>Asset information</h3><ModelInfo info={model.info} name={model.displayName} sourceUrl={model.sourceRepoUrl} provenance={model.provenance}>
        <div class="meta credits">
            <p>glTF information extracted with <a href="https://gltf-transform.dev/" target="_blank">gltf-transform</a>.</p>
            <p>USDZ verification and preview image created with <a href="https://openusd.org/release/toolset.html#usdchecker" target="_blank">usdchecker</a> and <a href="https://openusd.org/release/toolset.html#usdrecord" target="_blank">usdrecord</a>.</p>
            <p><a href="https://usd-viewer.needle.tools/" target="_blank">USD Viewer by Needle</a></p>
        </div>
        </ModelInfo>
        </section>
        <section class="downloads-panel" id="asset-downloads"><h3>Downloads</h3>

        <ul class="download-links">
            <li>
                <img class="preview" src={model.previewUri} alt="Source asset preview"/>
                <span class="card-title">Source glTF</span>
                <div class="card-links">
                    <a href={model.downloadUri} download
                        on:click={() => track("download", { ...assetProps, format: "glb", converter: "source" })}><Icon name="download" />Download GLB</a>
                    <a href={cloudUploadUrl(model.downloadUri, pageUrlBase)} target="_blank" rel="noopener noreferrer"
                        on:click={() => track("optimize_with_needle", { ...assetProps, format: "glb", converter: "source" })}><Icon name="external" />Optimize with Needle</a>
                </div>
                <span class="file-description">Source asset from<br/>{model.info.source}</span>
            </li>
            {#each availableConversions as conversion}
            <li>
                <img class="preview" src={conversion.screenshotAvailable ? conversion.screenshotUri : model.previewUri} alt="{conversion.shortLabel} conversion preview"/>
                <span class="card-title">
                    {#if conversion.logo}
                    <img class="brand-logo" src="{base}/logos/{conversion.logo}" alt="" />
                    {/if}
                    {conversion.shortLabel}
                </span>
                <div class="card-links">
                    <a href={conversion.usdzUri} download
                        on:click={() => track("download", { ...assetProps, format: "usdz", converter: conversion.id })}><Icon name="download" />Download USDZ</a>
                    <a href={usdViewerUrl(conversion, pageUrlBase)} target="_blank"
                        on:click={() => track("open_usd_viewer", { ...assetProps, converter: conversion.id })}><Icon name="external" />Open in Needle USD Viewer</a>
                    <a href={cloudUploadUrl(conversion.usdzUri, pageUrlBase)} target="_blank" rel="noopener noreferrer"
                        on:click={() => track("optimize_with_needle", { ...assetProps, format: "usdz", converter: conversion.id })}><Icon name="external" />Optimize with Needle</a>
                    {#if hasQuickLook}
                    <a rel="ar" href={conversion.usdzUri}><Icon name="ar" />View in AR</a>
                    {/if}
                </div>
                <span class="file-description">{conversion.description}</span>
            </li>
            {/each}
        </ul>

        </section>
        </div>


        {#if ENABLE_FEATURE_SURVIVAL_TABLE && model.analysis}
        <div class="feature-table">
            <h3>Feature Survival</h3>
            <div class="feature-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Source</th>
                            {#each analyzedConversions as conversion}
                            <th>{conversion.shortLabel}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each featureRows as row}
                        <tr>
                            <th>{row.label}</th>
                            <td>{sourceFeatureValue(row)}</td>
                            {#each analyzedConversions as conversion}
                            <td class="feature-status {conversionFeatureStatus(conversion, row)}" title={featureTitle(conversion, row)}>
                                {conversionFeatureValue(conversion, row)}
                            </td>
                            {/each}
                        </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
        {/if}
    </div>


    <div class="info html description-panel" id="asset-description">
        <h2 class="info-header">Description</h2>
        <div class="meta">
            <p>This asset is part of the <a href={model.sourceRepoUrl} target="_blank">{model.info.source}</a> asset repository.</p>
            <p><a href="{model.readmeSrc}" target="_blank">Description source</a> • <a href="{model.originalFileSrc}" target="_blank">Asset source</a></p>
        </div>
        <div class="workspace-prose source-readme">{@html model.readme}</div>
    </div>
</div>

<style>
.text-column {
    width: 100%;
    max-width: 100%;
    margin: 0;
    flex: initial;
    box-sizing: border-box;
    align-items: center;
    min-width: 0;
}

@media (max-width: 540px) {
    .text-column {
        margin: 12px auto 0;
    }
    .info {
        padding: 18px 16px;
    }
}

.info {
    padding: 16px 0;
    background-color: transparent;
    border: 0;
    border-top: 1px solid var(--color-border-subtle);
    border-radius: 0;
    box-shadow: none;
    margin: 16px auto 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
}

.info.options {
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    max-width: 100%;
    padding: 6px 10px;
    margin: 0;
    border: 0;
    border-radius: 6px;
    background: rgb(255 255 255 / 10%);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: none;
    pointer-events: auto;
}

.meta {
    font-style: italic;
    margin: 10px;
}

.meta p {
    font-size: 0.8em;
    margin: 0;
    opacity: 0.6;
}

/* Credits inherit the Info table row's size and spacing. */
.credits {
    margin: 0;
    padding: 0;
    font-size: 12px;
    font-style: normal;
    color: var(--color-text-secondary);
}

.credits p {
    margin: 0;
    font-size: inherit;
    line-height: 1.5;
    opacity: 1;
    text-wrap: balance;
}

.info.options button {
    outline: none;
    border: none;
    background: transparent;
    cursor: pointer;
    text-decoration: none;
}

.info.options span {
    font-size: 12px;
    font-weight: 500;
}

/* asset name: single line with ellipsis instead of wrapping */
.info.options > span {
    flex: 1;
    min-width: 0;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.html a, .meta a {
    font-weight: bold;
    text-decoration: underline;
}

.info-header {
    text-align: left;
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px;
}

.file-description {
    opacity: 0.5;
    text-decoration: none;
    font-size: 0.8rem;
    line-height: 1.35;
}

.download-links {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
    gap: 24px 16px;
    padding: 0;
    margin: 6px 0 0;
    list-style: none;
}

@media (max-width: 540px) {
    .download-links {
        grid-template-columns: 1fr;
    }
}

.download-links li {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    min-width: 0;
    margin: 0;
    padding: 0;
}

.download-links li a {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    font-size: 12px;
    line-height: 1.4;
    margin: 2px 0;
    background: none;
    border: 0;
    color: var(--color-text);
}

.card-title {
    min-height: 20px;
    line-height: 20px;
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 6px;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: normal;
    text-transform: none;
    color: var(--color-text-muted);
}

.brand-logo {
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.card-links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin: 5px 0 3px;
}

.preview {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 3;
    object-fit: contain;
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-bg-page) 94%, var(--color-text-secondary));
    box-sizing: border-box;
}

.feature-table {
    margin-top: 24px;
}

.feature-table h3 {
    margin: 0 0 10px;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    letter-spacing: normal;
    text-transform: none;
}

.feature-table-scroll {
    overflow-x: auto;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-card);
}

.feature-table table {
    width: 100%;
    min-width: 680px;
    border-collapse: collapse;
    font-size: 0.82rem;
}

.feature-table th,
.feature-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border-subtle);
    text-align: right;
    white-space: nowrap;
}

.feature-table tr:last-child th,
.feature-table tr:last-child td {
    border-bottom: 0;
}

.feature-table th:first-child,
.feature-table td:first-child {
    text-align: left;
}

.feature-table thead th {
    color: var(--color-text-muted);
    font-weight: 700;
}

.feature-table tbody th {
    color: var(--color-text-secondary);
    font-weight: 600;
}

.feature-status.present,
.feature-status.added {
    color: #207245;
}

.feature-status.reduced {
    color: #8a6500;
}

.feature-status.missing {
    color: #b3261e;
    font-weight: 700;
}

.feature-status.absent {
    color: var(--color-text-muted);
    opacity: 0.7;
}

.feature-status.unknown {
    color: var(--color-text-muted);
}

:global(.info img) {
    max-width: 100%;
}

.not-supported {
    opacity: 0.5;
    text-decoration: line-through;
    display: none;
}

/*
.info.options.ar-menu {
    position: absolute;
    bottom: 20px;
}
*/

.information-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 24px;
    align-items: start;
}

.information-layout section {
    min-width: 0;
}

.information-layout h3 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 500;
}

@media (max-width: 900px) {
    .information-layout {
        grid-template-columns: minmax(0, 1fr);
    }
}
.description-panel {
    align-self: flex-start;
    max-width: 88ch;
    margin-inline: 0;
}

.description-panel .meta {
    margin: 0 0 20px;
    font-style: normal;
}

.description-panel .meta p {
    font-size: 12px;
    color: var(--color-text-muted);
    opacity: 1;
}

.source-readme {
    padding: 20px 24px;
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-bg-page) 35%, white);
    box-sizing: border-box;
}

.source-readme :global(> :first-child) {
    margin-top: 0;
}

.source-readme :global(> :last-child) {
    margin-bottom: 0;
}

@media (max-width: 600px) {
    .source-readme {
        padding: 16px;
    }
}
.download-links :global(.icon) {
    width: 13px;
    height: 13px;
}

[id] {
    scroll-margin-top: 80px;
}
.credits a {
    font-weight: 400;
}
.description-panel .info-header {
    margin-bottom: 20px;
}

.description-panel .meta a {
    color: var(--color-text-muted);
    font-weight: 400;
}

.description-panel .meta a:hover {
    color: var(--color-text-secondary);
}
</style>
