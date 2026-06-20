<script lang="ts">
import { page } from '$app/stores'
import { cubicInOut } from 'svelte/easing';
import ModelTags, { showInfo } from './ModelTags.svelte';
import { browser } from "$app/environment";
import { base } from '$app/paths';
import Seo from '$lib/Seo.svelte';

export let data;
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

function getAndCountTags(_data) {
    const tags: any = {};

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

function whoosh(node, params) {
    const existingTransform = getComputedStyle(node).transform.replace('none', '');

    return {
      delay: params.delay || 0,
      duration: params.duration || 200,
      easing: params.easing || cubicInOut,
      css: (t, u) => `opacity: ${t}; scale: ${t * 1};`
    };
  }

$: filter = browser && $page.url.searchParams.get('tag');

</script>

<Seo
    title={seoTitle}
    description={seoDescription}
    image={SITE + "/asset-explorer.jpg"}
    jsonLd={homeJsonLd}
/>

<h3 class="title">Asset capabilities</h3>
<ModelTags tags={getAndCountTags(data)} filter={filter} ignoreTags={["generator", "source"]}/>

<h3 class="title">Assets and conversions</h3>
<ul class="models">
    {#each data.models.filter(x => !filter || showInfo(x.extras.info, filter)) as model (model.slug)}
        <li transition:whoosh>
            <a href="{base}/{model.slug}">
                <img src="{model.thumbnail}" alt="{model.name}" />
                <p class="name">{model.name}</p>
                <ModelTags tags={model.extras.info} filter={filter} ignoreValuesForTags={["copyright"]}/>
            </a>
        </li>
    {/each}
</ul>

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

    li {
        list-style-type: none;
        border: 1px solid transparent;
    }

    img {
        width: var(--size);
        height: var(--size);
        object-fit: contain;
        background-color: var(--color-bg-panel);
        border: 1px solid var(--color-border-subtle);
        border-radius: var(--radius-card);
        box-shadow: 0 1px 4px rgba(26, 26, 26, 0.08);
        box-sizing: border-box;
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
</style>