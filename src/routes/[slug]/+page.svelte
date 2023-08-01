<script>
import Model from "./Model.svelte";

export let data;
let windowLocation = "https://asset-explorer.needle.tools/";
</script>

<svelte:head>
	<title>{data.model?.displayName}</title>
	<meta name="description" content="glTF and USD sample models and conversions" />
    <meta property="og:image" content="{windowLocation + data.model.previewUri}" />
    <meta property="og:title" content="{data.model.displayName}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:image" content="{windowLocation + data.model.previewUri}" />
</svelte:head>

<div>
    {#if data.model}
    {#key "constant"}
        <Model model={data.model} next={data.next} previous={data.previous}/>
    {/key}
    {/if}
</div>

<style>
    div {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: flex-start;
    }
</style>
