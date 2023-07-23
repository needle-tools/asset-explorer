<script lang="ts">
export let href: string;
export let selected: boolean;
export let name: string;
export let value: number | boolean;

$: showValue = typeof value !== "boolean";

</script>

<li class={selected ? 'selected' : ''}>
    <a href={href}>
        <span class="tag-name">{name}</span>
        {#if showValue}
            <span class="tag-count">{value}</span>
        {/if}
    </a>
</li>

<style>
li {
    /*background-color: #b1b1b1;*/
    border: 1px solid rgba(0,0,0,0.05);
    padding: 2px 6px;
    margin: 2px;
    border-radius: 10px;
    font-size: 0.6rem;
    color: hsl(0, 0%, 55%);
    overflow: hidden;
}

li a {
    color: hsl(0, 0%, 55%);
}

li.selected {
    background-color: rgba(114, 163, 206, 0.216);
    border: 1px solid rgba(0,0,0,0.2);
    color: hsl(0, 0%, 20%);
}

li .tag-count {
    background-color: rgba(114, 163, 206, 0.216);
    padding: 6px;
    margin-right: -5px;
}
</style>