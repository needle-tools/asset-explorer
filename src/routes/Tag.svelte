<script lang="ts">
export let href: string;
export let selected: boolean;
export let name: string;
export let value: number | boolean;
export let showValue: boolean = true;

$: shouldBeLink = name !== "generator";
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
    border: 1px solid rgba(0,0,0,0.2);
    margin: .2rem .5rem;
    border-radius: 5px;
    font-size: 0.8rem;
    color: hsl(0, 0%, 33%);
    overflow: hidden;
}

li a:hover {
    text-decoration: none;
    background-color: rgba(114, 163, 206, 0.3);
}

li a {
    color: hsl(0, 0%, 30%);
    display: flex;
    align-items: center;
}

li.selected {
    background-color: rgba(114, 163, 206, 0.4);
    border: 1px solid rgba(0,0,0,0.2);
}
li.selected a {
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