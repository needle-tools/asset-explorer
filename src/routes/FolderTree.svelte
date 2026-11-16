<script lang="ts">
import { base } from "$app/paths";

export let node: any;
export let selected = "";
export let depth = 0;
export let highlightSelected = true;

$: expanded = depth === 0 || selected === node.path || selected.startsWith(node.path + "/");
$: href = node.path ? `${base}/?category=${encodeURIComponent(node.path)}` : `${base}/`;
</script>

<details open={expanded}>
    <summary class:selected={highlightSelected && selected === node.path}>
        <a href={href} aria-current={selected === node.path ? "page" : undefined}>{node.name}</a>
        <span>{node.count}</span>
    </summary>
    {#if node.children?.length}
    <ul>
        {#each node.children as child}
        <li>
            <svelte:self node={child} {selected} {highlightSelected} depth={depth + 1} />
        </li>
        {/each}
    </ul>
    {/if}
</details>

<style>
details {
    margin: 2px 0;
}

summary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 8px;
    border-radius: 6px;
    color: var(--color-text-secondary);
    cursor: pointer;
}

summary:hover {
    background: var(--workspace-hover);
}

summary.selected {
    background: var(--workspace-selected);
}

summary.selected a {
    color: var(--color-text-primary);
    font-weight: 700;
}

a {
    flex: 1;
    min-width: 0;
    padding-block: 7px;
    overflow-wrap: anywhere;
    color: inherit;
    text-decoration: none;
}

span {
    color: var(--color-text-muted);
    font-size: 0.75rem;
}

ul {
    margin: 2px 0 2px 14px;
    padding: 0;
}

li {
    list-style: none;
}
</style>
