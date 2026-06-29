<script lang="ts">
    import { onMount } from "svelte";

    let status = "idle";

    function log(line: string) {
        status += "\n" + line;
        console.log(line);
    }

    onMount(() => {
        let renderer: any = null;
        let scene: any = null;
        let environment: any = null;
        let activeEnvironmentKey: string | null = null;
        let hdrTexture: any = null;
        let pmrem: any = null;
        let modulesPromise: Promise<any> | null = null;

        function disposeMaterial(material: any) {
            for (const value of Object.values(material)) {
                if (value && typeof value === "object" && "isTexture" in value) {
                    (value as any).dispose?.();
                }
            }
            material.dispose?.();
        }

        function createMirroredEquirectangularTexture(texture: any, mirrorX: boolean, mirrorY: boolean) {
            const image = texture.image;
            const data = image?.data;
            const width = image?.width;
            const height = image?.height;
            if (!data || !width || !height) throw new Error("Cannot mirror environment texture without image data");

            const elementSize = data.length / (width * height);
            const mirroredData = new data.constructor(data.length);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const sourceX = mirrorX ? width - 1 - x : x;
                    const sourceY = mirrorY ? height - 1 - y : y;
                    const sourceOffset = (sourceY * width + sourceX) * elementSize;
                    const targetOffset = (y * width + x) * elementSize;
                    for (let channel = 0; channel < elementSize; channel++) {
                        mirroredData[targetOffset + channel] = data[sourceOffset + channel];
                    }
                }
            }

            const mirroredTexture = texture.clone();
            mirroredTexture.image = { ...image, data: mirroredData };
            mirroredTexture.needsUpdate = true;
            return mirroredTexture;
        }

        function updateEnvironment(mirrorX: boolean, mirrorY: boolean, textureFlipY: boolean | null, equirectangularMapping: number) {
            const resolvedFlipY = textureFlipY ?? hdrTexture.flipY;
            const environmentKey = `${mirrorX}:${mirrorY}:${resolvedFlipY}`;
            if (environment && activeEnvironmentKey === environmentKey) return;
            environment?.dispose?.();

            const sourceTexture = mirrorX || mirrorY || resolvedFlipY !== hdrTexture.flipY
                ? createMirroredEquirectangularTexture(hdrTexture, mirrorX, mirrorY)
                : hdrTexture;
            sourceTexture.flipY = resolvedFlipY;
            sourceTexture.mapping = equirectangularMapping;
            environment = pmrem.fromEquirectangular(sourceTexture).texture;
            scene.environment = environment;
            activeEnvironmentKey = environmentKey;

            if (sourceTexture !== hdrTexture) sourceTexture.dispose?.();
        }

        function disposeObject(root: any) {
            root.traverse?.((object: any) => {
                object.geometry?.dispose?.();
                if (Array.isArray(object.material)) object.material.forEach(disposeMaterial);
                else if (object.material) disposeMaterial(object.material);
            });
        }

        function materialNeedsDepthOrdering(material: any) {
            return Boolean(
                material?.transparent ||
                material?.opacity < 1 ||
                material?.transmission > 0 ||
                material?.alphaTest > 0
            );
        }

        function compareRenderOrder(a: any, b: any) {
            if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
            if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;

            const depthA = a.object?.userData?.referenceDepth;
            const depthB = b.object?.userData?.referenceDepth;
            if (depthA !== undefined || depthB !== undefined) {
                const resolvedDepthA = depthA ?? a.z;
                const resolvedDepthB = depthB ?? b.z;
                if (resolvedDepthA !== resolvedDepthB) return resolvedDepthB - resolvedDepthA;
            }

            if (a.z !== b.z) return b.z - a.z;
            return a.id - b.id;
        }

        function applyDepthRenderOrder(root: any, camera: any, Box3: any, Vector3: any) {
            const viewDirection = new Vector3();
            const meshBounds = new Box3();
            const meshCenter = new Vector3();
            camera.getWorldDirection(viewDirection);

            root.traverse?.((object: any) => {
                if (!object.isMesh) return;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                if (!materials.some(materialNeedsDepthOrdering)) {
                    object.renderOrder = 0;
                    delete object.userData.referenceDepth;
                    return;
                }

                meshBounds.setFromObject(object);
                meshBounds.getCenter(meshCenter);
                const depth = meshCenter.sub(camera.position).dot(viewDirection);
                object.renderOrder = 0;
                object.userData.referenceDepth = depth;
            });
        }

        async function getModules() {
            modulesPromise ??= Promise.all([
                import("three"),
                import("three/examples/jsm/loaders/GLTFLoader.js"),
                import("three/examples/jsm/loaders/RGBELoader.js"),
            ]);
            return modulesPromise;
        }

        (window as any).runGltfReferenceRender = async ({
            inputUrl,
            environmentUrl,
            environmentMirrorX = false,
            environmentMirrorY = false,
            environmentTextureFlipY = true,
            environmentRotationX = 0,
            environmentRotationY = Math.PI * 1.5,
            environmentRotationZ = 0,
            width = 900,
            height = 760,
            fieldOfView = 35,
            cameraPadding = 1.12,
            imageMimeType = "image/webp",
            imageQuality = 0.9,
        }: {
            inputUrl: string;
            environmentUrl: string;
            environmentMirrorX?: boolean;
            environmentMirrorY?: boolean;
            environmentTextureFlipY?: boolean | null;
            environmentRotationX?: number;
            environmentRotationY?: number;
            environmentRotationZ?: number;
            width?: number;
            height?: number;
            fieldOfView?: number;
            cameraPadding?: number;
            imageMimeType?: string;
            imageQuality?: number;
        }) => {
            status = "loading " + inputUrl;
            const [
                {
                    Box3,
                    Color,
                    EquirectangularReflectionMapping,
                    NoToneMapping,
                    PerspectiveCamera,
                    PMREMGenerator,
                    Scene,
                    SRGBColorSpace,
                    Vector3,
                    WebGLRenderer,
                },
                { GLTFLoader },
                { RGBELoader },
            ] = await getModules();

            if (!renderer) {
                renderer = new WebGLRenderer({
                    alpha: true,
                    antialias: true,
                    preserveDrawingBuffer: true,
                    premultipliedAlpha: false,
                });
                renderer.setPixelRatio(1);
                renderer.setSize(width, height, false);
                renderer.setClearColor(new Color(0, 0, 0), 0);
                renderer.outputColorSpace = SRGBColorSpace;
                renderer.toneMapping = NoToneMapping;
                renderer.toneMappingExposure = 1;
                renderer.setTransparentSort(compareRenderOrder);
                document.body.replaceChildren(renderer.domElement);

                scene = new Scene();
                scene.background = null;

                hdrTexture = await new RGBELoader().loadAsync(environmentUrl);
                hdrTexture.mapping = EquirectangularReflectionMapping;
                pmrem = new PMREMGenerator(renderer);
                pmrem.compileEquirectangularShader();
            }
            else {
                renderer.setSize(width, height, false);
                renderer.setClearColor(new Color(0, 0, 0), 0);
                renderer.clear(true, true, true);
            }
            updateEnvironment(environmentMirrorX, environmentMirrorY, environmentTextureFlipY, EquirectangularReflectionMapping);
            scene.environmentRotation.set(environmentRotationX, environmentRotationY, environmentRotationZ);

            const gltf = await new GLTFLoader().loadAsync(inputUrl);
            if (!gltf.scene) throw new Error("GLTFLoader returned no scene");
            scene.add(gltf.scene);
            gltf.scene.updateMatrixWorld(true);

            const bounds = new Box3().setFromObject(gltf.scene);
            if (bounds.isEmpty()) throw new Error("Cannot render empty glTF scene");

            const min = bounds.min;
            const max = bounds.max;
            const size = new Vector3();
            const center = new Vector3();
            bounds.getSize(size);
            bounds.getCenter(center);

            const aspect = width / height;
            const verticalFov = fieldOfView * Math.PI / 180;
            const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
            const distanceX = (size.x / 2) / Math.tan(horizontalFov / 2);
            const distanceY = (size.y / 2) / Math.tan(verticalFov / 2);
            const distance = Math.max(distanceX, distanceY) * cameraPadding;
            const extent = Math.max(size.x, size.y, size.z, 0.0001);

            const camera = new PerspectiveCamera(fieldOfView, aspect, Math.max(distance * 0.001, 0.000001), distance + extent * 10);
            camera.position.set(center.x, center.y, max.z + distance);
            camera.lookAt(center.x, center.y, center.z);
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
            applyDepthRenderOrder(gltf.scene, camera, Box3, Vector3);

            renderer.render(scene, camera);
            await new Promise((resolve) => requestAnimationFrame(resolve));
            renderer.render(scene, camera);
            const dataUrl = renderer.domElement.toDataURL(imageMimeType, imageQuality);

            scene.remove(gltf.scene);
            disposeObject(gltf.scene);
            renderer.renderLists.dispose();

            log("rendered " + inputUrl);
            return {
                dataUrl,
                bounds: {
                    min: min.toArray(),
                    max: max.toArray(),
                    size: size.toArray(),
                    center: center.toArray(),
                },
                camera: {
                    position: camera.position.toArray(),
                    near: camera.near,
                    far: camera.far,
                    fieldOfView,
                    cameraPadding,
                },
                settings: {
                    width,
                    height,
                    environmentUrl,
                    environmentMirrorX,
                    environmentMirrorY,
                    environmentTextureFlipY,
                    environmentRotationX,
                    environmentRotationY,
                    environmentRotationZ,
                    toneMapping: "NoToneMapping",
                    outputColorSpace: "SRGBColorSpace",
                    background: "transparent",
                },
            };
        };
        status = "ready";
    });
</script>

<svelte:head>
    <title>glTF Reference Renderer</title>
</svelte:head>

<main>
    <h1>glTF Reference Renderer</h1>
    <pre>{status}</pre>
</main>

<style>
    main {
        padding: 24px;
        font-family: sans-serif;
    }

    pre {
        white-space: pre-wrap;
    }
</style>
