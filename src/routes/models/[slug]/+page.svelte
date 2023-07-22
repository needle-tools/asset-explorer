<script>
import { onMount } from "svelte";
import { fileStore } from "../fileStore";
import Model from "./Model.svelte";

export let data;

$: array = [
    data.previous, 
    data.current, 
    data.next,
];

onMount(() => {
	console.log("mounted, setting data");
	fileStore.set({
		prev: data.previous?.downloadUri,
		current: data.current?.downloadUri,
		next: data.next?.downloadUri,
	});
})
</script>

<svelte:head>
	<title>Model: {data.current?.displayName}</title>
	<meta name="description" content="About this app" /> 
</svelte:head>

<div>
    {#each array as item (item?.key)}
        {#if item}
            <Model data={item} />
        {/if}
    {/each}
</div>

<style>
    div {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
    }
</style>
