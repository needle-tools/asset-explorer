<script lang="ts">
import { page } from '$app/stores'
import { cubicInOut } from 'svelte/easing';
import ModelTags, { showInfo } from './ModelTags.svelte';
import FolderTree from './FolderTree.svelte';
import Tag from './Tag.svelte';
import { browser } from "$app/environment";
import { base } from '$app/paths';
import Seo from '$lib/Seo.svelte';

type AssetCard = {
    kind: "gltf" | "usd";
    name: string;
    slug: string;
    thumbnail?: string | null;
    url: string;
    external: boolean;
    subheadline?: string;
    categoryPath?: string[];
    groups?: string[];
    extras: {
        info: Record<string, any>;
    };
};

type PageData = {
    models: AssetCard[];
    assets: AssetCard[];
    categoryTree: any;
};

type WhooshParams = {
    delay?: number;
    duration?: number;
    easing?: (t: number) => number;
};

export let data: PageData;
const SITE = "https://asset-explorer.needle.tools";
let windowLocation = "https://asset-explorer.needle.tools/";

const seoTitle = "Asset Explorer — glTF & USD Sample Models";
const seoDescription =
    "Explore glTF and USD sample 3D models with downloadable GLB and USDZ conversions for three.js, Blender, and Omniverse — view them in 3D and AR.";

$: homeJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Asset Explorer",
    url: SITE + "/",
    description: seoDescription,
    mainEntity: {
        "@type": "ItemList",
        numberOfItems: data.models.length,
        itemListElement: data.models.map((m, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE}/${m.slug}`,
            name: m.name,
        })),
    },
};

function getAndCountTags(_data: PageData) {
    const tags: Record<string, number> = {};

    for (const model of _data.models) {
        for (const tag of Object.keys(model.extras.info)) {
            if (!showInfo(model.extras.info, tag))
                continue;
            if (tags[tag] === undefined)
                tags[tag] = 0;
            tags[tag]++;
        }
    }
    return tags;
}

function getAndCountGroups(_data: PageData) {
    const groups: Record<string, number> = {};

    for (const model of _data.models) {
        for (const group of model.groups ?? []) {
            groups[group] = (groups[group] ?? 0) + 1;
        }
    }

    return Object.fromEntries(Object.entries(groups).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function hasGroup(asset: AssetCard, value: string) {
    return asset.groups?.includes(value) ?? false;
}

function hasCapability(asset: AssetCard, value: string) {
    return asset.kind === "gltf" && showInfo(asset.extras.info, value);
}

function matchesListFilters(asset: AssetCard, filters: {
    groups: string[];
    notGroups: string[];
    tags: string[];
    notTags: string[];
    category: string;
}) {
    if (filters.category && !asset.categoryPath?.join("/")?.startsWith(filters.category)) return false;
    if (!filters.groups.every((value) => hasGroup(asset, value))) return false;
    if (filters.notGroups.some((value) => hasGroup(asset, value))) return false;
    if (!filters.tags.every((value) => hasCapability(asset, value))) return false;
    if (filters.notTags.some((value) => hasCapability(asset, value))) return false;
    return true;
}

function whoosh(node: Element, params: WhooshParams = {}) {
    const existingTransform = getComputedStyle(node).transform.replace('none', '');

    return {
      delay: params.delay || 0,
      duration: params.duration || 200,
      easing: params.easing || cubicInOut,
      css: (t: number, u: number) => `opacity: ${t}; scale: ${t * 1};`
    };
  }

function hideBrokenImage(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    image.style.visibility = "hidden";
}

$: currentSearch = browser ? $page.url.search : "";
$: currentParams = new URLSearchParams(currentSearch);
$: tagFilters = currentParams.getAll("tag");
$: tagExcludes = currentParams.getAll("notTag");
$: groupFilters = currentParams.getAll("group");
$: groupExcludes = currentParams.getAll("notGroup");
$: category = currentParams.get('category') ?? "";
$: visibleAssets = (data.assets ?? data.models).filter((asset: AssetCard) => {
    return matchesListFilters(asset, {
        groups: groupFilters,
        notGroups: groupExcludes,
        tags: tagFilters,
        notTags: tagExcludes,
        category,
    });
});
$: showCollections = data.categoryTree?.children?.length > 1;

function setList(params: URLSearchParams, name: string, values: string[]) {
    params.delete(name);
    for (const value of values) params.append(name, value);
}

function filterHref(search: string, paramName: "group" | "tag", value: string, exclude = false) {
    const params = new URLSearchParams(search);
    const excludeParamName = paramName === "group" ? "notGroup" : "notTag";
    const includes = new Set(params.getAll(paramName));
    const excludes = new Set(params.getAll(excludeParamName));

    if (exclude) {
        includes.delete(value);
        if (excludes.has(value)) excludes.delete(value);
        else excludes.add(value);
    }
    else if (includes.has(value) || excludes.has(value)) {
        includes.delete(value);
        excludes.delete(value);
    }
    else {
        includes.add(value);
        excludes.delete(value);
    }

    setList(params, paramName, [...includes]);
    setList(params, excludeParamName, [...excludes]);
    params.delete("category");

    const query = params.toString();
    return query ? `${base}/?${query}` : `${base}/`;
}

function countLabel(search: string, kind: "group" | "tag", value: string, total: number) {
    const params = new URLSearchParams(search);
    const filters = {
        groups: params.getAll("group"),
        notGroups: params.getAll("notGroup"),
        tags: params.getAll("tag"),
        notTags: params.getAll("notTag"),
        category: params.get("category") ?? "",
    };
    const includeList = kind === "group" ? filters.groups : filters.tags;
    const excludeList = kind === "group" ? filters.notGroups : filters.notTags;

    if (!includeList.includes(value) && !excludeList.includes(value)) includeList.push(value);

    const matching = (data.assets ?? data.models).filter((asset: AssetCard) => matchesListFilters(asset, filters)).length;
    return matching === total ? total : `${matching} of ${total}`;
}

</script>

<Seo
    title={seoTitle}
    description={seoDescription}
    image={SITE + "/asset-explorer.jpg"}
    jsonLd={homeJsonLd}
/>

<h3 class="title">Asset groups</h3>
<ul class="groups">
    {#each Object.entries(getAndCountGroups(data)) as [assetGroup, count]}
        <Tag
            href={filterHref(currentSearch, "group", assetGroup)}
            excludeHref={filterHref(currentSearch, "group", assetGroup, true)}
            selected={groupFilters.includes(assetGroup)}
            excluded={groupExcludes.includes(assetGroup)}
            name={assetGroup}
            value={countLabel(currentSearch, "group", assetGroup, count)}
        />
    {/each}
</ul>

<h3 class="title">Asset capabilities</h3>
<ModelTags
    tags={Object.fromEntries(
        Object.entries(getAndCountTags(data)).map(([tag, count]) => [tag, countLabel(currentSearch, "tag", tag, count)])
    )}
    includeFilters={tagFilters}
    excludeFilters={tagExcludes}
    ignoreTags={["generator", "source"]}
/>

<div class:asset-browser={showCollections}>
    {#if showCollections}
    <aside>
        <h3 class="title">Collections</h3>
        <FolderTree node={data.categoryTree} selected={category} />
    </aside>
    {/if}

    <main>
        <h3 class="title">Assets and conversions</h3>
        <ul class="models">
            {#each visibleAssets as model (model.slug)}
                <li transition:whoosh>
                    <a href={model.external ? model.url : `${base}/${model.slug}`} target={model.external ? "_blank" : undefined} rel={model.external ? "noreferrer" : undefined}>
                        <span class="preview-wrap">
                            {#if model.thumbnail}
                            <img src={model.thumbnail} alt={model.name} loading="lazy" on:error={hideBrokenImage} />
                            {/if}
                        </span>
                        <p class="name">{model.name}</p>
                        {#if model.subheadline}
                        <p class="subheadline">{model.subheadline}</p>
                        {/if}
                        {#if model.kind === "gltf"}
                        <ModelTags
                            tags={model.extras.info}
                            includeFilters={tagFilters}
                            excludeFilters={tagExcludes}
                            ignoreValuesForTags={["copyright"]}
                        />
                        {/if}
                    </a>
                </li>
            {/each}
        </ul>
    </main>
</div>

<style>
    :root {
        --size: 160px;
    }

    @media only screen and (max-width: 600px) {
        :root {
            --size: min(40vw, 160px);
        }
    }

    @media only screen and (max-width: 380px) {
        :root {
            --size: 80vw;
        }
    }

    .asset-browser {
        display: grid;
        grid-template-columns: minmax(190px, 260px) minmax(0, 1fr);
        gap: 28px;
        align-items: start;
    }

    aside {
        position: sticky;
        top: 16px;
        max-height: calc(100vh - 32px);
        overflow: auto;
        padding-right: 8px;
    }

    main {
        min-width: 0;
    }

    .models li {
        display: flex;
        flex-direction: column; 
        max-width: var(--size);
        transition: transform 0.1s ease-in-out, background-color 0.2s linear, margin 0.2s linear, padding 0.2s linear;

        padding: 5px;
        margin: 0px;  
    }

    a {
        text-decoration: none;
        color: var(--color-text-primary);
    }

    .models a {
        max-width: var(--size);
    }

    p {
        margin: 0;
        padding: 0;
    }

    ul {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        justify-content: space-evenly;
        margin: 0;
        padding: 0;
    }

    .groups {
        justify-content: center;
        margin-bottom: 1rem;
    }

    li {
        list-style-type: none;
        border: 1px solid transparent;
    }

    .preview-wrap {
        display: grid;
        place-items: center;
        width: var(--size);
        height: var(--size);
        background-color: var(--color-bg-panel);
        border: 1px solid var(--color-border-subtle);
        border-radius: var(--radius-card);
        box-shadow: 0 1px 4px rgba(26, 26, 26, 0.08);
        box-sizing: border-box;
    }

    img {
        width: var(--size);
        height: var(--size);
        object-fit: contain;
    }

    .subheadline {
        color: var(--color-text-muted);
        font-size: 0.72rem;
        line-height: 1.2;
        text-align: center;
    }

    li:hover {
        transform: scale(1.02);
        background-color: var(--color-bg-panel);
        padding: 10px;
        margin: -5px;
        border-radius: var(--radius-card);
        border: 1px solid var(--color-border-subtle);
        box-shadow: 0 4px 12px rgba(26, 26, 26, 0.08);
        z-index: 10;
    }

    /* Needle brand "micro-label" type style */
    .title {
        text-align: center;
        color: var(--color-text-muted);
        font-size: 0.74rem;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-top: 2.4rem;
        margin-bottom: 1rem;
    }

    @media only screen and (max-width: 760px) {
        .asset-browser {
            grid-template-columns: 1fr;
        }

        aside {
            position: static;
            max-height: 220px;
        }
    }
</style>
