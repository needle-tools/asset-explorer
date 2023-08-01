<script lang="ts" context="module">
export let isInitialized = false;
import texture from './../lib/images/neutral.hdr?url';
</script>

<script lang="ts">

export let src: string | null = null;
let context;

import { onMount } from 'svelte';
import { EquirectangularReflectionMapping, Object3D, Texture, ACESFilmicToneMapping, Vector3, Vector2, Box3, Box3Helper, GridHelper } from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let _startARImpl: () => void;
let _startVRImpl: () => void;

export let arSupported = false;
export let vrSupported = false;

export function startAR() {
    _startARImpl();
}

export function startVR() {
    _startVRImpl();
}

export async function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        const { NeedleEngine, RGBAColor } = await import('@needle-tools/engine');
        NeedleEngine.Current.mainCamera.backgroundColor = new RGBAColor(0,0,255,1);
        NeedleEngine.Current.domElement.requestFullscreen();
    }
}

// TODO this ain't great as the context callbacks should be global instead of added each time here.
// better would be 
// a) an event directly on needle-engine for the context being loaded that we can listen to and do work each time
// b) adding the callbacks globally but so that they're still only on the client
onMount(async () => {
    if (isInitialized) return;
    isInitialized = true;

    window.NEEDLE_ENGINE_META = { version: "custom", generator: "svelte-kit" };
    window.NEEDLE_USE_RAPIER = false;
    const { NeedleEngine, GameObject, WebXR, WebARSessionRoot, USDZExporter, RGBAColor, OrbitControls } = await import('@needle-tools/engine');
    NeedleEngine.addContextCreatedCallback((evt) => {

        const ctx = evt.context;
        context = ctx;
        if (ctx.mainCameraComponent) {
            ctx.mainCameraComponent.fieldOfView = 25;   
            ctx.mainCameraComponent.backgroundBlurriness = 1; 
            ctx.mainCameraComponent.backgroundColor = new RGBAColor(0,0,0,0);
        }

        // AcesFilmicToneMapping
        ctx.renderer.toneMapping = ACESFilmicToneMapping;
        ctx.renderer.domElement.style.touchAction = "pan-y";

        const controls = GameObject.findObjectOfType(OrbitControls, ctx);
        if(controls) controls.enableKeys = false;
        setTimeout(() => {
            controls!.enableZoom = false;
            ctx.domElement.style.touchAction = "pan-y";
        }, 1000)
        
        const xr = new Object3D();
        xr.name = "XR";
        const webXR = GameObject.addNewComponent(xr, WebXR);
        
        webXR.createVRButton = false;
        webXR.createARButton = false;
        
        GameObject.addNewComponent(xr, WebARSessionRoot);
        GameObject.addNewComponent(xr, USDZExporter);

        ctx.scene.add(xr);
        
        const arStart = WebXR.createARButton(webXR);
        const vrStart = WebXR.createVRButton(webXR);

        arSupported = WebXR.IsARSupported;
        vrSupported = WebXR.IsVRSupported;

        _startARImpl = () => {
            arStart.click();
        }

        _startVRImpl = () => {
            vrStart.click();
        }
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
        tex.mapping = EquirectangularReflectionMapping;
        loadedTexture = tex;

        textureLoader.dispatchEvent(new CustomEvent("texture-loaded", { detail: loadedTexture } )); 
    } );

});

function loadFinished(evt: CustomEvent) {

    console.log("load finished", evt);
    const scene = evt.detail.context.scene;
    // fit(scene);
}

function fit(scene) {

    const size = new Vector3();
    const center = new Vector3();
    const box = new Box3();

    box.makeEmpty();
    scene.updateMatrixWorld();
    box.expandByObject(scene, true);

    box.getCenter(center);
    box.getSize(size);

    console.log("a", size, center);

    const child = scene.children[0];
    // scale scene up so that result is a 1x1x1m cube sitting so the bottom face is at y=0
    const scale = 1 / Math.max(size.x, size.y, size.z);
    child.scale.set(scale, scale, scale);
    child.position.set(-center.x * scale, -center.y * scale, -center.z * scale);


    // check what we have now
    box.makeEmpty();
    scene.updateMatrixWorld();
    box.expandByObject(scene, true);
    box.getCenter(center);
    box.getSize(size);
    console.log("b", size, center, scale);

}

</script>

<!-- <model-viewer camera-controls autoplay src={src} skybox-image={texture} environment-image={texture}></model-viewer> -->
<needle-engine 
    camera-controls src={src} 
    on:loadfinished={loadFinished} 
    environment-image={texture} 
    autoplay 
    loading-style="auto">
    <div class="ar">
        <slot></slot>
    </div>
</needle-engine>

<style>
needle-engine {
    display: block; 
    height: 400px;
    position: relative;
    /* width: 100%; */
    width: max(50vw, min(700px, 100vw));
    /* left: calc((100% - max(50vw, min(700px, 100vw))) / 2);*/

    margin-top: -20px;
    margin-bottom: 5px;
    border-radius: 2em;
}
</style>