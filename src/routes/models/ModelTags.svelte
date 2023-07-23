<script lang="ts">
import Tag from "./Tag.svelte";

export let tags: any;
export let filter: string | null = null;
export let ignoreTags: string[] = [];
export let ignoreValuesForTags: string[] = [];

</script>

<script context="module" lang="ts">

export function showInfo(array: any, key: string) {
    if (key === "scenes") // special case, 1 scene is normal
        return array[key] > 1;
    return array[key];
}

</script>

<ul class="extensions">
    {#each Object.keys(tags).filter(x => ignoreTags.indexOf(x) < 0)  as info}
        {#if showInfo(tags, info)}
            <Tag
                href="/models?tag={filter == info ? '' : info}"
                selected={filter == info}
                name={info}
                value={tags[info]}
                showValue={ignoreValuesForTags.indexOf(info) < 0}/>
        {/if}
    {/each}
</ul>

<style>

ul {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    justify-content: flex-start;
    margin: 0px -7px;
}

</style>