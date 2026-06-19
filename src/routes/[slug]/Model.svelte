<script lang="ts">
import NeedleEngine from "../NeedleEngine.svelte";
import ModelInfo from "./ModelInfo.svelte";
import Icon from "$lib/Icon.svelte";
import { base } from "$app/paths";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import ButtonOverlay from "../ButtonOverlay.svelte";
import { track } from "$lib/analytics";

export let model;
export let next;
export let previous;

$: assetProps = { asset: model.displayName, slug: model.slug };

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
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
        (bytes / Math.pow(1024, i)).toFixed(2) +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    );
}

$: {
    // add more info
    model.info.fileSize = readableBytes(model.size);
}

let arSupported = false;
let vrSupported = false;

function onKeyDown(evt) {
    if (evt.key === "ArrowLeft" && previous) {
        goto(`${base}/${previous.slug}`);
    } else if (evt.key === "ArrowRight" && next) {
        goto(`${base}/${next.slug}`);
    }
}

let windowLocation = "https://asset-explorer.needle.tools/";
$: usdzThreeUrl = "https://usd-viewer.needle.tools/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.three.usdz");
$: usdzBlenderUrl = "https://usd-viewer.needle.tools/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.blender.usdz");
$: usdzOvUrl = "https://usd-viewer.needle.tools/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.ov.usdz");
let hasQuickLook = false;

let isFullscreen = false;
let arSessionActive = false;

onMount(() => {
    track("asset_view", assetProps);

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
            <p><a href="https://usd-viewer.needle.tools/" target="_blank">USD Viewer</a> based on <a href="https://autodesk-forks.github.io/USD/#usd-for-web" target="_blank">Autodesk's experimental USD-for-Web</a></p>
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
                <span class="file-description">Source Asset from<br/>glTF-Sample-Models</span>
            </li>
            <li>
                <img class="preview" src={model.downloadUri.replace(".glb", ".glb.three.png")} alt="three.js conversion preview"/>
                <span class="card-title"><img class="brand-logo" src="{base}/logos/threejs.svg" alt="" />three.js</span>
                <div class="card-links">
                    <a href={model.downloadUri.replace(".glb", ".glb.three.usdz")} download
                        on:click={() => track("download", { ...assetProps, format: "usdz", converter: "three" })}><Icon name="download" />Download USDZ</a>
                    <a href="{usdzThreeUrl}" target="_blank"
                        on:click={() => track("open_usd_viewer", { ...assetProps, converter: "three" })}><Icon name="external" />Open in USD Web Viewer</a>
                    {#if hasQuickLook}
                    <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.three.usdz")}><Icon name="ar" />View in AR</a>
                    {/if}
                </div>
                <span class="file-description">Converted with three.js<br/>r154, Needle Fork</span>
            </li>
            <li>
                <img class="preview" src={model.downloadUri.replace(".glb", ".glb.blender.png")} alt="Blender conversion preview"/>
                <span class="card-title"><img class="brand-logo" src="{base}/logos/blender.svg" alt="" />Blender</span>
                <div class="card-links">
                    <a href={model.downloadUri.replace(".glb", ".glb.blender.usdz")} download
                        on:click={() => track("download", { ...assetProps, format: "usdz", converter: "blender" })}><Icon name="download" />Download USDZ</a>
                    <a href="{usdzBlenderUrl}" target="_blank"
                        on:click={() => track("open_usd_viewer", { ...assetProps, converter: "blender" })}><Icon name="external" />Open in USD Web Viewer</a>
                    {#if hasQuickLook}
                    <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.blender.usdz")}><Icon name="ar" />View in AR</a>
                    {/if}
                </div>
                <span class="file-description">Converted with Blender 3.6</span>
            </li>
            <li>
                <img class="preview" src={model.downloadUri.replace(".glb", ".glb.ov.png")} alt="Omniverse conversion preview"/>
                <span class="card-title"><img class="brand-logo" src="{base}/logos/omniverse.svg" alt="" />Omniverse</span>
                <div class="card-links">
                    <a href={model.downloadUri.replace(".glb", ".glb.ov.usdz")} download
                        on:click={() => track("download", { ...assetProps, format: "usdz", converter: "omniverse" })}><Icon name="download" />Download USDZ</a>
                    <a href="{usdzOvUrl}" target="_blank"
                        on:click={() => track("open_usd_viewer", { ...assetProps, converter: "omniverse" })}><Icon name="external" />Open in USD Web Viewer</a>
                    {#if hasQuickLook}
                    <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.ov.usdz")}><Icon name="ar" />View in AR</a>
                    {/if}
                </div>
                <span class="file-description">Converted with Omniverse Kit 105.0</span>
            </li>
        </ul>
    </div>

    <div class="info html">
        <h2 class="info-header">Description</h2>
        <div class="meta">
            <p>This asset is part of the <a href="https://github.com/KhronosGroup/glTF-Sample-Models" target="_blank">KhronosGroup/glTF-Sample-Models</a> asset repository.</p>
            <p><a href="{model.readmeSrc}" target="_blank">Description source</a> • <a href="{model.originalFileSrc}" target="_blank">Asset source</a></p>
        </div>
        {@html model.readme} 
    </div>
</div>

<style>
.spacer {
    margin: 30px;
}

.text-column {
    margin: 20px;
    align-items: center;
    /* overflow: hidden; */
}

.info {
    padding: 24px 28px;
    background-color: var(--color-bg-panel);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-card);
    box-shadow: 0 4px 16px rgba(26, 26, 26, 0.06);
    margin: 16px;
    max-width: 44rem;
    box-sizing: border-box;
}

.info.options {
    display: flex;
    position: relative;
    padding: 10px 20px;
    align-items: center;
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
    text-align: center;
    opacity: 0.7;
}

.file-description {
    opacity: 0.5;
    text-decoration: none;
    font-size: 0.8rem;
}

.download-links {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: baseline;
    padding: 0;
}

.download-links li {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 30px;
}

.download-links li a, .download-links li button {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin: 4px 0;
    background: none;
    border: 0;
    color: var(--color-text);
}

.card-title {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 12px;
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
    margin: 8px 0 4px;
}

.preview {
    border-radius: var(--radius-card);
}

.download-links li button:hover {
    cursor: pointer;
}

.download-links img {
    max-height: 150px;
    max-width: 200px;
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