<script lang="ts">
import { page } from "$app/stores";

export let title: string;
export let description: string;
export let image: string | undefined = undefined;
export let type: string = "website";
export let jsonLd: object | undefined = undefined;

const SITE_URL = "https://asset-explorer.needle.tools";
const SITE_NAME = "Needle Asset Explorer";

$: canonical = SITE_URL + $page.url.pathname;

// Build the JSON-LD <script> tag without a literal script tag in source
// (a literal <script> inside <svelte:head> breaks the Svelte compiler).
const TAG_OPEN = "<" + 'script type="application/ld+json">';
const TAG_CLOSE = "</" + "script>";
$: jsonLdTag = jsonLd
    ? TAG_OPEN + JSON.stringify(jsonLd).replace(/</g, "\\u003c") + TAG_CLOSE
    : "";
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />

    <meta property="og:type" content={type} />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    {#if image}<meta property="og:image" content={image} />{/if}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    {#if image}<meta name="twitter:image" content={image} />{/if}

    {#if jsonLd}{@html jsonLdTag}{/if}
</svelte:head>
