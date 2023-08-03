<script lang="ts" context="module">
export let isInitialized = false;
import { browser } from '$app/environment';
import texture from './../lib/images/neutral.hdr?url';
</script>

<script lang="ts">

export let src: string | null = null;
let context;
let orbitControls;

import { onDestroy, onMount } from 'svelte';
import { EquirectangularReflectionMapping, Object3D, Texture, ACESFilmicToneMapping, Vector3, Vector2, Box3, Box3Helper, GridHelper } from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let _startARImpl: () => void;
let _startVRImpl: () => void;
let _generateUsdzImpl: () => void;

export let arSessionActive = false;
export let isFullscreen = false;
let _isFullscreen = false;

export let arSupported = false;
export let vrSupported = false;

export function startAR() {
    _startARImpl();
}

export function startVR() {
    _startVRImpl();
}

export function generateUsdz() {
    _generateUsdzImpl();
}

export async function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        const { NeedleEngine, RGBAColor } = await import('@needle-tools/engine');
        // NeedleEngine.Current.mainCameraComponent.backgroundColor = new RGBAColor(0,0,255,1);
        NeedleEngine.Current.domElement.requestFullscreen();
    }
}

async function loadSrcFile(src: string | null) {

    const { SceneSwitcher, GameObject, OrbitControls, Context } = await import('@needle-tools/engine');

    if (!src) return;
    const _src = src;

    if (!Context.Current) return;

    const sceneSwitcher = GameObject.findObjectOfType(SceneSwitcher)!;
    const orbitControls = GameObject.findObjectOfType(OrbitControls)!;
    if (!sceneSwitcher) return;

    await sceneSwitcher.select(_src);

    sceneSwitcher.gameObject.updateMatrixWorld();
    console.log(_src, sceneSwitcher.gameObject.position, sceneSwitcher.gameObject.scale)
    
    sceneSwitcher.gameObject.position.set(0,0,0);
    sceneSwitcher.gameObject.scale.set(1,1,1);
    
    if (arSessionActive) // scale so objects fit nicer in AR - currently breaks lighting and transmission
        fit(sceneSwitcher.gameObject);

    if (!arSessionActive)
        orbitControls.fitCamera();
    
    console.log(_src, sceneSwitcher.gameObject.position, sceneSwitcher.gameObject.scale)
}

$: {
    if (!import.meta.env.SSR) {
        loadSrcFile(src);
    }
}

// TODO this ain't great as the context callbacks should be global instead of added each time here.
// better would be 
// a) an event directly on needle-engine for the context being loaded that we can listen to and do work each time
// b) adding the callbacks globally but so that they're still only on the client
onMount(async () => {
    // if (isInitialized) return;
    // isInitialized = true;

    // window.NEEDLE_ENGINE_META = { version: "custom", generator: "svelte-kit" };
    // window.NEEDLE_USE_RAPIER = false;
    const { Context, NeedleEngine, ContextEvent, GameObject, WebXR, Camera, WebARSessionRoot, USDZExporter, RGBAColor, OrbitControls, WebXREvent, SceneSwitcher, Gizmos } = await import('@needle-tools/engine');
    contextCreated = (evt) => {

        const ctx = evt.context;
        context = ctx;

        if (ctx == null || ctx.renderer == null) return;

        if (!ctx.mainCameraComponent) {
            const cam = new Object3D();
            ctx.mainCameraComponent = GameObject.addNewComponent(cam, Camera);
        }

        if (ctx.mainCameraComponent) {
            ctx.mainCameraComponent.fieldOfView = 25;   
            ctx.mainCameraComponent.backgroundBlurriness = 1; 
            ctx.mainCameraComponent.backgroundColor = new RGBAColor(0,0,0,0);
        }

        // AcesFilmicToneMapping
        ctx.renderer.toneMapping = ACESFilmicToneMapping;
        ctx.renderer.domElement.style.touchAction = "pan-y";

        let controls = GameObject.findObjectOfType(OrbitControls, ctx);
        if (!controls)
            controls = GameObject.addNewComponent(ctx.mainCamera, OrbitControls);

        if (controls) 
            controls.enableKeys = false;
            // controls!.enableZoom = false;
        
        orbitControls = controls;

        setTimeout(() => {
            if (!isFullscreen)
                ctx.domElement.style.touchAction = "pan-y";
            // Gizmos.DrawBox(new Vector3(0,0.5,0), new Vector3(1,1,1), new RGBAColor(255,0,0,1), 10000);
        }, 500);
        
        const xr = new Object3D();
        xr.name = "XR";
        const webXR = GameObject.addNewComponent(xr, WebXR);
        
        webXR.createVRButton = false;
        webXR.createARButton = false;
        
        GameObject.addNewComponent(xr, WebARSessionRoot);
        const usdzExporter = GameObject.addNewComponent(xr, USDZExporter);
        usdzExporter.allowCreateQuicklookButton = false;

        const switcher = new Object3D();
        switcher.name = "Scene Switcher";
        GameObject.addNewComponent(switcher, SceneSwitcher);
        xr.add(switcher);

        ctx.scene.add(xr);
        
        const arStart = WebXR.createARButton(webXR);
        const vrStart = WebXR.createVRButton(webXR);

        arSupported = WebXR.IsARSupported;
        vrSupported = WebXR.IsVRSupported;

        WebXR.addEventListener(WebXREvent.XRStarted, () => {
            const sw = GameObject.findObjectOfType(SceneSwitcher);
            if (sw) fit(sw.gameObject);

            arSessionActive = true;
        });
        WebXR.addEventListener(WebXREvent.XRStopped, () => {
            arSessionActive = false;
            const or = GameObject.findObjectOfType(OrbitControls);
            if (or)
                or.fitCamera();
            const root = GameObject.findObjectOfType(WebARSessionRoot);
            root?.gameObject.position.set(0,0,0);
            root?.gameObject.scale.set(1,1,1);
        });

        _startARImpl = () => {
            arStart.click();
        }

        _startVRImpl = () => {
            vrStart.click();
        }

        _generateUsdzImpl = () => {
            usdzExporter.exportAsync();
        }

        loadSrcFile(src);
    };

    if (Context.Current) {
        contextCreated({ context: Context.Current });
    }
    NeedleEngine.addContextCreatedCallback(contextCreated);

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

    document.addEventListener("fullscreenchange", fullscreenChange);
    document.addEventListener("keydown", keydown);
});

let contextCreated;

function fullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
    _isFullscreen = isFullscreen;
    if (context)
        context.domElement.style.touchAction = _isFullscreen ? "none" : "pan-y";
}

function keydown(evt: KeyboardEvent) {
    if (evt.key === "f" && orbitControls) {
        orbitControls.fitCamera();
    }
}

onDestroy(async () => {
    console.log("REMOVING EVENTS AGAIN")
    if (browser) {
        document.removeEventListener("fullscreenchange", fullscreenChange);
        document.removeEventListener("keydown", keydown);

        const { NeedleEngine, ContextEvent } = await import('@needle-tools/engine');
        NeedleEngine.unregisterCallback(ContextEvent.ContextCreated, contextCreated);
    }
});

async function loadFinished(evt: CustomEvent) {}

function fit(scene) {

    if (!scene) 
        console.warn("no scene, can't fit");
    
    const size = new Vector3();
    const center = new Vector3();
    const box = new Box3();

    box.makeEmpty();
    scene.updateMatrixWorld();
    box.expandByObject(scene, true);

    box.getCenter(center);
    box.getSize(size);

    console.log("a", size, center);

    const child = scene;
    // scale scene up so that result is a 1x1x1m cube sitting so the bottom face is at y=0
    const scale = 1 / Math.max(size.x, size.y, size.z);
    child.scale.set(scale, scale, scale);
    child.position.set(-center.x * scale, -center.y * scale + 0.5, -center.z * scale);

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
    camera-controls
    on:loadfinished={loadFinished} 
    environment-image={texture} 
    autoplay 
    loading-style="auto">
    <div class="ar desktop {_isFullscreen ? 'is-fullscreen' : ''}">
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

div:fullscreen {
    bottom: 20px;
}

div {
    position: absolute;
    bottom: -70px;
    width: 100%;
    justify-content: center;
    display: flex;
    overflow: hidden;
}

:global(.ar-session-active > div),
:global(div.is-fullscreen) {
    bottom: 20px;
}
</style>