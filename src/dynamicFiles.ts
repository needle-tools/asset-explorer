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
// import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
// import { USDZExporter } from '@needle-tools/engine';
import { USDZExporter } from './USDZExporter';
import { FileLoader, Cache, LoadingManager } from 'three';
import subProcess from 'child_process';

class ProgressEvent {}
globalThis["ProgressEvent"] = ProgressEvent;
globalThis["self"] = globalThis;
globalThis["HTMLElement"] = class HTMLElement {}

// find all glb files in folder
// const files = import.meta.glob("D:/git/pfc-packages-master/development/pfc-modelexporter/development/ModelConversion/Exports/**.glb", { eager: true });

export const sourceDir = "submodules/glTF-Sample-Models/2.0/"; //"E:/git/glTF-Sample-Models/2.0/";

const basePath = process.env.BASE_PATH || "";

// experimental - allows us to use three.js from node

Cache.enabled = true;

async function collectFileInformation(runConversions = false) {

    const runThreeConversion = false;
    const runBlenderConversion = false;
    const runUsdChecksAndRender = false;

    // patch FileLoader to use fs instead of fetch
    const originalLoad = FileLoader.prototype.load;
    FileLoader.prototype.load = function (url, onLoad, onProgress, onError) {

        // console.log("file loader: " + url);
        try {
            const data = fs.readFileSync(url);
            Cache.add(url, data.buffer);
        }
        catch (e) {
            console.log("Error loading file", e);
        }
        return originalLoad.call(this, url, onLoad, onProgress, onError);
    }

    let files = globSync(sourceDir + "**/**.glb").sort();
    // take only 1
    // files = files.slice(6, 7);
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

            const targetPath = basePath + "/" + `resources/` + mdDirName + `/` + href;
            const directoryPart = path.dirname(href);
            images.push({
                absolutePath: path.resolve(mdPath, href),
                targetPath: "resources/" + mdDirName + "/" + directoryPart,
            });
            
            // seems we can't just call the base implementation, so
            // this is a rough copy of the base implementation that does less sanitization.
            // return false;

            if (!firstFoundImage)
                firstFoundImage = targetPath;

            let out = `<img src="${targetPath}" alt="${text}"`;
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
            source: "glTF-Sample-Models",
        };

        for (const ext of usedExtensions) {
            docInfo[ext] = true;
        }
        
        const checkAndRender = async (usdzFile, outputPrefix) => {

            if (!runUsdChecksAndRender) return;

            const fileName = path.parse(usdzFile).name;

            // run usdchecker
            await new Promise((resolve, reject) => {
                // run through usdchecker
                subProcess.exec('usdchecker "' + usdzFile + '"', (err, stdout, stderr) => {
                    if (err) {
                        console.log("❌ " + fileName + " failed usdchecker");
                        console.group();
                        console.log(`${stdout.toString()}`);
                        console.log(`${stderr.toString()}`);
                        console.groupEnd();
                        // process.exit(1);
                    } else {
                        console.log("✓ " + fileName + " passed usdchecker");
                    }
                    resolve(true);
                })
            });

            // run screenshot generation with usdrecord
            await new Promise((resolve, reject) => {
                const screenshotPath = path.resolve(file, "..", fileName + ".png");
                subProcess.exec('usdrecord "' + usdzFile + '" ' + screenshotPath, (err, stdout, stderr) => {
                    if (err) {
                        console.log("❌ " + fileName + " failed usdrecord");
                        console.group();
                        console.log(`${stdout.toString()}`);
                        console.log(`${stderr.toString()}`);
                        console.groupEnd();
                    } else {
                        console.log("✓ " + fileName + " rendered with usdrecord");
                    }
                    resolve(true);
                })
            });
        };
        
        // USDZ conversion
        const fileName = path.parse(file).name;
        
        const usdzFilePath = file + ".three.usdz";
        const usdzFilePathAbs = path.resolve(usdzFilePath);
        const usdzScreenshot = file + ".three.png";
        const usdzScreenshotAbs = path.resolve(usdzScreenshot);

        const blenderUsdzFilePath = file + ".blender.usdz";
        const blenderUsdzFilePathAbs = path.resolve(blenderUsdzFilePath);
        const blenderUsdzScreenshot = file + ".blender.png";
        const blenderUsdzScreenshotAbs = path.resolve(blenderUsdzScreenshot);
        
        if (runConversions && (runThreeConversion || runBlenderConversion))
            console.log("Converting " + fileName + " to USDZ");
        
        console.group();
        try {
            let usdzArrayBuffer : ArrayBuffer | null = null;
            if (runConversions && runThreeConversion) {
                usdzArrayBuffer = await new Promise((resolve, reject) => {
                    try {
                        // const manager = new LoadingManager();
                        const loader = new GLTFLoader();
                        loader.load(file, async function (gltf) {
                            console.log("✓ " + fileName + " loaded with GLTFLoader");
            
                            const exporter = new USDZExporter();
                            gltf.scene.updateMatrixWorld();
                            // console.log("exporter: ", exporter + ", scene: ", gltf.scene)

                            const arrayBuffer = await exporter.parse( gltf.scene);
                            console.log("✓ " + fileName + " exported with three.js USDZExporter")
                            resolve(arrayBuffer);
                            return

                        }, undefined, function (error) { 
                            console.log("❌ " + fileName + " failed to load: ", error);
                            // reject(error);
                            resolve(null);
                            return;
                        });
                    }
                    catch (e) {
                        console.log("❌ " + fileName + " failed to load: ", e);
                        // reject(e);
                        resolve(null);
                        return;
                    }

                });

                // save to disk
                if (usdzArrayBuffer) {
                    fs.writeFileSync(usdzFilePath, Buffer.from(usdzArrayBuffer));
                    await checkAndRender(usdzFilePathAbs, "three");
                }
            }

            if (usdzArrayBuffer && runConversions && runBlenderConversion) {
                // blender conversion
                await new Promise((resolve, reject) => {
                    // /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/blender_gltf_converter.py -- -mp "/Users/herbst/Downloads/2CylinderEngine.glb"
                    const blenderPath = '/Applications/Blender.app/Contents/MacOS/Blender';
                    const cmd = blenderPath + ' -b -P blender/blender_gltf_converter.py -- -mp "' + file + '"';

                    subProcess.exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.log("❌ " + fileName + " failed blender conversion");
                            console.group();
                            console.log(`${stdout.toString()}`);
                            console.log(`${stderr.toString()}`);
                            console.groupEnd();
                        } else {
                            console.log("✓ " + fileName + " converted to USDZ with Blender");
                        }
                        resolve(true);
                    });
                });

                await checkAndRender(blenderUsdzFilePathAbs, "blender");
            }

        }
        catch (e) {
            console.log("❌ " + fileName + " failed to convert to usdz: ", e);
        }

        console.groupEnd();

        array.push({
            // make canonical path
            paths: {
                gltf: path.resolve(file).replaceAll("\\", "/"),
                gltfPreviewScreenshot: firstFoundImage,
                threeUsdz: usdzFilePathAbs,
                threeScreenshot: usdzScreenshotAbs,
                blenderUsdz: blenderUsdzFilePathAbs,
                blenderScreenshot: blenderUsdzScreenshotAbs,
            },
            name: path.parse(file).name,
            displayName: firstFoundH1 || path.parse(file).name,

            previewUri: firstFoundImage,
            uri: basePath + "/models/" + path.parse(file).name,
            downloadUri: basePath + "/downloads/" + path.parse(file).name + ".glb",
            
            size: fs.existsSync(file) ? fs.statSync(file).size : 0,
            key: index,
            readme: readmeText,
            info: docInfo,
        })
    }

    // restore monkey patching
    FileLoader.prototype.load = originalLoad;

    return {
        files: array,
        images: images,
    };
}

// console.log(images);

export { collectFileInformation };