<script lang="ts">
    import { onMount } from "svelte";
    import { Animation as NeedleAnimation, Context, GameObject, loadAsset, USDZExporter } from "needle-engine-latest";

    let status = "idle";
    let engineElement: any;

    function log(line: string) {
        status += "\n" + line;
        console.log(line);
    }

    function describeConsoleArg(arg: unknown): string {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === "string") return arg;
        if (typeof arg === "number" || typeof arg === "boolean" || arg == null) return String(arg);
        if (typeof arg === "object") {
            const value = arg as { name?: unknown; type?: unknown; uuid?: unknown; message?: unknown };
            const label = [value.name, value.type, value.uuid].filter(Boolean).join(" ");
            if (label) return label;
            if (typeof value.message === "string") return value.message;
        }
        return Object.prototype.toString.call(arg);
    }

    async function captureNeedleConsole<T>(callback: () => Promise<T>): Promise<{ result: T; messages: string[] }> {
        const originalError = console.error;
        const originalWarn = console.warn;
        const messages: string[] = [];
        console.error = (...args: unknown[]) => {
            messages.push("error: " + args.map(describeConsoleArg).join(" "));
            originalError(...args);
        };
        console.warn = (...args: unknown[]) => {
            messages.push("warn: " + args.map(describeConsoleArg).join(" "));
            originalWarn(...args);
        };
        try {
            return { result: await callback(), messages };
        } finally {
            console.error = originalError;
            console.warn = originalWarn;
        }
    }

    function waitForFrame(): Promise<void> {
        return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    async function getNeedleContext(): Promise<any> {
        if (!engineElement) throw new Error("Needle engine element is not ready");
        const context = await engineElement.getContext();
        await waitForFrame();
        return context;
    }

    onMount(() => {
        (window as any).runNeedleUsdzExport = async ({
            inputUrl,
            fileName,
            quickLookCompatible,
        }: {
            inputUrl: string;
            fileName: string;
            quickLookCompatible?: boolean;
        }) => {
            status = "loading " + inputUrl;
            const context = await getNeedleContext();
            const previousContext = Context.Current;
            let scene: any = null;
            Context.Current = context;
            try {
                const model = await loadAsset(inputUrl, { context });
                if (!model?.scene) throw new Error("Needle loadAsset returned no scene");

                scene = model.scene;
                scene.name = scene.name || fileName?.replace(/\.usdz$/i, "") || "NeedleExport";
                GameObject.add(scene, context.scene, context);

                if (model.animations?.length) {
                    const animation = GameObject.addComponent(scene, NeedleAnimation);
                    animation.animations = model.animations;
                    animation.playAutomatically = true;
                    log("registered animations: " + model.animations.length);
                }

                const exporter = GameObject.addComponent(scene, USDZExporter);
                exporter.objectToExport = scene;
                exporter.autoExportAnimations = true;
                exporter.interactive = false;
                exporter.allowCreateQuicklookButton = false;
                if (quickLookCompatible !== undefined) exporter.quickLookCompatible = quickLookCompatible;

                await waitForFrame();
                await waitForFrame();
                scene.updateMatrixWorld(true);

                const { result: blob, messages } = await captureNeedleConsole(() => exporter.export(scene));
                if (!blob) {
                    const details = messages.length ? "\n" + messages.join("\n") : "";
                    throw new Error("Needle USDZExporter returned no blob" + details);
                }

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName || "needle-export.usdz";
                document.body.append(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 10_000);
                log("exported bytes: " + blob.size);
                return { bytes: blob.size };
            } finally {
                if (scene) GameObject.destroy(scene);
                Context.Current = previousContext;
            }
        };
        status = "ready";
    });
</script>

<svelte:head>
    <title>Needle USDZ Export Runner</title>
</svelte:head>

<main>
    <h1>Needle USDZ Export Runner</h1>
    <needle-engine bind:this={engineElement} camera-controls="false" hide-loading-overlay="true" loading-style="light"></needle-engine>
    <pre>{status}</pre>
</main>

<style>
    main {
        padding: 24px;
        font-family: sans-serif;
    }

    needle-engine {
        display: block;
        width: 640px;
        height: 480px;
        border: 1px solid #ddd;
    }

    pre {
        white-space: pre-wrap;
    }
</style>
