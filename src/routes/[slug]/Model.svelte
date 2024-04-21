<script lang="ts">
import NeedleEngine from "../NeedleEngine.svelte";
import ModelTags from "../ModelTags.svelte";
import { base } from "$app/paths";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import ButtonOverlay from "../ButtonOverlay.svelte";

export let model;
export let next;
export let previous;

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
$: usdzThreeUrl = "https://usd-viewer.glitch.me/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.three.usdz");
$: usdzBlenderUrl = "https://usd-viewer.glitch.me/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.blender.usdz");
$: usdzOvUrl = "https://usd-viewer.glitch.me/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.ov.usdz");
$: usdzGucUrl = "https://usd-viewer.glitch.me/?file=" + windowLocation + model.downloadUri.replace(".glb", ".glb.guc.usdz");
let hasQuickLook = false;

let isFullscreen = false;
let arSessionActive = false;

onMount(() => {
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
            <button on:click={needleEngine.toggleFullscreen}>⛶</button>
            <button on:click={needleEngine.startAR} class={!arSupported ? 'not-supported' : ''}>AR</button>
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
        <div class="meta">
            <p>glTF information extracted with <a href="https://gltf-transform.dev/" target="_blank">gltf-transform</a>.</p>
            <p>USDZ verification and preview image created with <a href="https://openusd.org/release/toolset.html#usdchecker" target="_blank">usdchecker</a> and <a href="https://openusd.org/release/toolset.html#usdrecord" target="_blank">usdrecord</a>.</p>
            <p><a href="https://usd-viewer.glitch.me/" target="_blank">USD Viewer</a> based on <a href="https://autodesk-forks.github.io/USD/#usd-for-web" target="_blank">Autodesk's experimental USD-for-Web</a></p>
        </div>
        <ModelTags tags={model.info} />

        <ul class="download-links">
            <li>
                <a href={model.downloadUri} download>
                    <img src={model.previewUri} alt="screenshot from source"/>
                    <span>Download GLB</span>
                </a>
                <span class="file-description">Source Asset from<br/>glTF-Sample-Models</span>
            </li>
            <li>
                <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.three.usdz")} download>
                    <img src={model.downloadUri.replace(".glb", ".glb.three.png")} alt="screenshot from three.js conversion"/>
                </a>
                {#if hasQuickLook}  
                <span>View in AR</span>
                {/if}
                <!-- TODO enable once fix lands in NE
                <button on:click={needleEngine.generateUsdz}>Export USDZ from scene</button>
                -->
                <a href="{usdzThreeUrl}" target="_blank">Open in USD Web Viewer</a>
                <a href="{model.downloadUri.replace(".glb", ".glb.three.usdz")}" download>Download USDZ</a>
                
                <span class="file-description">Converted with three.js<br/>r154, Needle Fork</span>                
            </li>
            <li>
                <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.blender.usdz")} download>
                    <img src={model.downloadUri.replace(".glb", ".glb.blender.png")} alt="screenshot from blender conversion"/>
                </a>
                {#if hasQuickLook}
                <span>View in AR</span>
                {/if}
                <a href="{usdzBlenderUrl}" target="_blank">Open in USD Web Viewer</a>
                <a href="{model.downloadUri.replace(".glb", ".glb.blender.usdz")}" download>Download USDZ</a>

                <span class="file-description">Converted with Blender 3.6</span>
            </li>
            <li>
                <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.ov.usdz")} download>
                    <img src={model.downloadUri.replace(".glb", ".glb.ov.png")} alt="screenshot from Omniverse conversion"/>
                </a>
                {#if hasQuickLook}
                <span>View in AR</span>
                {/if}
                <a href="{usdzOvUrl}" target="_blank">Open in USD Web Viewer</a>
                <a href="{model.downloadUri.replace(".glb", ".glb.ov.usdz")}" download>Download USDZ</a>

                <span class="file-description">Converted with Omniverse Kit 105.0</span>
            </li>
            <li>
                <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.guc.usdz")} download>
                    <img src={model.downloadUri.replace(".glb", ".glb.guc.png")} alt="screenshot from guc conversion"/>
                </a>
                {#if hasQuickLook}
                <span>View in AR</span>
                {/if}
                <a href="{usdzGucUrl}" target="_blank">Open in USD Web Viewer</a>
                <a href="{model.downloadUri.replace(".glb", ".glb.guc.usdz")}" download>Download USDZ</a>

                <span class="file-description">Converted with guc 0.4</span>
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
    padding: 10px;
    background-color: var(--color-bg-0);
    border-radius: 10px;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
    margin: 10px;
}

.info.options {
    display: flex;
    position: relative;
    border-radius: 40px;
    padding: 10px 20px;
    align-items: center;
    max-width: calc(100vw - 130px);
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

.info.options button {
    outline: none;
    border: none;
    background: var(--color-bg-0);
    cursor: pointer;
    text-decoration: none;
}

.info.options span {
    font-weight: bold;
}

.html a, .meta a {
    font-weight: bold;
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
    opacity: 0.5;
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
    flex-direction: column;
    align-items: center;
    margin: 7px 0;
    background: none;
    border: 0;
    color: var(--color-text);
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