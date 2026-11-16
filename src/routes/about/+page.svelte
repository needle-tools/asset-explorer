<script>
import { base } from "$app/paths";
import Seo from "$lib/Seo.svelte";
export let data;
const SITE = "https://asset-explorer.needle.tools";
</script>

<Seo
	title="About – Asset Explorer"
	description="About Asset Explorer, a Needle test gallery for glTF assets, USDZ conversions, provenance, and 3D file interoperability."
	image={SITE + "/asset-explorer.jpg"}
/>

<div class="about-workspace">
    <aside aria-label="About navigation">
        <a class="back-link" href="{base}/"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3m4-4L3 8l4 4" /></svg>Back to all assets</a>
        {#if data.sections?.length}
        <nav aria-label="On this page">
            <h2>On this page</h2>
            {#each data.sections as section}
                <a href={"#" + section.id}>{section.title}</a>
            {/each}
        </nav>
        {/if}
    </aside>
    <article class="workspace-prose">{@html data.readme}</article>
</div>

<style>
.about-workspace {
    display: grid;
    grid-template-columns: 184px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
}

aside {
    position: sticky;
    top: 76px;
    max-height: calc(100dvh - 92px);
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-gutter: stable;
    scrollbar-color: transparent transparent;
}

aside:is(:hover, :focus-within) {
    scrollbar-color: color-mix(in srgb, var(--color-text-muted) 25%, transparent) transparent;
}

.back-link {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
}

aside a {
    display: flex;
    padding: 8px;
    border-radius: 6px;
    color: var(--color-text-secondary);
    font-size: 13px;
}

aside a:hover {
    background: color-mix(in srgb, var(--color-text-muted) 7%, transparent);
    color: var(--color-text-primary);
    text-decoration: none;
}

h2 {
    margin: 20px 8px 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
}

article :global(> h1:first-child) {
    margin-top: 0;
}

@media (max-width: 600px) {
    .about-workspace {
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
    }

    aside {
        position: static;
        max-height: none;
    }

    nav {
        display: none;
    }
}
</style>
