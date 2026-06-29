<script lang="ts">
    import { onMount } from "svelte";

    let status = "idle";

    function log(line: string) {
        status += "\n" + line;
        console.log(line);
    }

    onMount(() => {
        (window as any).runThreeR185UsdzExport = async ({ inputUrl, fileName }: { inputUrl: string; fileName: string }) => {
            status = "loading " + inputUrl;
            const [{ GLTFLoader }, { USDZExporter }] = await Promise.all([
                import("three-r185/examples/jsm/loaders/GLTFLoader.js"),
                import("three-r185/examples/jsm/exporters/USDZExporter.js"),
            ]);

            const gltf = await new Promise<any>((resolve, reject) => {
                new GLTFLoader().load(inputUrl, resolve, undefined, reject);
            });
            if (!gltf?.scene) throw new Error("three r185 GLTFLoader returned no scene");

            gltf.scene.updateMatrixWorld(true);
            const exporter = new USDZExporter();
            const arrayBuffer = await exporter.parseAsync(gltf.scene, {
                animations: gltf.animations ?? [],
                animationFrameRate: 60,
                maxTextureSize: 4096,
            });

            const blob = new Blob([arrayBuffer], { type: "model/vnd.usdz+zip" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName || "three-r185-export.usdz";
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            log("exported bytes: " + blob.size);
            return { bytes: blob.size };
        };
        status = "ready";
    });
</script>

<svelte:head>
    <title>three r185 USDZ Export Runner</title>
</svelte:head>

<main>
    <h1>three r185 USDZ Export Runner</h1>
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
