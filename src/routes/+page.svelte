<script lang="ts">
import { page } from '$app/stores'
import { cubicInOut } from 'svelte/easing';
import { onMount } from 'svelte';
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

type FacetSectionId = "groups" | "capabilities" | "extensions" | "generators" | "metadata";

export let data: PageData;
const SITE = "https://asset-explorer.needle.tools";
let windowLocation = "https://asset-explorer.needle.tools/";

const seoTitle = "Asset Explorer — glTF & USD Sample Models";
const seoDescription =
    "Explore glTF and USD sample 3D assets with downloadable GLB files, USDZ conversions, provenance, metadata, and preview renders.";
const NONE_VALUE = "__none";
const NO_CAPABILITIES = "__none_capabilities";
const NO_EXTENSIONS = "__none_extensions";
const NO_METADATA = "__none_metadata";
const FACET_SECTION_STORAGE_KEY = "asset-explorer:facet-section-open";
const defaultFacetSectionOpen: Record<FacetSectionId, boolean> = {
    groups: true,
    capabilities: true,
    extensions: false,
    generators: false,
    metadata: false,
};
let facetSectionOpen = { ...defaultFacetSectionOpen };

onMount(() => {
    const stored = localStorage.getItem(FACET_SECTION_STORAGE_KEY);
    if (!stored) return;
    try {
        const parsed = JSON.parse(stored);
        facetSectionOpen = { ...defaultFacetSectionOpen };
        for (const section of Object.keys(defaultFacetSectionOpen) as FacetSectionId[]) {
            if (typeof parsed?.[section] === "boolean")
                facetSectionOpen[section] = parsed[section];
        }
    }
    catch {
        localStorage.removeItem(FACET_SECTION_STORAGE_KEY);
    }
});

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
    const preferredOrder = new Map([
        ["textures", 0],
        ["lights", 1],
        ["animations", 2],
        ["alphaMask", 3],
        ["alphaBlend", 4],
        ["blendShapes", 5],
        ["cameras", 6],
        ["skins", 7],
        ["vertexColors", 8],
        ["tangents", 9],
        ["multipleUvSets", 10],
        ["normalMaps", 11],
        ["occlusionMaps", 12],
        ["emissiveMaterials", 13],
        ["doubleSidedMaterials", 14],
        ["nonPbrMaterials", 15],
        ["customTextureWrap", 16],
        ["customTextureFiltering", 17],
        ["matrixTransforms", 18],
        ["negativeScale", 19],
        ["nonUniformScale", 20],
        ["nonTrianglePrimitives", 21],
        ["normalizedAccessors", 22],
        ["sparseAccessors", 23],
        ["morphAnimations", 24],
        ["stepAnimation", 25],
        ["cubicSplineAnimation", 26],
        ["scenes", 27],
    ]);

    for (const model of _data.models) {
        for (const tag of Object.keys(model.extras.info)) {
            if (!showInfo(model.extras.info, tag))
                continue;
            if (tags[tag] === undefined)
                tags[tag] = 0;
            tags[tag]++;
        }
    }

    return Object.fromEntries(Object.entries(tags).sort((a, b) => {
        const priorityA = preferredOrder.get(a[0]) ?? Number.POSITIVE_INFINITY;
        const priorityB = preferredOrder.get(b[0]) ?? Number.POSITIVE_INFINITY;
        return priorityA - priorityB || b[1] - a[1] || a[0].localeCompare(b[0]);
    }));
}

function getAndCountGroups(_data: PageData) {
    const groups: Record<string, number> = {};
    const preferredOrder = new Map([
        ["showcase", 0],
        ["needle", 1],
        ["pbrtest", 2],
        ["core", 3],
        ["extension", 4],
        ["testing", 5],
    ]);

    for (const model of _data.models) {
        for (const group of model.groups ?? []) {
            groups[group] = (groups[group] ?? 0) + 1;
        }
    }

    return Object.fromEntries(Object.entries(groups).sort((a, b) => {
        const priorityA = preferredOrder.get(a[0]) ?? Number.POSITIVE_INFINITY;
        const priorityB = preferredOrder.get(b[0]) ?? Number.POSITIVE_INFINITY;
        return priorityA - priorityB || b[1] - a[1] || a[0].localeCompare(b[0]);
    }));
}

function generatorFamily(value: unknown) {
    if (typeof value !== "string") return "";
    const generator = value.trim();
    if (!generator) return "";

    const knownFamilies: Array<[RegExp, string]> = [
        [/^(Khronos\s+)?(?:glTF Blender I\/O|Blender glTF|glTF Blender)/i, "Blender"],
        [/^Blender/i, "Blender"],
        [/^three\.js/i, "three.js"],
        [/^Needle/i, "Needle"],
        [/^glTF-?Transform/i, "glTF Transform"],
        [/^COLLADA2GLTF/i, "COLLADA2GLTF"],
        [/^FBX2glTF/i, "FBX2glTF"],
        [/^obj2gltf/i, "obj2gltf"],
        [/^Sketchfab/i, "Sketchfab"],
        [/^RapidCompact/i, "RapidCompact"],
        [/^RapidPipeline/i, "RapidPipeline"],
        [/^Maya/i, "Maya"],
        [/^3ds\s*Max/i, "3ds Max"],
        [/^HS\s+glTF exporter for 3dsmax/i, "Satoshi Hayashi glTF exporter + 3ds Max"],
        [/^babylon\.js\s+glTF exporter/i, "Babylon.js glTF exporter"],
    ];

    for (const [pattern, family] of knownFamilies) {
        if (pattern.test(generator)) return family;
    }

    const generatorTools: Array<[RegExp, string]> = [
        [/\bRapidCompact\b/i, "RapidCompact"],
        [/\bRapidPipeline(?:\s+3D Processor)?\b/i, "RapidPipeline"],
        [/\b3ds\s*Max\b/i, "3ds Max"],
        [/\bV-Ray\b/i, "V-Ray"],
        [/\bSatoshi Hayashi glTF exporter\b/i, "Satoshi Hayashi glTF exporter"],
        [/\bHS\s+glTF exporter for 3dsmax\b/i, "Satoshi Hayashi glTF exporter"],
        [/\bAutodesk glTF exporter\b/i, "Autodesk glTF exporter"],
        [/\b(?:babylon\.js|Max2Babylon)\s+glTF exporter\b|\bMax2Babylon\b/i, "Babylon.js glTF exporter"],
        [/\bVisual Studio Code\b|\bVSCode\b/i, "Visual Studio Code"],
        [/\bglTF Tools\b|\bglTF-Tools\b/i, "glTF Tools"],
    ];
    const tools = generatorTools
        .filter(([pattern]) => pattern.test(generator))
        .map(([, tool]) => tool)
        .filter((tool, index, list) => list.indexOf(tool) === index);
    if (tools.length) return tools.join(" + ");

    const prefix = generator
        .replace(/^Created\s+(?:by|in)\s+/i, "")
        .replace(/^Generated\s+with\s+/i, "")
        .replace(/^Edited\s+in\s+/i, "")
        .split(/[;,]/)[0]
        .replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/\s+(?:v|r)?\d[\w.+-]*.*$/i, "")
        .trim();

    return prefix || generator;
}

function getAndCountGenerators(_data: PageData) {
    const generators: Record<string, number> = {};

    for (const model of _data.models) {
        const family = generatorFamily(model.extras.info?.generator);
        if (!family) continue;
        generators[family] = (generators[family] ?? 0) + 1;
    }

    return Object.fromEntries(Object.entries(generators).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function hasGroup(asset: AssetCard, value: string) {
    if (value === NONE_VALUE) return !asset.groups?.length;
    return asset.groups?.includes(value) ?? false;
}

function hasGenerator(asset: AssetCard, value: string) {
    if (value === NONE_VALUE) return !generatorFamily(asset.extras.info?.generator);
    return generatorFamily(asset.extras.info?.generator) === value;
}

function hasCapability(asset: AssetCard, value: string) {
    if (value === NO_CAPABILITIES) return !hasObjectEntries(capabilityTagEntries(asset));
    if (value === NO_EXTENSIONS) return !hasObjectEntries(extensionTagEntries(asset));
    if (value === NO_METADATA) return metadataEntries(asset).length === 0;
    return asset.kind === "gltf" && showInfo(asset.extras.info, value);
}

function isExtensionTag(tag: string) {
    return /^[A-Z][A-Z0-9]+_/.test(tag);
}

function matchesListFilters(asset: AssetCard, filters: {
    groups: string[];
    notGroups: string[];
    generators: string[];
    notGenerators: string[];
    tags: string[];
    notTags: string[];
    category: string;
}) {
    if (filters.category && !asset.categoryPath?.join("/")?.startsWith(filters.category)) return false;
    if (!filters.groups.every((value) => hasGroup(asset, value))) return false;
    if (filters.notGroups.some((value) => hasGroup(asset, value))) return false;
    if (!filters.generators.every((value) => hasGenerator(asset, value))) return false;
    if (filters.notGenerators.some((value) => hasGenerator(asset, value))) return false;
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
$: generatorFilters = currentParams.getAll("generator");
$: generatorExcludes = currentParams.getAll("notGenerator");
$: category = currentParams.get('category') ?? "";
$: visibleAssets = (data.assets ?? data.models).filter((asset: AssetCard) => {
    return matchesListFilters(asset, {
        groups: groupFilters,
        notGroups: groupExcludes,
        generators: generatorFilters,
        notGenerators: generatorExcludes,
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

function excludeParamName(paramName: "group" | "generator" | "tag") {
    if (paramName === "group") return "notGroup";
    if (paramName === "generator") return "notGenerator";
    return "notTag";
}

function filterHref(search: string, paramName: "group" | "generator" | "tag", value: string, exclude = false) {
    const params = new URLSearchParams(search);
    const excludeName = excludeParamName(paramName);
    const includes = new Set(params.getAll(paramName));
    const excludes = new Set(params.getAll(excludeName));

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
    setList(params, excludeName, [...excludes]);
    params.delete("category");

    const query = params.toString();
    return query ? `${base}/?${query}` : `${base}/`;
}

function countLabel(search: string, kind: "group" | "generator" | "tag", value: string, total: number) {
    const params = new URLSearchParams(search);
    const filters = {
        groups: params.getAll("group"),
        notGroups: params.getAll("notGroup"),
        generators: params.getAll("generator"),
        notGenerators: params.getAll("notGenerator"),
        tags: params.getAll("tag"),
        notTags: params.getAll("notTag"),
        category: params.get("category") ?? "",
    };
    filters.groups = filters.groups.filter((group) => kind !== "group" || group !== value);
    filters.notGroups = filters.notGroups.filter((group) => kind !== "group" || group !== value);
    filters.generators = filters.generators.filter((generator) => kind !== "generator" || generator !== value);
    filters.notGenerators = filters.notGenerators.filter((generator) => kind !== "generator" || generator !== value);
    filters.tags = filters.tags.filter((tag) => kind !== "tag" || tag !== value);
    filters.notTags = filters.notTags.filter((tag) => kind !== "tag" || tag !== value);

    const matching = (data.assets ?? data.models).filter((asset: AssetCard) => {
        if (!matchesListFilters(asset, filters)) return false;
        if (kind === "group") return hasGroup(asset, value);
        if (kind === "generator") return hasGenerator(asset, value);
        return hasCapability(asset, value);
    }).length;
    return matching;
}

function hasMatches(label: number | string) {
    return label !== 0;
}

function isActiveFacet(kind: "group" | "generator" | "tag", value: string) {
    if (kind === "group") return groupFilters.includes(value) || groupExcludes.includes(value);
    if (kind === "generator") return generatorFilters.includes(value) || generatorExcludes.includes(value);
    return tagFilters.includes(value) || tagExcludes.includes(value);
}

$: baseGeneratorEntries = Object.entries(getAndCountGenerators(data))
    .map(([generator, count]) => ({ value: generator, name: generator, label: countLabel(currentSearch, "generator", generator, count) }));

$: visibleGeneratorEntries = (() => {
    const noneCount = (data.assets ?? data.models).filter((asset: AssetCard) => hasGenerator(asset, NONE_VALUE)).length;
    return [
        ...baseGeneratorEntries,
        { value: NONE_VALUE, name: "none", label: countLabel(currentSearch, "generator", NONE_VALUE, noneCount) },
    ].filter(({ value, label }) => hasMatches(label) || isActiveFacet("generator", value));
})();

$: baseGroupEntries = Object.entries(getAndCountGroups(data))
    .map(([assetGroup, count]) => ({
        value: assetGroup,
        name: assetGroup,
        label: countLabel(currentSearch, "group", assetGroup, count),
    }));

$: visibleGroupEntries = (() => {
    const noneCount = (data.assets ?? data.models).filter((asset: AssetCard) => hasGroup(asset, NONE_VALUE)).length;
    return [
        ...baseGroupEntries,
        { value: NONE_VALUE, name: "none", label: countLabel(currentSearch, "group", NONE_VALUE, noneCount) },
    ].filter(({ value, label }) => hasMatches(label) || isActiveFacet("group", value));
})();

$: baseCapabilityEntries = Object.entries(getAndCountTags(data))
    .filter(([tag]) => !isExtensionTag(tag) && !["generator", "source", "copyright"].includes(tag))
    .map(([tag, count]) => ({ value: tag, name: tag, label: countLabel(currentSearch, "tag", tag, count) }));

$: visibleCapabilityEntries = (() => {
    const noneCount = (data.assets ?? data.models).filter((asset: AssetCard) => hasCapability(asset, NO_CAPABILITIES)).length;
    return [
        ...baseCapabilityEntries,
        { value: NO_CAPABILITIES, name: "none", label: countLabel(currentSearch, "tag", NO_CAPABILITIES, noneCount) },
    ].filter(({ value, label }) => hasMatches(label) || isActiveFacet("tag", value));
})();

$: baseExtensionEntries = Object.entries(getAndCountTags(data))
    .filter(([tag]) => isExtensionTag(tag))
    .map(([tag, count]) => ({ value: tag, name: tag, label: countLabel(currentSearch, "tag", tag, count) }));

$: visibleExtensionEntries = (() => {
    const noneCount = (data.assets ?? data.models).filter((asset: AssetCard) => hasCapability(asset, NO_EXTENSIONS)).length;
    return [
        ...baseExtensionEntries,
        { value: NO_EXTENSIONS, name: "none", label: countLabel(currentSearch, "tag", NO_EXTENSIONS, noneCount) },
    ].filter(({ value, label }) => hasMatches(label) || isActiveFacet("tag", value));
})();

$: baseMetadataEntries = Object.entries(getAndCountTags(data))
    .filter(([tag]) => ["generator", "source", "copyright"].includes(tag))
    .map(([tag, count]) => ({ value: tag, name: tag, label: countLabel(currentSearch, "tag", tag, count) }));

$: visibleMetadataEntries = (() => {
    const noneCount = (data.assets ?? data.models).filter((asset: AssetCard) => hasCapability(asset, NO_METADATA)).length;
    return [
        ...baseMetadataEntries,
        { value: NO_METADATA, name: "none", label: countLabel(currentSearch, "tag", NO_METADATA, noneCount) },
    ].filter(({ value, label }) => hasMatches(label) || isActiveFacet("tag", value));
})();

function tagSortIndex(tag: string) {
    const orderedTagKeys = Object.keys(getAndCountTags(data));
    const index = orderedTagKeys.indexOf(tag);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
}

function capabilityTagEntries(asset: AssetCard) {
    return Object.fromEntries(
        Object.entries(asset.extras.info ?? {})
            .filter(([tag]) => showInfo(asset.extras.info, tag) && !isExtensionTag(tag) && !["generator", "source", "copyright"].includes(tag))
            .sort((a, b) => tagSortIndex(a[0]) - tagSortIndex(b[0]) || a[0].localeCompare(b[0]))
    );
}

function extensionTagEntries(asset: AssetCard) {
    return Object.fromEntries(
        Object.entries(asset.extras.info ?? {})
            .filter(([tag]) => showInfo(asset.extras.info, tag) && isExtensionTag(tag))
            .sort((a, b) => a[0].localeCompare(b[0]))
    );
}

function metadataEntries(asset: AssetCard) {
    return ["generator", "source", "copyright"]
        .map((key) => [key, asset.extras.info?.[key]] as const)
        .filter(([key, value]) => showInfo(asset.extras.info, key) && value);
}

function hasObjectEntries(value: Record<string, any>) {
    return Object.keys(value).length > 0;
}

function entryCount(value: Record<string, any> | readonly unknown[] | undefined) {
    if (Array.isArray(value)) return value.length;
    return Object.keys(value ?? {}).length;
}

function setFacetSectionOpen(section: FacetSectionId, open: boolean) {
    facetSectionOpen = { ...facetSectionOpen, [section]: open };
    if (browser)
        localStorage.setItem(FACET_SECTION_STORAGE_KEY, JSON.stringify(facetSectionOpen));
}

function onFacetSectionToggle(event: Event, section: FacetSectionId) {
    setFacetSectionOpen(section, (event.currentTarget as HTMLDetailsElement).open);
}

</script>

<Seo
    title={seoTitle}
    description={seoDescription}
    image={SITE + "/asset-explorer.jpg"}
    jsonLd={homeJsonLd}
/>

<details class="facet-section" open={facetSectionOpen.groups} on:toggle={(event) => onFacetSectionToggle(event, "groups")}>
    <summary><span>Groups</span><span>{visibleGroupEntries.length}</span></summary>
    <ul class="groups">
        {#each visibleGroupEntries as { value, name, label }}
            <Tag
                href={filterHref(currentSearch, "group", value)}
                excludeHref={filterHref(currentSearch, "group", value, true)}
                selected={groupFilters.includes(value)}
                excluded={groupExcludes.includes(value)}
                name={name}
                value={label}
            />
        {/each}
    </ul>
</details>

<details class="facet-section" open={facetSectionOpen.capabilities} on:toggle={(event) => onFacetSectionToggle(event, "capabilities")}>
    <summary><span>Has special data</span><span>{visibleCapabilityEntries.length}</span></summary>
    <ul class="groups">
        {#each visibleCapabilityEntries as { value, name, label }}
            <Tag
                href={filterHref(currentSearch, "tag", value)}
                excludeHref={filterHref(currentSearch, "tag", value, true)}
                selected={tagFilters.includes(value)}
                excluded={tagExcludes.includes(value)}
                name={name}
                value={label}
            />
        {/each}
    </ul>
</details>

{#if visibleExtensionEntries.length}
<details class="facet-section" open={facetSectionOpen.extensions} on:toggle={(event) => onFacetSectionToggle(event, "extensions")}>
    <summary><span>Extensions</span><span>{visibleExtensionEntries.length}</span></summary>
    <ul class="groups">
        {#each visibleExtensionEntries as { value, name, label }}
            <Tag
                href={filterHref(currentSearch, "tag", value)}
                excludeHref={filterHref(currentSearch, "tag", value, true)}
                selected={tagFilters.includes(value)}
                excluded={tagExcludes.includes(value)}
                name={name}
                value={label}
            />
        {/each}
    </ul>
</details>
{/if}

{#if visibleMetadataEntries.length}
<details class="facet-section" open={facetSectionOpen.metadata} on:toggle={(event) => onFacetSectionToggle(event, "metadata")}>
    <summary><span>Metadata</span><span>{visibleMetadataEntries.length}</span></summary>
    <ul class="groups">
        {#each visibleMetadataEntries as { value, name, label }}
            <Tag
                href={filterHref(currentSearch, "tag", value)}
                excludeHref={filterHref(currentSearch, "tag", value, true)}
                selected={tagFilters.includes(value)}
                excluded={tagExcludes.includes(value)}
                name={name}
                value={label}
            />
        {/each}
    </ul>
</details>
{/if}

{#if visibleGeneratorEntries.length}
<details class="facet-section" open={facetSectionOpen.generators} on:toggle={(event) => onFacetSectionToggle(event, "generators")}>
    <summary><span>Generators</span><span>{visibleGeneratorEntries.length}</span></summary>
    <ul class="groups">
        {#each visibleGeneratorEntries as { value, name, label }}
            <Tag
                href={filterHref(currentSearch, "generator", value)}
                excludeHref={filterHref(currentSearch, "generator", value, true)}
                selected={generatorFilters.includes(value)}
                excluded={generatorExcludes.includes(value)}
                name={name}
                value={label}
            />
        {/each}
    </ul>
</details>
{/if}

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
                    <a class="asset-main" href={model.external ? model.url : `${base}/${model.slug}`} target={model.external ? "_blank" : undefined} rel={model.external ? "noreferrer" : undefined}>
                        <span class="preview-wrap">
                            {#if model.thumbnail}
                            <img src={model.thumbnail} alt={model.name} loading="lazy" on:error={hideBrokenImage} />
                            {/if}
                        </span>
                        <p class="name">{model.name}</p>
                        {#if model.subheadline}
                        <p class="subheadline">{model.subheadline}</p>
                        {/if}
                    </a>
                    {#if model.kind === "gltf"}
                        {@const groupCount = entryCount(model.groups)}
                        {@const capabilityEntries = capabilityTagEntries(model)}
                        {@const capabilityCount = entryCount(capabilityEntries)}
                        {@const extensionEntries = extensionTagEntries(model)}
                        {@const extensionCount = entryCount(extensionEntries)}
                        {@const assetMetadataEntries = metadataEntries(model)}
                        {@const metadataCount = entryCount(assetMetadataEntries)}
                    <div class="asset-footer">
                        {#if groupCount}
                        <details>
                            <summary><span class="footer-label">Groups</span><span class="footer-count">{groupCount}</span></summary>
                            <ul class="groups footer-tags">
                                {#each model.groups as assetGroup}
                                    <Tag
                                        href={filterHref(currentSearch, "group", assetGroup)}
                                        excludeHref={filterHref(currentSearch, "group", assetGroup, true)}
                                        selected={groupFilters.includes(assetGroup)}
                                        excluded={groupExcludes.includes(assetGroup)}
                                        name={assetGroup}
                                        value={true}
                                        showValue={false}
                                    />
                                {/each}
                            </ul>
                        </details>
                        {:else}
                        <div class="footer-row is-empty">
                            <span class="footer-label">Groups</span><span class="footer-count">{groupCount}</span>
                        </div>
                        {/if}

                        {#if capabilityCount}
                        <details>
                            <summary><span class="footer-label">Has special data</span><span class="footer-count">{capabilityCount}</span></summary>
                            <ModelTags
                                tags={capabilityEntries}
                                includeFilters={tagFilters}
                                excludeFilters={tagExcludes}
                            />
                        </details>
                        {:else}
                        <div class="footer-row is-empty">
                            <span class="footer-label">Has special data</span><span class="footer-count">{capabilityCount}</span>
                        </div>
                        {/if}

                        {#if extensionCount}
                        <details>
                            <summary><span class="footer-label">Extensions</span><span class="footer-count">{extensionCount}</span></summary>
                            <ModelTags
                                tags={extensionEntries}
                                includeFilters={tagFilters}
                                excludeFilters={tagExcludes}
                            />
                        </details>
                        {:else}
                        <div class="footer-row is-empty">
                            <span class="footer-label">Extensions</span><span class="footer-count">{extensionCount}</span>
                        </div>
                        {/if}

                        {#if metadataCount}
                        <details>
                            <summary><span class="footer-label">Metadata</span><span class="footer-count">{metadataCount}</span></summary>
                            <dl class="metadata-tags">
                                {#each assetMetadataEntries as [key, value]}
                                <div>
                                    <dt>{key}</dt>
                                    <dd title={String(value)}>{value}</dd>
                                </div>
                                {/each}
                            </dl>
                        </details>
                        {:else}
                        <div class="footer-row is-empty">
                            <span class="footer-label">Metadata</span><span class="footer-count">{metadataCount}</span>
                        </div>
                        {/if}
                    </div>
                    {/if}
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

    .facet-section {
        margin-top: 1rem;
    }

    .facet-section summary {
        display: flex;
        column-gap: 7px;
        align-items: center;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 0.74rem;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        list-style: none;
    }

    .facet-section summary::-webkit-details-marker {
        display: none;
    }

    .facet-section summary::before {
        content: "";
        width: 0;
        height: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-left: 7px solid currentColor;
        transform-origin: 35% 50%;
        transition: transform 0.12s ease;
    }

    .facet-section[open] summary::before {
        transform: rotate(90deg);
    }

    .facet-section summary span:last-child {
        min-width: 2ch;
        color: var(--color-text-primary);
        text-align: left;
    }

    .facet-section .groups {
        margin-top: 0.5rem;
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

    .asset-main {
        display: block;
    }

    .asset-footer {
        width: var(--size);
        max-width: var(--size);
        margin-top: 6px;
        font-size: 0.68rem;
        color: var(--color-text-secondary);
    }

    .asset-footer details,
    .asset-footer .footer-row {
        padding: 3px 0;
    }

    .asset-footer summary,
    .asset-footer .footer-row {
        display: grid;
        grid-template-columns: 11px minmax(0, 1fr) min-content;
        column-gap: 5px;
        align-items: center;
        color: var(--color-text-muted);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .asset-footer summary {
        cursor: pointer;
        list-style: none;
    }

    .asset-footer summary::-webkit-details-marker {
        display: none;
    }

    .asset-footer summary::before {
        content: "";
        width: 0;
        height: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-left: 7px solid currentColor;
        transform-origin: 35% 50%;
        transition: transform 0.12s ease;
    }

    .asset-footer details[open] summary::before {
        transform: rotate(90deg);
    }

    .asset-footer .footer-row::before {
        content: "";
    }

    .asset-footer .is-empty {
        color: color-mix(in srgb, var(--color-text-muted) 52%, transparent);
        cursor: default;
    }

    .footer-label {
        min-width: 0;
    }

    .footer-count {
        color: var(--color-text-muted);
        font-weight: 700;
        justify-self: end;
        min-width: 2ch;
        text-align: right;
    }

    .asset-footer :global(.extensions) {
        margin: 4px 0 0 16px;
    }

    .footer-tags {
        margin: 4px 0 0 16px;
    }

    .metadata-tags {
        margin: 4px 0 0 16px;
        display: grid;
        gap: 4px;
    }

    .metadata-tags div {
        min-width: 0;
    }

    .metadata-tags dt {
        color: var(--color-text-muted);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .metadata-tags dd {
        margin: 1px 0 0;
        overflow-wrap: anywhere;
        white-space: normal;
        color: var(--color-text-primary);
    }

    p {
        margin: 0;
        padding: 0;
    }

    ul {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: flex-start;
        margin: 0;
        padding: 0;
    }

    .groups {
        justify-content: left;
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
        color: var(--color-text-muted);
        font-size: 0.74rem;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-top: 1rem;
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
