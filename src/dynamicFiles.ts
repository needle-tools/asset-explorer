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
import { USDZExporter } from './USDZExporter';
import { FileLoader, Cache, LoadingManager } from 'three';
import subProcess from 'child_process';
import { conversionFamilies } from './conversionFamilies';

class NodeProgressEvent {}
(globalThis as any)["ProgressEvent"] = NodeProgressEvent;
(globalThis as any)["self"] = globalThis;
(globalThis as any)["HTMLElement"] = class HTMLElement {}

// find all glb files in folder
// const files = import.meta.glob("D:/git/pfc-packages-master/development/pfc-modelexporter/development/ModelConversion/Exports/**.glb", { eager: true });

export const legacySourceDir = "submodules/glTF-Sample-Models";
export const sampleAssetsDir = "submodules/glTF-Sample-Assets";
export const sourceDir = fs.existsSync(path.join(sampleAssetsDir, "Models")) ? sampleAssetsDir : legacySourceDir;
export const sourceSubfolder = sourceDir === sampleAssetsDir ? "/Models/" : "/2.0/";
export const originalRepoDir = sourceDir === sampleAssetsDir
    ? "https://github.com/KhronosGroup/glTF-Sample-Assets"
    : "https://github.com/KhronosGroup/glTF-Sample-Models";

const basePath = process.env.BASE_PATH || "";
const provenancePath = path.join(sourceDir, "conversion-provenance.json");
const legacyProvenancePath = "conversion-provenance.json";
const analysisDir = path.join(sourceDir, "conversion-analysis");
const legacyAnalysisDir = "conversion-analysis";

// experimental - allows us to use three.js from node
Cache.enabled = true;

function normalizePath(filePath: string) {
    return path.resolve(filePath).replaceAll("\\", "/");
}

let provenanceStatuses: Map<string, string> | null = null;
const assetAnalysisCache = new Map<string, any | null>();

function getProvenanceStatuses() {
    if (provenanceStatuses !== null) return provenanceStatuses;

    provenanceStatuses = new Map();
    const activeProvenancePath = fs.existsSync(provenancePath) ? provenancePath : legacyProvenancePath;
    if (!fs.existsSync(activeProvenancePath)) return provenanceStatuses;

    try {
        const provenance = JSON.parse(fs.readFileSync(activeProvenancePath, "utf8"));
        for (const conversion of provenance.conversions ?? []) {
            if (!conversion.usdz || !conversion.status) continue;
            provenanceStatuses.set(normalizePath(conversion.usdz), conversion.status);
        }
    }
    catch (error) {
        console.warn("Could not read conversion provenance", error);
    }

    return provenanceStatuses;
}

function getAssetAnalysis(sourceFile: string) {
    const slug = path.parse(sourceFile).name;
    if (assetAnalysisCache.has(slug)) return assetAnalysisCache.get(slug) ?? null;

    const fileName = encodeURIComponent(slug) + ".json";
    const analysisPath = fs.existsSync(path.join(analysisDir, fileName))
        ? path.join(analysisDir, fileName)
        : path.join(legacyAnalysisDir, fileName);
    if (!fs.existsSync(analysisPath)) {
        assetAnalysisCache.set(slug, null);
        return null;
    }

    try {
        const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
        assetAnalysisCache.set(slug, analysis);
        return analysis;
    }
    catch (error) {
        console.warn("Could not read conversion analysis for " + slug, error);
        assetAnalysisCache.set(slug, null);
        return null;
    }
}

function findConversionAnalysis(assetAnalysis: any | null, usdzPath: string) {
    if (!assetAnalysis) return null;
    return (assetAnalysis.conversions ?? []).find((conversion: any) => normalizePath(conversion.usdz) === usdzPath) ?? null;
}

function attachAssetAnalysis<T extends { paths?: any; conversions?: Array<any> }>(model: T) {
    const sourceFile = model.paths?.gltf;
    if (!sourceFile) return model;

    const analysis = getAssetAnalysis(sourceFile);
    return {
        ...model,
        analysis,
        conversions: (model.conversions ?? []).map((conversion: any) => ({
            ...conversion,
            analysis: findConversionAnalysis(analysis, conversion.usdzPath),
        })),
    };
}

function conversionBaseFile(sourceFile: string, suffix: string) {
    const slug = path.parse(sourceFile).name.replace(".glb", "");
    const legacyFile = path.join(legacySourceDir, "2.0", slug, "glTF-Binary", slug + ".glb");
    const legacySuffixes = new Set(["three", "blender", "ov"]);

    if (legacySuffixes.has(suffix) && fs.existsSync(legacyFile)) {
        return legacyFile;
    }

    return sourceFile;
}

function createConversionInfo(sourceFile: string) {
    return conversionFamilies.map((family) => {
        const baseFile = conversionBaseFile(sourceFile, family.suffix);
        const usdzPath = normalizePath(baseFile + "." + family.suffix + ".usdz");
        const screenshotPath = normalizePath(baseFile + "." + family.suffix + ".webp");
        const usdzUri = basePath + "/downloads/" + path.basename(usdzPath);
        const screenshotUri = basePath + "/downloads/" + path.basename(screenshotPath);
        const provenanceStatus = getProvenanceStatuses().get(usdzPath) ?? null;
        const available = provenanceStatus
            ? provenanceStatus === "success" && fs.existsSync(usdzPath)
            : fs.existsSync(usdzPath);

        return {
            ...family,
            usdzPath,
            screenshotPath,
            usdzUri,
            screenshotUri,
            sourcePath: normalizePath(baseFile),
            provenanceStatus,
            available,
            screenshotAvailable: available && fs.existsSync(screenshotPath),
        };
    });
}

function createGltfReferenceInfo(sourceFile: string) {
    const screenshotPath = normalizePath(sourceFile + ".gltf-reference.webp");
    return {
        screenshotPath,
        screenshotUri: basePath + "/downloads/" + path.basename(screenshotPath),
        available: fs.existsSync(screenshotPath),
    };
}

let lastCollectionResult : {files:Array<any>, images:Array<any>} | null = null;
async function collectFileInformation(filter: string | undefined = undefined, runConversions = false) {

    if (lastCollectionResult !== null) {
        return lastCollectionResult;
    }

    const runThreeConversion = false;
    const runBlenderConversion = false;
    const runOmniverseConversion = false;
    const runUsdChecksAndRender = false;

    // patch FileLoader to use fs instead of fetch
    const originalLoad = FileLoader.prototype.load;
    (FileLoader.prototype as any).load = function (url: string, onLoad?: (data: string | ArrayBuffer) => void, onProgress?: (event: ProgressEvent) => void, onError?: (err: unknown) => void) {
        try {
            const data = fs.readFileSync(url);
            Cache.add(url, data.buffer);
        }
        catch (e) {
            console.log("Error loading file", e);
        }
        return originalLoad.call(this, url, onLoad, onProgress, onError);
    }

    const fullPath = sourceDir + sourceSubfolder;
    // console.log("Loading files from " + fullPath);
    let files = globSync(fullPath + "**/glTF-Binary/*.glb").sort();//.map(f => f = process.cwd() + "/" + f);
    if (files.length === 0) {
        files = globSync(fullPath + "**/**.glb").sort();
    }
    
    // these files are excluded because of unclear licensing
    const fileExclusions = [
        "2CylinderEngine",
        "GearboxAssy",
        "ReciprocatingSaw",
        "Buggy",
    ];

    // filter out files
    files = files.filter(f => {
        for (const exclusion of fileExclusions) {
            if (f.startsWith(sourceDir + sourceSubfolder + exclusion))
                return false;
        }
        return true;
    });

    if (filter !== undefined) {
        files = files.filter(file => {
            const slug = path.parse(file).name.replace(".glb", "");
            return slug === filter;
        });
    }

    // take only 1
    // files = files.slice(6, 7);
    const images : Array<{absolutePath:string, targetPath:string}> = [];


    let mdPath = "";
    let mdDirName = "";

    let firstFoundH1 : string | null = null;
    let firstFoundImage : string | null = null;

    const slugger = new marked.Slugger()
    const originalRenderer = new marked.Renderer();
    const renderer = {

        image(href: string, title: string, text: string) {

            // check if this is an absolute URL
            const isAbsoluteUrl = href.startsWith("http://") || href.startsWith("https://");
            if (isAbsoluteUrl) {
                return false;
            }

            const targetPath = basePath + "/" + `resources/` + mdDirName + `/` + href;
            const directoryPart = path.dirname(href);
            images.push({
                absolutePath: path.resolve(mdPath, href).replaceAll("\\", "/"),
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
        link(href: string, title: string, text: string) {
            // TODO probably need to handle relative URLs and decide what to do with them.
            if (!href.startsWith("http"))
            { 
                // console.log("Found link: " + href);
            }

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

        heading(text: string, level: number) {
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

    const array: Array<any> = [];

    marked.use({renderer});

    for (const [index, file] of files.entries()) {
        const readmeFilePath = path.resolve(file, "../..", "Readme.md");
        const readmePath = globSync(readmeFilePath, { 
                nocase: true 
            }
        )[0];
        if(readmePath === undefined) {
            console.warn("> NO README found for " + file + "\nat " + readmeFilePath);
            continue;
        }

        const baseUrlPath = path.resolve(readmePath, "..");
        const dirName = path.parse(baseUrlPath).name;
        const metadataPath = path.resolve(baseUrlPath, "metadata.json");
        let assetGroups: string[] = [];
        if (fs.existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
                if (Array.isArray(metadata.tags))
                    assetGroups = metadata.tags.filter((tag: unknown) => typeof tag === "string");
            }
            catch (error) {
                console.warn("Could not read metadata tags for " + file, error);
            }
        }
        mdPath = baseUrlPath;
        mdDirName = dirName;

        const readmeInRepo = originalRepoDir + "/tree/main/" + path.relative(sourceDir, readmePath);
        const srcFileInRepo = originalRepoDir + "/tree/main/" + path.relative(sourceDir, file);

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
        const lights = doc.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
        const primitives = doc.meshes?.flatMap((mesh) => mesh.primitives ?? []) ?? [];
        const sparseAccessors = doc.accessors?.some((accessor) => accessor.sparse);
        const tangents = primitives.some((primitive) => primitive.attributes?.TANGENT !== undefined);
        const multipleUvSets = primitives.some((primitive) =>
            Object.keys(primitive.attributes ?? {}).some((attribute) => /^TEXCOORD_[1-9]/.test(attribute))
        );
        const doubleSidedMaterials = doc.materials?.some((material) => material.doubleSided);
        const morphAnimations = doc.animations?.some((animation) =>
            animation.channels?.some((channel) => channel.target?.path === "weights")
        );
        const anyUsesMask = doc.materials?.some((material) => material.alphaMode === 'MASK');
        const anyUsesBlend = doc.materials?.some((material) => material.alphaMode === 'BLEND');
        const generator = doc.asset?.generator;
        const copyright = doc.asset?.copyright;
        const docInfo : {[key:string]:any} = {
            vertexColors,
            blendShapes,
            textures,
            scenes,
            animations,
            skins,
            cameras,
            lights,
            alphaMask: anyUsesMask,
            alphaBlend: anyUsesBlend,
            tangents,
            multipleUvSets,
            doubleSidedMaterials,
            morphAnimations,
            sparseAccessors,
            generator,
            copyright,
            source: sourceDir === sampleAssetsDir ? "KhronosGroup/glTF-Sample-Assets" : "KhronosGroup/glTF-Sample-Models",
        };

        for (const ext of usedExtensions) {
            docInfo[ext] = true;
        }

        const checkAndRender = async (usdzFile: string, outputPrefix: string) => {
            
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
            /*
            await new Promise((resolve, reject) => {
                const screenshotPath = path.resolve(file, "..", fileName + ".webp");
                subProcess.exec('  "' + usdzFile + '" ' + screenshotPath, (err, stdout, stderr) => {
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
            */

            // run screenshot generation with generate_thumbnail
            await new Promise((resolve, reject) => {
                const intermediatePath = path.resolve(file, "..", fileName + ".png");
                const screenshotPath = path.resolve(file, "..", fileName + ".webp");
                const domeLightAbsPath = path.resolve("src/lib/images/neutral.hdr").replaceAll("\\", "/");
                const cmd = 'python3 usd/generate_thumbnail.py "' + usdzFile + '" ' + '--dome-light ' + '"' + domeLightAbsPath + '"' + ' --width 900 --height 760 --output-extension png'
                    + ' && cwebp -q 90 -alpha_q 100 -m 6 "' + intermediatePath + '" -o "' + screenshotPath + '"'
                    + ' && rm -f "' + intermediatePath + '"';
                
                // console.log("        " + cmd)
                subProcess.exec(cmd, (err, stdout, stderr) => {
                    if (err) {
                        console.log("❌ " + fileName + " failed generate_thumbnail");
                        console.group();
                        console.log(`${stdout.toString()}`);
                        console.log(`${stderr.toString()}`);
                        console.groupEnd();
                    } else {
                        console.log("✓ " + fileName + " rendered with generate_thumbnail");
                    }
                    resolve(true);
                })
            });
        };
        
        // USDZ conversion
        const fileName = path.parse(file).name;
        const conversions = createConversionInfo(file);
        const gltfReference = createGltfReferenceInfo(file);
        const legacyThree = conversions.find((conversion) => conversion.suffix === "three");
        const legacyBlender = conversions.find((conversion) => conversion.suffix === "blender");
        const legacyOmniverse = conversions.find((conversion) => conversion.suffix === "ov");
        const usdzFilePath = legacyThree?.usdzPath ?? file + ".three.usdz";
        const ovUsdzFilePathAbs = legacyOmniverse?.usdzPath ?? normalizePath(file + ".ov.usdz");
        
        if (runConversions && (runThreeConversion || runBlenderConversion || runOmniverseConversion))
            console.log("Converting " + fileName + " to USDZ");
        
        console.group();
        try {
            let usdzArrayBuffer : ArrayBuffer | null = null;
            if (runConversions && runThreeConversion) {
                usdzArrayBuffer = await new Promise((resolve, reject) => {
                    try {
                        // const manager = new LoadingManager();
                        const loader = new GLTFLoader();
                        loader.load(file, async function (gltf: any) {
                            console.log("✓ " + fileName + " loaded with GLTFLoader");

                            const exporter = new USDZExporter();
                            gltf.scene.updateMatrixWorld();
                            // console.log("exporter: ", exporter + ", scene: ", gltf.scene)

                            const arrayBuffer = await exporter.parse( gltf.scene);
                            console.log("✓ " + fileName + " exported with three.js USDZExporter")
                            resolve(arrayBuffer);
                            return

                        }, undefined, function (error: unknown) {
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
                }
            }
            
            if (runUsdChecksAndRender && legacyThree && fs.existsSync(legacyThree.usdzPath))
                await checkAndRender(legacyThree.usdzPath, "three");

            if (runConversions && runBlenderConversion) {
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
            }

            if (runUsdChecksAndRender && legacyBlender && fs.existsSync(legacyBlender.usdzPath))
                await checkAndRender(legacyBlender.usdzPath, "blender");

            if (runConversions && runOmniverseConversion) {
                await new Promise((resolve, reject) => {
                    const kitPath = "C:/Users/herbst/AppData/Local/ov/pkg/code-2023.1.1/kit";
                    const cmd = kitPath + ' --enable omni.kit.asset_converter --exec "omniverse/convert_to_usdz.py ' + file + ' ' + ovUsdzFilePathAbs + '"';

                    subProcess.exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.log("❌ " + fileName + " failed Omniverse conversion");
                            console.group();
                            console.log(`${stdout.toString()}`);
                            console.log(`${stderr.toString()}`);
                            console.groupEnd();
                        } else {
                            console.log("✓ " + fileName + " converted to USDZ with Omniverse");
                        }
                        resolve(true);
                    });
                });
            }

            if (runUsdChecksAndRender && legacyOmniverse && fs.existsSync(legacyOmniverse.usdzPath))
                await checkAndRender(legacyOmniverse.usdzPath, "ov");
        }
        catch (e) {
            console.log("❌ " + fileName + " failed to convert to usdz: ", e);
        }

        console.groupEnd();

        array.push({
            // make canonical path
            paths: {
                gltf: normalizePath(file),
                gltfPreviewScreenshot: gltfReference.available ? gltfReference.screenshotPath : firstFoundImage,
                conversions,
            },
            name: path.parse(file).name,
            displayName: firstFoundH1 || path.parse(file).name,
            slug: path.parse(file).name.replace(".glb", ""),

            previewUri: gltfReference.available ? gltfReference.screenshotUri : firstFoundImage,
            sourcePreview: gltfReference,
            uri: basePath + "/" + path.parse(file).name,
            downloadUri: basePath + "/downloads/" + path.parse(file).name + ".glb",
            readmeSrc: readmeInRepo,
            originalFileSrc: srcFileInRepo,
            sourceRepoUrl: originalRepoDir,
            conversions,
            groups: assetGroups,
            
            size: fs.existsSync(file) ? fs.statSync(file).size : 0,
            key: index,
            readme: readmeText,
            info: docInfo,
        })
    }

    // restore monkey patching
    FileLoader.prototype.load = originalLoad;

    // cache results

    lastCollectionResult = {
        files: array,
        images: images,
    };

    return lastCollectionResult;
}

// console.log(images);

export { attachAssetAnalysis, collectFileInformation };
