<script lang="ts">
import Model from "./Model.svelte";
import Seo from "$lib/Seo.svelte";

export let data: any;
const SITE = "https://asset-explorer.needle.tools";

$: model = data.model;
$: title = model ? `${model.displayName} – Asset Explorer` : "Asset Explorer";
$: description =
    model ? `${model.displayName} — glTF and USD sample 3D model. ` +
    `Download the GLB or available USDZ conversions and view it in 3D and AR.` : "";
$: imageUrl = model?.previewUri ? SITE + model.previewUri : `${SITE}/asset-explorer.jpg`;
$: modelJsonLd = model ? {
    "@context": "https://schema.org",
    "@type": "3DModel",
    name: model.displayName,
    url: `${SITE}/${model.slug}`,
    image: imageUrl,
    encodingFormat: ["model/gltf-binary", "model/vnd.usdz+zip"],
    ...(model.info?.copyright ? { copyrightNotice: model.info.copyright } : {}),
    isPartOf: { "@type": "CollectionPage", name: "Asset Explorer", url: SITE },
    associatedMedia: {
        "@type": "MediaObject",
        contentUrl: SITE + model.downloadUri,
        encodingFormat: "model/gltf-binary",
    },
} : undefined;
</script>

{#if model}
<Seo {title} {description} image={imageUrl} jsonLd={modelJsonLd} />
{/if}

<div>
    {#if data.model}
    {#key "constant"}
        <Model model={data.model} next={data.next} previous={data.previous} pageOrigin={data.pageOrigin}/>
    {/key}
    {/if}
</div>

<style>
    div {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
        box-sizing: border-box;
    }
</style>
