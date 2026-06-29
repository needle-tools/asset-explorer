<script lang="ts">
import NeedleEngine from "../NeedleEngine.svelte";
import ModelInfo from "./ModelInfo.svelte";
import Icon from "$lib/Icon.svelte";
import WhatsNew from "$lib/WhatsNew.svelte";
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

<div class="text-column">
    {#key "constant"}
    <NeedleEngine src={model.downloadUri} bind:this={needleEngine} 
        bind:arSupported 
        bind:vrSupported 
        bind:arSessionActive 
        bind:isFullscreen>
        
        <div class="info options ar-menu">
            {#if previous}
            <a class="nav left" href="{base}/{previous.slug}"><span>{previous.displayName}</span></a>
            {/if}

            <span>{model.displayName}</span>

            {#if !isFullscreen && !arSessionActive}
            <button on:click={toggleFullscreen}>⛶</button>
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

            {#if next}
            <a class="nav right" href="{base}/{next.slug}"><span>{next.displayName}</span></a>
            {/if}
        </div>
    </NeedleEngine>
    {/key}
    <!--
    <model>
        <source src={data.downloadUri.replace(".glb", ".glb.three.usdz")} type="model/vnd.usdz+zip" />
    </model>
    -->

    <div class="spacer"></div>
    <div class="info">
        <h2 class="info-header">Information and Downloads</h2>
        <div class="meta credits">
            <p>glTF information extracted with <a href="https://gltf-transform.dev/" target="_blank">gltf-transform</a>.</p>
            <p>USDZ verification and preview image created with <a href="https://openusd.org/release/toolset.html#usdchecker" target="_blank">usdchecker</a> and <a href="https://openusd.org/release/toolset.html#usdrecord" target="_blank">usdrecord</a>.</p>
            <p><a href="https://usd-viewer.needle.tools/" target="_blank">USD Viewer by Needle</a></p>
        </div>
        <ModelInfo info={model.info} />

        <ul class="download-links">
            <li>
                <img class="preview" src={model.previewUri} alt="Source asset preview"/>
                <span class="card-title">Source glTF</span>
                <div class="card-links">
                    <a href={model.downloadUri} download
                        on:click={() => track("download", { ...assetProps, format: "glb", converter: "source" })}><Icon name="download" />Download GLB</a>
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
                    {#if hasQuickLook}
                    <a rel="ar" href={conversion.usdzUri}><Icon name="ar" />View in AR</a>
                    {/if}
                </div>
                <span class="file-description">{conversion.description}</span>
            </li>
            {/each}
        </ul>

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

    <WhatsNew />

    <div class="info html">
        <h2 class="info-header">Description</h2>
        <div class="meta">
            <p>This asset is part of the <a href={model.sourceRepoUrl} target="_blank">{model.info.source}</a> asset repository.</p>
            <p><a href="{model.readmeSrc}" target="_blank">Description source</a> • <a href="{model.originalFileSrc}" target="_blank">Asset source</a></p>
        </div>
        {@html model.readme} 
    </div>
</div>

<style>
/* reserves room for the viewer title bar, which floats at bottom:-70px (NeedleEngine.svelte) */
.spacer {
    height: 80px;
}

.text-column {
    width: 100%;
    max-width: 48rem;
    margin: 20px auto 0;
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
    padding: 24px 28px;
    background-color: var(--color-bg-panel);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-card);
    box-shadow: 0 4px 16px rgba(26, 26, 26, 0.06);
    margin: 16px auto 0;
    width: 100%;
    max-width: 44rem;
    box-sizing: border-box;
}

.info.options {
    display: flex;
    position: relative;
    padding: 10px 20px;
    align-items: center;
    /* title bar hugs its content (not the full panel width) and stays centered */
    width: auto;
    align-self: center;
    max-width: calc(100vw - 130px);
    /* not a pill: plain title bar, no panel chrome */
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
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

/* credits as an info panel, aligned to the info table width */
.credits {
    max-width: 38rem;
    margin: 0 auto 18px;
    padding: 12px 16px;
    background-color: var(--color-bg-callout);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-card);
}

.credits p {
    opacity: 0.75;
    line-height: 1.5;
}

.info.options button {
    outline: none;
    border: none;
    background: transparent;
    cursor: pointer;
    text-decoration: none;
}

.info.options span {
    font-weight: bold;
}

/* asset name: single line with ellipsis instead of wrapping */
.info.options > span {
    flex: 1;
    min-width: 0;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.html a, .meta a {
    font-weight: bold;
    text-decoration: underline;
}

a.left, a.right {
    position: absolute;
    font-size: 1.5em;
}

a.left {
    left: -30px;
}

a.right {
    right: -30px;
}

a.left::before {
    content: "←";
    left: -10px;
    display: inline-block;
    position: relative;
    text-align: right;
}

a.right::after {
    content: "→";
    left: 10px;
    display: inline-block;
    position: relative;
}

a.nav {
    color: var(--color-text-secondary);
    opacity: 0.5;
}

a.nav:hover {
    color: var(--color-text-primary);
    opacity: 0.8;
}

.info-header {
    text-align: left;
    opacity: 0.7;
}

.file-description {
    opacity: 0.5;
    text-decoration: none;
    font-size: 0.8rem;
    line-height: 1.35;
}

.download-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 16px;
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
    align-items: center;
    justify-content: flex-start;
    margin: 0;
    padding: 10px 14px 12px;
}

.download-links li a {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin: 2px 0;
    background: none;
    border: 0;
    color: var(--color-text);
}

.card-title {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 6px;
    font-weight: 700;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
    align-items: center;
    margin: 5px 0 3px;
}

.preview {
    width: auto;
    max-width: 100%;
    height: 200px;
    object-fit: contain;
    border-radius: 8px;
    box-sizing: border-box;
}

.feature-table {
    margin-top: 24px;
}

.feature-table h3 {
    margin: 0 0 10px;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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

a.nav span {
    display: none;
}

@media only screen and (max-width: 1000px) {
    a.nav span {
        display: none;
    }
}
</style>
