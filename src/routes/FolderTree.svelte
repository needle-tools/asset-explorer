<script lang="ts">
import { base } from "$app/paths";

export let node: any;
export let selected = "";
export let depth = 0;

$: expanded = depth === 0 || selected === node.path || selected.startsWith(node.path + "/");
$: href = node.path ? `${base}/?category=${encodeURIComponent(node.path)}` : `${base}/`;
</script>

<details open={expanded}>
    <summary class:selected={selected === node.path}>
        <a href={href}>{node.name}</a>
        <span>{node.count}</span>
    </summary>
    {#if node.children?.length}
    <ul>
        {#each node.children as child}
        <li>
            <svelte:self node={child} {selected} depth={depth + 1} />
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
    white-space: nowrap;
    color: var(--color-text-secondary);
    cursor: pointer;
}

summary.selected a {
    color: var(--color-text-primary);
    font-weight: 700;
}

a {
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
