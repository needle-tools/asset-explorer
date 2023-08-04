<script>
export let data;
</script>

<svelte:head>
	<title>About Asset Explorer</title> 
</svelte:head>

<div class="text-column html">
	{@html data.readme} 
	<div hidden>
		<p></p>
	</div>
</div>

<style>
:global(.html p) {
}

:global(.html a) {
	color: var(--color-primary);
	text-decoration: underline;
}
</style>