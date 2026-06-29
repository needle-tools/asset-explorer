<script>
import Seo from "$lib/Seo.svelte";
export let data;
const SITE = "https://asset-explorer.needle.tools";
</script>

<Seo
	title="About – Asset Explorer"
	description="About Asset Explorer, a Needle test gallery for glTF assets, USDZ conversions, provenance, and 3D file interoperability."
	image={SITE + "/asset-explorer.jpg"}
/>

<div class="text-column html">
	{@html data.readme} 
	<div hidden>
		<p></p>
	</div>
</div>

<style>
:global(.html a) {
	color: var(--color-primary);
	text-decoration: underline;
}
</style>
