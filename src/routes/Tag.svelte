<script lang="ts">
export let href: string;
export let selected: boolean;
export let name: string;
export let value: number | boolean;
export let showValue: boolean = true;
export let truncate: boolean = false;

const truncateLength = 30;

$: shouldBeLink = name !== "generator";
$: _showValue = showValue && typeof value !== "boolean";
$: truncatedValue = (truncate && (typeof value === "string") && value.length > truncateLength + 2)
    ? value.substring(0, truncateLength) + "..."
    : value;
</script>

<li class={selected ? 'selected' : ''}>
    <a href={shouldBeLink ? href : '#'}>
        <span class="tag-name">{name}</span>
        {#if _showValue}
            <span class="tag-count">{truncatedValue}</span>
        {/if}
    </a>
</li>

<style>
li {
    /*background-color: #b1b1b1;*/
    border: 1px solid rgba(0,0,0,0.08);
    margin: .2rem .5rem;
    border-radius: 5px;
    font-size: 0.8rem;
    color: var(--color-text);
    overflow: hidden;
}

li a:hover {
    text-decoration: none;
    background-color: rgba(114, 163, 206, 0.3);
}

li a {
    color: var(--color-text);
    display: flex;
    align-items: center;
}

li.selected {
    background-color: rgba(114, 163, 206, 0.4);
    border: 1px solid rgba(0,0,0,0.2);
}
li.selected a {
}

span {
    padding: 2px 6px;
}

li .tag-count {
    background-color: rgba(114, 163, 206, 0.216);
    word-break: break-word;
}

@media (prefers-color-scheme: dark) {
    li {
        border: 1px solid rgba(255,255,255,0.08);
    }
}

</style>