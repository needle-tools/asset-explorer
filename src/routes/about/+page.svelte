<script>
import Seo from "$lib/Seo.svelte";
export let data;
const SITE = "https://asset-explorer.needle.tools";
</script>

<Seo
	title="About – Asset Explorer"
	description="About the Asset Explorer — a gallery of glTF and USD sample models and their USDZ conversions for three.js, Blender, and Omniverse, by Needle."
	image={SITE + "/asset-explorer.jpg"}
/>

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