<script lang="ts">
import { onMount } from 'svelte';
import { page } from '$app/stores'
import { fly, scale } from 'svelte/transition';
import { cubicInOut, elasticOut } from 'svelte/easing';
import Tag from './Tag.svelte';
import ModelTags, { showInfo } from './ModelTags.svelte';

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

$: filter = $page.url.searchParams.get('tag');

</script>

<svelte:head>
	<title>Model Overview</title>
	<meta name="description" content="About this app" />
</svelte:head>

<ModelTags tags={getAndCountTags(data)} filter={filter} ignoreValuesForTags={["copyright"]}/>

<ul class="models">
    {#each data.models.filter(x => !filter || showInfo(x.extras.info, filter)) as model (model.slug)}
        <li transition:whoosh>
            <a href="/models/{model.slug}">
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

    .models li {
        display: flex;
        flex-direction: column; 
        max-width: var(--size);
        transition: transform 0.2s ease-in-out, background-color 0.2s linear, margin 0.2s linear, padding 0.2s linear;

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
    }
    
    img {
        width: var(--size);
        height: var(--size);
        object-fit: contain;
    }

    li:hover {
        transform: scale(1.05);
        background-color: white;
        padding: 10px;
        margin: -5px;
        border-radius: 10px;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
        z-index: 10;
    }
</style>