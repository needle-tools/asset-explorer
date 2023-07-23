<script lang="ts" context="module">
export let isInitialized = false;
import texture from './../lib/images/neutral.hdr?url';
</script>

<script lang="ts">

export let src: string | null = null;

import { onDestroy, onMount } from 'svelte';
import { EquirectangularReflectionMapping, Object3D, Texture, ACESFilmicToneMapping } from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
// import { USDZExporter } from '@needle-tools/engine/src/engine-components/export/usdz/ThreeUSDZExporter';

// TODO this ain't great as the context callbacks should be global instead of added each time here.
// better would be 
// a) an event directly on needle-engine for the context being loaded that we can listen to and do work each time
// b) adding the callbacks globally but so that they're still only on the client
onMount(async () => {
    console.log("MOUNTED")
    if (isInitialized) return;
    isInitialized = true;

    window.NEEDLE_ENGINE_META = { version: "custom", generator: "svelte-kit" };
    window.NEEDLE_USE_RAPIER = false;
    const { NeedleEngine, GameObject, WebXR, WebARSessionRoot, USDZExporter, RGBAColor, OrbitControls } = await import('@needle-tools/engine');
    NeedleEngine.addContextCreatedCallback((evt) => {
        console.log("CREATED");
        const ctx = evt.context;
        if (ctx.mainCameraComponent) {
            ctx.mainCameraComponent.backgroundBlurriness = 1; 
            ctx.mainCameraComponent.backgroundColor = new RGBAColor(0,0,0,0);
        }

        // AcesFilmicToneMapping
        ctx.renderer.toneMapping = ACESFilmicToneMapping;

        const controls = GameObject.findObjectOfType(OrbitControls, ctx);
        setTimeout(() => {
            controls!.enableZoom = false;
        }, 1000)
        

        const xr = new Object3D();
        xr.name = "XR";
        GameObject.addNewComponent(xr, WebXR);
        GameObject.addNewComponent(xr, WebARSessionRoot);
        GameObject.addNewComponent(xr, USDZExporter);
        ctx.scene.add(xr);
    });

    /*
    // meshopt support for model-viewer
    window.ModelViewerElement = window.ModelViewerElement || {};
    window.ModelViewerElement.meshoptDecoderLocation = 'https://cdn.jsdelivr.net/npm/meshoptimizer/meshopt_decoder.js';
    await import('@google/model-viewer');
    */

    let loadedTexture: Texture | undefined = undefined;

    var textureLoader = new EventTarget();
    new RGBELoader().load( texture, function ( tex: Texture ) {
        console.log ("loaded texture", tex);
        tex.mapping = EquirectangularReflectionMapping;
        loadedTexture = tex;

        textureLoader.dispatchEvent(new CustomEvent("texture-loaded", { detail: loadedTexture } )); 
    } );

});

function loadFinished(evt: CustomEvent) {
}

</script>

<!-- <model-viewer camera-controls autoplay src={src} skybox-image={texture} environment-image={texture}></model-viewer> -->
<needle-engine camera-controls src={src} on:loadfinished={loadFinished} environment-image={texture} autoplay></needle-engine>

<style>
    needle-engine {
        display: block; 
        height: 400px;
        position: relative;
        /* width: 100%; */
        width: 100vw;
        left: calc((100% - 100vw) / 2);
    }
</style>