<script lang="ts">
import { base } from "$app/paths";
import { track } from "$lib/analytics";

export let info: Record<string, any>;

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
};

// preferred row order; unknown keys fall to the end
const order = Object.keys(labels);

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
    .filter(([k, v]) => !isExtension(k) && showInfo(k, v))
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
            {#each rows as [key, value] (key)}
                <tr>
                    <th>{label(key)}</th>
                    <td>{displayValue(value)}</td>
                </tr>
            {/each}
        </tbody>
    </table>

    {#if extensions.length}
        <div class="extensions">
            <span class="ext-label">Extensions</span>
            <ul>
                {#each extensions as ext (ext)}
                    <li>
                        <a
                            href="{base}/?tag={ext}"
                            title={ext}
                            on:click={() => track("tag_filter", { tag: ext })}
                        >{ext}</a>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>

<style>
.model-info {
    max-width: 38rem;
    margin: 8px auto 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
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
    font-weight: 700;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

td {
    padding: 8px 0;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
}

.extensions {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border-subtle);
}

.ext-label {
    color: var(--color-text-muted);
    font-weight: 700;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.extensions ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.extensions li a {
    display: inline-block;
    padding: 2px 8px;
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    background-color: rgba(26, 26, 26, 0.04);
    border: 1px solid rgba(26, 26, 26, 0.18);
    border-radius: 6px;
}

.extensions li a:hover {
    text-decoration: none;
    color: var(--color-text-primary);
    background-color: rgba(153, 204, 51, 0.18);
}
</style>
