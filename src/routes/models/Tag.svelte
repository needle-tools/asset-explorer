<script lang="ts">
export let href: string;
export let selected: boolean;
export let name: string;
export let value: number | boolean;
export let showValue: boolean = true;

$: shouldBeLink = name !== "copyright" && name !== "generator";
$: _showValue = showValue && typeof value !== "boolean";

</script>

<li class={selected ? 'selected' : ''}>
    <a href={shouldBeLink ? href : '#'}>
        <span class="tag-name">{name}</span>
        {#if _showValue}
            <span class="tag-count">{value}</span>
        {/if}
    </a>
</li>

<style>
li {
    /*background-color: #b1b1b1;*/
    border: 1px solid rgba(0,0,0,0.05);
    margin: 2px;
    border-radius: 10px;
    font-size: 0.6rem;
    color: hsl(0, 0%, 55%);
    overflow: hidden;
}

li a {
    color: hsl(0, 0%, 55%);
    display: flex;
    align-items: center;
}

li.selected {
    background-color: rgba(114, 163, 206, 0.216);
    border: 1px solid rgba(0,0,0,0.2);
    color: hsl(0, 0%, 20%);
}

span {
    padding: 2px 6px;
}

li .tag-count {
    background-color: rgba(114, 163, 206, 0.216);
    word-break: break-word;
}
</style>