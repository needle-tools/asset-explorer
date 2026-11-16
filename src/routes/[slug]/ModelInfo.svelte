<script lang="ts">
import { base } from "$app/paths";
import { track } from "$lib/analytics";

export let info: Record<string, any>;
export let name = "";
export let sourceUrl = "";
export let provenance: { label: string; kind: string; comparisonUrl: string; upstreamUrl: string | null } | null = null;

// Extensions are UPPER_SNAKE_CASE keys (KHR_*, EXT_*, ADOBE_*, …); everything else is scalar info.
const isExtension = (k: string) => /^[A-Z][A-Z0-9]+_/.test(k);

const labels: Record<string, string> = {
    generator: "Generator",
    copyright: "Copyright",
    source: "Source",
    fileSize: "File size",
    textures: "Textures",
    scenes: "Scenes",
    animations: "Animations",
    skins: "Skins",
    cameras: "Cameras",
    vertexColors: "Vertex colors",
    blendShapes: "Blend shapes",
    alphaMask: "Alpha mask",
    alphaBlend: "Alpha blend",
    tangents: "Tangents",
    doubleSidedMaterials: "Double-sided materials",
    normalMaps: "Normal maps",
    occlusionMaps: "Occlusion maps",
    hasShear: "Has shear",
};

// preferred row order; unknown keys fall to the end
const order = Object.keys(labels);
const metadataKeys = new Set(["generator", "copyright", "source", "fileSize"]);

function showInfo(key: string, value: any) {
    if (key === "scenes") return value > 1; // 1 scene is the normal case
    return !!value;
}

function label(key: string) {
    return labels[key] ?? key;
}

function displayValue(value: any) {
    return value === true ? "Yes" : value;
}

$: entries = Object.entries(info);
$: rows = entries
    .filter(([k, v]) => metadataKeys.has(k) && showInfo(k, v))
    .sort((a, b) => {
        const ia = order.indexOf(a[0]);
        const ib = order.indexOf(b[0]);
        return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });
$: capabilities = entries
    .filter(([k, v]) => !metadataKeys.has(k) && !isExtension(k) && showInfo(k, v))
    .sort((a, b) => {
        const ia = order.indexOf(a[0]);
        const ib = order.indexOf(b[0]);
        return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });
$: extensions = entries.filter(([k, v]) => isExtension(k) && v).map(([k]) => k);
</script>

<div class="model-info">
    <table>
        <tbody>
            {#if name}<tr><th scope="row">Name</th><td>{name}</td></tr>{/if}
            {#each rows as [key, value] (key)}
                <tr><th scope="row">{label(key)}</th><td>
                    {#if key === "source" && sourceUrl}
                    <a class="source-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">{displayValue(value)}</a>
                    {:else}{displayValue(value)}{/if}
                </td></tr>
            {/each}
            {#if provenance}
            <tr><th scope="row">Origin</th><td>
                {#if provenance.kind === "needle-added" || provenance.kind === "needle-modified"}
                <a class="source-link" href={provenance.comparisonUrl} target="_blank" rel="noopener noreferrer">{provenance.label}</a>
                {:else}{provenance.label}{/if}
            </td></tr>
            {/if}
            {#if capabilities.length}
            <tr>
                <th scope="row">Has special data</th>
                <td><ul class="badges">
                    {#each capabilities as [key, value] (key)}
                    <li><a href="{base}/?tag={key}" title={label(key)} on:click={() => track("tag_filter", { tag: key })}>
                        {label(key)}<span class="value-count">{displayValue(value)}</span>
                    </a></li>
                    {/each}
                </ul></td>
            </tr>
            {/if}
            {#if extensions.length}
            <tr>
                <th scope="row">Extensions</th>
                <td><ul class="badges">
                    {#each extensions as ext (ext)}
                    <li><a href="{base}/?tag={ext}" title={ext} on:click={() => track("tag_filter", { tag: ext })}>{ext}</a></li>
                    {/each}
                </ul></td>
            </tr>
            {/if}
            {#if $$slots.default}
            <tr><th scope="row">Info</th><td class="info-notes"><slot /></td></tr>
            {/if}
        </tbody>
    </table>
</div>

<style>
.model-info {
    max-width: 100%;
    margin: 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

tr {
    border-bottom: 1px solid var(--color-border-subtle);
}

tr:last-child {
    border-bottom: none;
}

th {
    text-align: left;
    vertical-align: top;
    white-space: nowrap;
    width: 1%;
    padding: 8px 18px 8px 0;
    color: var(--color-text-muted);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: normal;
    text-transform: none;
}

td {
    padding: 8px 0;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
    text-wrap: balance;
}

.badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.badges li a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    background-color: transparent;
    border: 0;
    border-radius: 6px;
}

.badges li a:hover {
    text-decoration: none;
    color: var(--color-text-primary);
    background-color: rgba(153, 204, 51, 0.18);
}
.value-count {
    padding: 0 4px;
    border-radius: 4px;
    background: #fff;
    border: 1px solid var(--color-border-subtle);
    font-size: 10px;
}
.source-link {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--color-border-strong);
    text-underline-offset: 3px;
}

.source-link:hover {
    text-decoration-color: currentColor;
}

</style>
