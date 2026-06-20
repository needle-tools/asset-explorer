<script>
import Model from "./Model.svelte";
import Seo from "$lib/Seo.svelte";

export let data;
const SITE = "https://asset-explorer.needle.tools";

$: model = data.model;
$: title = `${model.displayName} – Asset Explorer`;
$: description =
    `${model.displayName} — glTF and USD sample 3D model. ` +
    `Download the GLB or USDZ conversions (three.js, Blender, Omniverse) and view it in 3D and AR.`;
$: imageUrl = model.previewUri ? SITE + model.previewUri : `${SITE}/asset-explorer.jpg`;
$: modelJsonLd = {
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
};
</script>

<Seo {title} {description} image={imageUrl} jsonLd={modelJsonLd} />

<div>
    {#if data.model}
    {#key "constant"}
        <Model model={data.model} next={data.next} previous={data.previous}/>
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
