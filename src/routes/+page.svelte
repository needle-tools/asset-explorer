<script lang="ts">
import { page } from '$app/stores'
import { cubicInOut } from 'svelte/easing';
import ModelTags, { showInfo } from './ModelTags.svelte';
import { browser } from "$app/environment";
import { base } from '$app/paths';

export let data;

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

<svelte:head>
	<title>Explore Assets</title>
	<meta name="description" content="glTF and USD sample models and conversions" />
</svelte:head>

<h3 class="title">Asset capabilities</h3>
<ModelTags tags={getAndCountTags(data)} filter={filter} ignoreTags={["generator", "source"]}/>

<h3 class="title">Assets and conversions</h3>
<ul class="models">
    {#each data.models.filter(x => !filter || showInfo(x.extras.info, filter)) as model (model.slug)}
        <li transition:whoosh>
            <a href="{base}/{model.slug}">
                <img src="{model.thumbnail}" alt="{model.name}" />
                <p class="name">{model.name}</p>
                <ModelTags tags={model.extras.info} filter={filter} ignoreValuesForTags={["copyright"]} truncate/>
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
        color: black;
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
        border: 1px solid rgba(0,0,0,0);
    }
    
    img {
        width: var(--size);
        height: var(--size);
        object-fit: contain;
    }

    li:hover {
        transform: scale(1.02);
        background-color: var(--color-bg-0);
        padding: 10px;
        margin: -5px;
        border-radius: 10px;
        box-shadow: 0px 0px 2px rgba(0,0,0,0.1);
        z-index: 10;
    }

    .title {
        text-align: center;
    }

    @media (prefers-color-scheme: dark) {
        li:hover {
            border: 1px solid rgba(255,255,255,0.08);
        }
    }
</style>