<script lang="ts">
export let showXROverlay = false;
</script>

{#if showXROverlay}
<div class="info overlay">
    <slot></slot>
    <button on:click={(evt) => {
        showXROverlay = false;
        evt.stopPropagation();
    }}>✕</button>
    <button on:click>Show QR Code</button>
</div>
{/if}

<style>

.overlay {
    position: absolute;
    left: 0;
    margin: 0;
    display: flex;
    bottom: 0;
    white-space: nowrap;
}
</style>