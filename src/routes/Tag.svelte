<script lang="ts">
import { track } from "$lib/analytics";

export let href: string;
export let excludeHref: string | null = null;
export let selected: boolean;
export let excluded: boolean = false;
export let name: string;
export let value: number | boolean | string;
export let showValue: boolean = true;
export let disabled = false;

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;

function onTagClick(event: MouseEvent) {
    if (disabled) {
        event.preventDefault();
        return;
    }
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

$: shouldBeLink = href !== "#" && !disabled;
$: _showValue = showValue && typeof value !== "boolean";
// long string values (e.g. generator, source) stack below the label instead of beside it
$: _stack = _showValue && typeof value === "string" && value.length > 14;
$: fullValue = typeof value === "string" ? value : "";
</script>

<li class:selected class:excluded class:unavailable={disabled}>
    <a
        class:stacked={_stack}
        class:numeric={typeof value === "number"}
        href={disabled ? undefined : shouldBeLink ? href : "#"}
        aria-disabled={disabled ? "true" : undefined}
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
    list-style: none;
    margin: 2px;
    font-size: 12px;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
}

li a {
    display: flex;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    align-items: baseline;
    gap: 5px;
    padding: 3px 4px;
    border-radius: 4px;
    color: var(--color-text-secondary);
    text-decoration: none;
}

li:not(.unavailable) a:hover {
    color: var(--color-text-primary);
    background: var(--workspace-hover);
    text-decoration: underline;
}

.tag-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
}

.tag-count {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text-secondary);
    font-weight: 400;
}

.numeric .tag-count {
    min-width: 3ch;
    text-align: center;
    flex-shrink: 0;
    white-space: nowrap;
    padding: 0 4px;
    border-radius: 4px;
    background: #fff;
    border: 1px solid var(--color-border-subtle);
    font-size: 10px;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
}

li a.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 1px;
}

li.selected a {
    background: var(--workspace-selected);
    color: var(--color-text-primary);
}

li.excluded a {
    background: rgba(198, 74, 74, 0.1);
}

li.excluded .tag-name {
    text-decoration: line-through;
}
li.unavailable {
    opacity: 0.38;
}

li.unavailable a {
    cursor: default;
}
</style>
