<script lang="ts">
import NeedleEngine from "../NeedleEngine.svelte";
import ModelTags from "../ModelTags.svelte";
import { base } from "$app/paths";
import { onMount } from "svelte";
import { goto } from "$app/navigation";

export let model;
export let next;
export let previous;

let needleEngine: NeedleEngine;

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

function onKeyDown(evt) {
    if (evt.key === "ArrowLeft" && previous) {
        goto(`${base}/${previous.slug}`);
    } else if (evt.key === "ArrowRight" && next) {
        goto(`${base}/${next.slug}`);
    }
}

onMount(() => {
    // bind left/right arrow key to goto
    document.addEventListener("keydown", onKeyDown);

    return () => {
        document.removeEventListener("keydown", onKeyDown);
    };
});

</script>

<div class="text-column">
    {#key "constant"}
    <NeedleEngine src={model.downloadUri} bind:this={needleEngine}/>
    {/key}
    <!--
    <model>
        <source src={data.downloadUri.replace(".glb", ".glb.three.usdz")} type="model/vnd.usdz+zip" />
    </model>
    -->

    <div class="topnav">
        {#if previous}
        <a class="nav left" href="{base}/{previous.slug}"><span>{previous.displayName}</span></a>
        {/if}
        {#if next}
        <a class="nav right" href="{base}/{next.slug}"><span>{next.displayName}</span></a>
        {/if}
    </div>

    <div class="info options">
        <span>{model.displayName}</span>
        <button on:click={needleEngine.toggleFullscreen}>⛶</button>
        <!--
        <button on:click={() => goto("https://viewer.needle.tools?file=" + model.originalFileSrc)}>Viewer</button>
        -->
        <!--
        <button on:click={needleEngine.startAR}>AR</button>
        <button on:click={needleEngine.startVR}>VR</button>
        -->
    </div>

    <div class="info">
        <h2 class="info-header">Information and Downloads</h2>
        <div class="meta">
            <p>glTF information extracted with <a href="https://gltf-transform.dev/" target="_blank">gltf-transform</a>.</p>
            <p>USDZ verification and preview image created with <a href="https://openusd.org/release/toolset.html#usdchecker" target="_blank">usdchecker</a> and <a href="https://openusd.org/release/toolset.html#usdrecord" target="_blank">usdrecord</a>.</p>
        </div>
        <ModelTags tags={model.info} />

        <ul class="download-links">
            <li>
                <a href={model.downloadUri} download>
                    <img src={model.previewUri} alt="screenshot from source"/>
                    <span>Download GLB</span>
                    <span class="file-description">Source Asset from<br/>glTF-Sample-Models</span>
                </a>
            </li>
            <li>
                <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.three.usdz")} download>
                    <img src={model.downloadUri.replace(".glb", ".glb.three.png")} alt="screenshot from three.js conversion"/>
                    <span>Download USDZ</span>
                    <span class="file-description">Converted with three.js<br/>r154, Needle Fork</span>
                </a>
            </li>
            <li>
                <a rel="ar" href={model.downloadUri.replace(".glb", ".glb.blender.usdz")} download>
                    <img src={model.downloadUri.replace(".glb", ".glb.blender.png")} alt="screenshot from blender conversion"/>
                    <span>Download USDZ</span>
                    <span class="file-description">Converted with Blender 3.6</span>
                </a>
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
    display: inline-block;
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

.topnav {
    position: absolute;
    top: 20px;
    width: 100%;
}

.html a, .meta a {
    font-weight: bold;
}

a.left {
    position:absolute;
    left: 10px;
}

a.right {
    position:absolute;
    right: 10px;
}

a.left::before {
    content: "←";
    margin-right: 20px;
}

a.right::after {
    content: "→";
    margin-left: 20px;
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

a:hover span.file-description {
    text-decoration: none!important;
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
    margin: 10px;
}

.download-links li a {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.download-links img {
    max-height: 150px;
    max-width: 200px;
}

:global(.info img) {
    max-width: 100%;
}

@media only screen and (max-width: 1000px) {
    a.nav span {
        display: none;
    }
}
</style>