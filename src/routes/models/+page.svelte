<script lang="ts">
export let data;

function showInfo(array, key) {
    if (key === "scenes")
        return array[key] > 1;
    return array[key];
}

function getInfoString(array, key) {
    if (typeof array[key] === "boolean")
        return key;
    return key  + ": " + array[key];
}

function getAndCountTags() {
    const tags = new Map<string, number>();
    for (const model of data.models) {
        for (const tag of model.extras.extensions) {
            if (tags.get(tag) === undefined)
                tags.set(tag, 1);
            tags.set(tag, tags.get(tag) + 1);
        }
        for (const tag of Object.keys(model.extras.info)) {
            if (!showInfo(model.extras.info, tag))
                continue;
            if (tags.get(tag) === undefined)
                tags.set(tag, 1);
            tags.set(tag, tags.get(tag) + 1);
        }
    }
    return tags;
}

</script>

<svelte:head>
	<title>Model Overview</title>
	<meta name="description" content="About this app" />
</svelte:head>

<ul class="extensions group">
    {#each getAndCountTags() as tag}
        <li>
            <a href="/models?tag={tag}">
                <span class="tag-name">{tag[0]}</span>
                <span class="tag-count">{tag[1]}</span>
            </a>
        </li>
    {/each}
</ul>

<ul class="models">
    {#each data.models as model}
        <li>
            <a href="/models/{model.slug}">
                <img src="{model.thumbnail}" alt="{model.name}" />
                <p class="name">{model.name}</p>
                <ul class="extensions">
                    {#each model.extras.extensions as extension}
                        <li>{extension}</li>
                    {/each}
                    {#each Object.keys(model.extras.info) as info}
                        {#if showInfo(model.extras.info, info)}
                            <li class="{info}">{getInfoString(model.extras.info, info)}</li>
                        {/if}
                    {/each}
                </ul>
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
        white-space: nowrap;
    }

    .models a {
        max-width: var(--size);
    }

    p {
        margin: 0;
        padding: 0;
    }

    ul.extensions {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
        margin: 0px -7px;
    }

    ul.extensions.group {
        margin: 4px;
    }

    ul.extensions li {
        /*background-color: #b1b1b1;*/
        border: 1px solid rgba(0,0,0,0.05);
        padding: 2px 6px;
        margin: 2px;
        border-radius: 10px;
        font-size: 0.6rem;
        color: hsl(0, 0%, 55%);
        overflow: hidden;
    }

    ul.extensions li .tag-count {
        background-color: rgba(114, 163, 206, 0.216);
        padding: 6px;
        margin-right: -5px;
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