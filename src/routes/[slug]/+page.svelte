<script lang="ts">
import FolderTree from "../FolderTree.svelte";
import { base } from "$app/paths";
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

<div class="asset-workspace">
    <aside aria-label="Asset collections">
        <a class="back-link" href="{base}/"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3m4-4L3 8l4 4" /></svg>Back to all assets</a>
        <h2>On this asset</h2>
        <nav class="section-links" aria-label="On this asset">
            <a href="#asset-preview">Preview</a>
            <a href="#asset-information">Asset information</a>
            <a href="#asset-downloads">Downloads</a>
            <a href="#asset-description">Description</a>
        </nav>
        {#if data.model?.groups?.length}
        <h2>Groups</h2>
        <nav class="section-links" aria-label="Asset groups">
            {#each data.model.groups as group}
            <a href="{base}/?group={encodeURIComponent(group)}">{group}</a>
            {/each}
        </nav>
        {/if}
        {#if data.similarAssets?.length}
        <h2>Similar assets</h2>
        <nav class="similar-assets" aria-label="Similar assets">
            {#each data.similarAssets as asset}
            <a href="{base}/{asset.slug}">
                {#if asset.thumbnail}<img src={asset.thumbnail} alt="" loading="lazy" />{/if}
                <span><span class="similar-name">{asset.name}</span>
                    {#if asset.matches.length}<small title={asset.matches.join(", ")}>{asset.matches.join(", ")}</small>{/if}
                </span>
            </a>
            {/each}
        </nav>
        {/if}
        <h2>Collections</h2>
        {#each data.categoryTree?.children ?? [] as collection}
            <FolderTree node={collection} selected="glTF Sample Assets" highlightSelected={false} />
        {/each}
    </aside>
    <section>
    {#if data.model}
    {#key "constant"}
        <Model model={data.model} next={data.next} previous={data.previous} pageOrigin={data.pageOrigin}/>
    {/key}
    {/if}
    </section>
</div>

<style>
    .asset-workspace {
        display: grid;
        grid-template-columns: 184px minmax(0, 1fr);
        gap: 32px;
        width: 100%;
    }

    aside {
        position: sticky;
        top: 76px;
        align-self: start;
        max-height: calc(100dvh - 92px);
        overflow: auto;
    }

    .back-link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        line-height: 20px;
        border-radius: 6px;
        background: transparent;
        font-weight: 600;
    }

    .back-link:hover {
        color: var(--color-text-primary);
        background: color-mix(in srgb, var(--color-text-muted) 7%, transparent);
        text-decoration: none;
    }

    h2 {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        margin: 14px 8px 4px;
    }

    aside :global(summary) {
        min-height: 28px;
    }

    aside :global(summary a) {
        padding-block: 4px;
        font-weight: 400;
    }

    .similar-assets {
        display: grid;
        gap: 2px;
    }

    .similar-assets a {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        min-width: 0;
        color: var(--color-text-secondary);
    }

    .similar-assets a:hover {
        background: var(--workspace-hover);
        color: var(--color-text-primary);
        text-decoration: none;
    }

    .similar-assets img {
        width: 32px;
        height: 28px;
        object-fit: contain;
        border-radius: 4px;
        flex-shrink: 0;
    }

    .similar-assets a > span {
        min-width: 0;
    }

    .similar-name, .similar-assets small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        line-height: 1.4;
    }

    .similar-assets small {
        font-size: 10px;
        color: var(--color-text-muted);
    }

    .section-links {
        display: grid;
        gap: 0;
    }

    .section-links a {
        padding: 4px 8px;
        line-height: 20px;
        border-radius: 6px;
        color: var(--color-text-secondary);
    }

    .section-links a:hover {
        background: var(--workspace-hover);
        color: var(--color-text-primary);
        text-decoration: none;
    }

    section {
        min-width: 0;
    }

    @media (max-width: 600px) {
        .asset-workspace {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
        }

        aside {
            position: static;
            max-height: 240px;
        }
    }
</style>
