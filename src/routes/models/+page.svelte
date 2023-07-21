<script>
export let data;
</script>

<svelte:head>
	<title>Model Overview</title>
	<meta name="description" content="About this app" />
</svelte:head>

<ul>
    {#each data.models as model}
        <li>
            <a href="/models/{model.slug}">
                {model.name}
            </a>
        </li>
    {/each}
</ul>