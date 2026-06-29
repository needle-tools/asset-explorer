<script lang="ts">
import { track } from "$lib/analytics";

export let href: string;
export let excludeHref: string | null = null;
export let selected: boolean;
export let excluded: boolean = false;
export let name: string;
export let value: number | boolean | string;
export let showValue: boolean = true;

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;

function onTagClick(event: MouseEvent) {
    if (longPressTriggered) {
        longPressTriggered = false;
        event.preventDefault();
        return;
    }
    if (!shouldBeLink) return;
    // `selected` reflects the state before navigation: a selected tag toggles the filter off
    track(selected || excluded ? "tag_filter_clear" : "tag_filter", { tag: name });
}

function clearLongPress() {
    if (!longPressTimer) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
}

function onPointerDown() {
    if (!shouldBeLink || !excludeHref) return;
    clearLongPress();
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        track(excluded ? "tag_filter_clear" : "tag_filter_exclude", { tag: name });
        window.location.href = excludeHref!;
    }, 550);
}

function onPointerUp() {
    clearLongPress();
}

function onContextMenu(event: MouseEvent) {
    if (!shouldBeLink || !excludeHref) return;
    event.preventDefault();
    track(excluded ? "tag_filter_clear" : "tag_filter_exclude", { tag: name });
    window.location.href = excludeHref;
}

$: shouldBeLink = name !== "generator";
$: _showValue = showValue && typeof value !== "boolean";
// long string values (e.g. generator, source) stack below the label instead of beside it
$: _stack = _showValue && typeof value === "string" && value.length > 14;
$: fullValue = typeof value === "string" ? value : "";
</script>

<li class:selected class:excluded>
    <a
        class:stacked={_stack}
        href={shouldBeLink ? href : '#'}
        title={excludeHref ? "Click to include or remove. Long-press/right-click to exclude." : undefined}
        on:click={onTagClick}
        on:pointerdown={onPointerDown}
        on:pointerup={onPointerUp}
        on:pointerleave={onPointerUp}
        on:pointercancel={onPointerUp}
        on:contextmenu={onContextMenu}
    >
        <span class="tag-name" title={name}>{name}</span>
        {#if _showValue}
            <span class="tag-count" title={fullValue}>{value}</span>
        {/if}
    </a>
</li>

<style>
li {
    background-color: rgba(26, 26, 26, 0.04);
    border: 1px solid rgba(26, 26, 26, 0.18);
    border-radius: 6px;
    margin: 2px;
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
}

li a {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
    padding: 3px 8px;
    color: inherit;
}

li a:hover {
    text-decoration: none;
    background-color: rgba(153, 204, 51, 0.18);
    color: var(--color-text-primary);
}

/* long string values stack below the label instead of beside it */
li a.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 1px;
}

.tag-name {
    white-space: nowrap;
    color: var(--color-text-muted);
    min-width: 0;
}

.stacked .tag-name {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
}

.tag-count {
    min-width: 0;
    max-width: 22rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
    font-weight: 600;
}

.stacked .tag-count {
    font-weight: 500;
}

li.selected {
    background-color: rgba(153, 204, 51, 0.28);
    border-color: var(--color-green);
}

li.excluded {
    background-color: rgba(198, 74, 74, 0.13);
    border-color: rgba(198, 74, 74, 0.65);
}

li.selected a,
li.selected .tag-name {
    color: var(--color-text-primary);
}

li.excluded .tag-name {
    color: var(--color-text-primary);
    text-decoration: line-through;
}
</style>
