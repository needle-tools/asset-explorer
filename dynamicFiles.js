/// helpful stuff
// https://joshcollinsworth.com/blog/build-static-sveltekit-markdown-blog/

// we're in nodejs here; we can use path and so on
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';

import { marked } from 'marked';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { FileLoader, Cache } from 'three';

// find all glb files in folder
// const files = import.meta.glob("D:/git/pfc-packages-master/development/pfc-modelexporter/development/ModelConversion/Exports/**.glb", { eager: true });

export const sourceDir = "/Users/herbst/git/glTF-Sample-Models/2.0/"; //"E:/git/glTF-Sample-Models/2.0/";

// experimental - allows us to use three.js from node
class ProgressEvent {}
globalThis["ProgressEvent"] = ProgressEvent;
globalThis["self"] = globalThis;
Cache.enabled = true;

// patch FileLoader to use fs instead of fetch
const originalLoad = FileLoader.prototype.load;
FileLoader.prototype.load = function (url, onLoad, onProgress, onError) {

    console.log("file loader: " + url);
    try {
        const data = fs.readFileSync(url);
        Cache.add(url, data.buffer);
    }
    catch (e) {
        console.log("Error loading file", e);
    }
    return originalLoad.call(this, url, onLoad, onProgress, onError);

    /*
    if (url.startsWith('blob:')) return originalLoad.call(this, url, onLoad, onProgress, onError);

    fs.readFile(url, (err, data) => {
        if (err) {
            onError(err);
            return;
        }
        else {
            onLoad(data);
        }
    });

    console.log("loading", url);

    */
    /*
    // fetch the file with fs and create a in-memory URL 
    // that we can pass on.
    const blob = URL.createObjectURL(new Blob([fs.readFileSync(url)]));
    return originalLoad.call(this, blob, onLoad, onProgress, onError);
    */
}

async function collectFileInformation() {

    const files = globSync(sourceDir + "**/**.glb").sort();
    const images = [];
    // console.log("ALL FILES", files);

    /*
    declare type File = {
        path: string,
        name: string,
        uri: string,
    }
    */

    let mdPath = "";
    let mdDirName = "";

    /** @type{string | null} */
    let firstFoundH1 = null;
    /** @type{string | null} */
    let firstFoundImage = null;

    const slugger = new marked.Slugger()
    const originalRenderer = new marked.Renderer();
    const renderer = {

    /**
     * @param {string} href
     * @param {string} title
     * @param {string} text
     */
        image(href, title, text) {

            // check if this is an absolute URL
            const isAbsoluteUrl = href.startsWith("http://") || href.startsWith("https://");
            if (isAbsoluteUrl) {
                return false;
            }

            const targetPath = `resources/` + mdDirName + `/` + href;
            const directoryPart = path.dirname(href);
            images.push({
                absolutePath: path.resolve(mdPath, href),
                targetPath: "resources/" + mdDirName + "/" + directoryPart,
            });
            
            // seems we can't just call the base implementation, so
            // this is a rough copy of the base implementation that does less sanitization.
            // return false;

            if (!firstFoundImage)
                firstFoundImage = "/" + targetPath;

            let out = `<img src="/${targetPath}" alt="${text}"`;
            if (title) {
            out += ` title="${title}"`;
            }
            out += '/>';
            return out;
        },
        link(href, title, text) {
            // TODO probably need to handle relative URLs and decide what to do with them.
            if (!href.startsWith("http"))
                console.log("Found link: " + href);

            if (href.toLowerCase().endsWith("/readme.md"))
                // strip it out
                href = href.substring(0, href.length - 10);

            switch(href) {
                case "/NormalTangentTest":
                    href ="/models/NormalTangentTest";
                    break;
                case "/NormalTangentMirrorTest":
                    href ="/models/NormalTangentMirrorTest";
                    break;
                case "/WaterBottle/":
                    href ="/models/WaterBottle";
                    break;
                case "/TextureTransformTest":
                    href ="/models/TextureTransformTest";
                    break;
                case "/AnimatedMorphCube":
                    href ="/models/AnimatedMorphCube";
                    break;
                default:
                    break;
            }

            return originalRenderer.link(href, title, text);
        },

        heading(text, level) {
            const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
        
            if (level === 1 && !firstFoundH1)
                firstFoundH1 = text;

            return `
                    <h${level}>
                    ${text}
                    <a name="${escapedText}" class="anchor" href="#${escapedText}">
                        <span class="header-link"></span>
                    </a>
                    </h${level}>`;
        },
    };

    // glTF reader
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': await draco3d.createDecoderModule(),
        });

    /** @type {Array<{path:string, name:string, displayName: string, uri:string, previewUri: string | null, downloadUri:string, size: number, key: number, readme: string}>} */
    const array = [];

    marked.use({renderer});

    for (const [index, file] of files.entries()) {
        const readmePath = globSync(
            path.resolve(file, "../..", "**/Readme.md"), 
            { 
                nocase: true 
            }
        )[0];

        const baseUrlPath = path.resolve(readmePath, "..");
        const dirName = path.parse(baseUrlPath).name;
        mdPath = baseUrlPath;
        mdDirName = dirName;

        firstFoundH1 = null;
        firstFoundImage = null;
        const readmeText = marked.parse(
            fs.readFileSync(
                readmePath,
                {
                    encoding: 'utf8',
                }
            ),
            { 
                headerIds: false, 
                mangle: false, 
                gfm: true,
            },
        )

        // parse file, get extensions and other data
        /*
        const doc = await io.read(file);
        const usedExtensions = doc.getRoot().listExtensionsUsed().map((extension) => extension.extensionName);
        const vertexColors = doc.getRoot().listMeshes().some((mesh) => mesh.listPrimitives().some((primitive) => primitive.getAttribute('COLOR_0')));
        const blendShapes = doc.getRoot().listMeshes().some((mesh) => mesh.listPrimitives().some((primitive) => primitive.listTargets().length > 0));
        const textures = doc.getRoot().listTextures().length;
        const scenes = doc.getRoot().listScenes().length;
        const animations = doc.getRoot().listAnimations().length;
        const skins = doc.getRoot().listSkins().length;
        const cameras = doc.getRoot().listCameras().length;
        const anyUsesMask = doc.getRoot().listMaterials().some((material) => material.getAlphaMode() === 'MASK');
        const anyUsesBlend = doc.getRoot().listMaterials().some((material) => material.getAlphaMode() === 'BLEND');
        const generator = doc.getRoot().getAsset().generator;
        const copyright = doc.getRoot().getAsset().copyright;
        */

        const doc = (await io.readAsJSON(file)).json;
        const usedExtensions = doc.extensionsUsed || [];
        const vertexColors = doc.meshes?.some((mesh) => mesh.primitives.some((primitive) => primitive.attributes.COLOR_0));
        const blendShapes = doc.meshes?.some((mesh) => mesh.primitives.some((primitive) => primitive.targets?.length ?? 0 > 0));
        const textures = doc.textures?.length ?? 0;
        const scenes = doc.scenes?.length ?? 0;
        const animations = doc.animations?.length ?? 0;
        const skins = doc.skins?.length ?? 0;
        const cameras = doc.cameras?.length ?? 0;
        const anyUsesMask = doc.materials?.some((material) => material.alphaMode === 'MASK');
        const anyUsesBlend = doc.materials?.some((material) => material.alphaMode === 'BLEND');
        const generator = doc.asset?.generator;
        const copyright = doc.asset?.copyright;
        const docInfo = {
            vertexColors,
            blendShapes,
            textures,
            scenes,
            animations,
            skins,
            cameras,
            alphaMask: anyUsesMask,
            alphaBlend: anyUsesBlend,
            generator,
            copyright,
        };

        for (const ext of usedExtensions) {
            docInfo[ext] = true;
        }

        // console.log(usedExtensions, docInfo)

        /*
        // USDZ conversion
        await new Promise((resolve, reject) => {

            try {
                const loader = new GLTFLoader();
                loader.load(file, async function (gltf) {
                    console.log("✓ " + file + " loaded successfully");
    
                    const exporter = new USDZExporter();
                    // console.log("exporter: ", exporter + ", scene: ", gltf.scene)

                    exporter.parse( gltf.scene, function ( result ) {
                        console.log("✓✓✓ " + result);
                        resolve(result);
                    }, undefined, function ( error ) {
                        console.log(error);
                        reject(error);
                    });
                    resolve("ok");

                }, undefined, function (error) { 
                    console.log("❌ " + file + " failed to load: " + error);
                    reject(error);
                });
            }
            catch (e) {
                console.log("❌ " + file + " failed to load: " + e);
                reject(e);
            }

        });
        */

        array.push({
            // make canonical path
            path: path.resolve(file).replaceAll("\\", "/"),
            name: path.parse(file).name,
            displayName: firstFoundH1 || path.parse(file).name,
            previewUri: firstFoundImage,
            uri: "/models/" + path.parse(file).name,
            downloadUri: "/downloads/" + path.parse(file).name + ".glb",
            size: fs.existsSync(file) ? fs.statSync(file).size : 0,
            key: index,
            // get readme file related to this one by traversing directory up and looking for Readme.md (in any casing)
            readme: readmeText,
            info: docInfo,
        })
    }

    return {
        files: array,
        images: images,
    };
}

// console.log(images);

export { collectFileInformation };