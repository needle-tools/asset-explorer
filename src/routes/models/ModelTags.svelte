<script lang="ts">
import Tag from "./Tag.svelte";

export let tags: any;
export let filter: string | null = null;

</script>

<script context="module">

export function showInfo(array, key) {
    if (key === "scenes")
        return array[key] > 1;
    return array[key];
}

</script>

<ul class="extensions">
    {#each Object.keys(tags) as info}
        {#if showInfo(tags, info)}
            <Tag href="/models?tag={filter == info ? '' : info}" selected={filter == info} name={info} value={tags[info]} />
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