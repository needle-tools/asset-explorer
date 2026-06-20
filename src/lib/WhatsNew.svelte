<script lang="ts">
import { onMount, onDestroy } from "svelte";
import { fade } from "svelte/transition";

// Needle "What's New" feed — https://marketer.needle.tools/api/whats-new
const SURFACE = "asset-explorer.needle.tools";
const FEED_URL =
    `https://marketer.needle.tools/api/whats-new?surface=${SURFACE}` +
    `&tags=3d-design,rendering,compression`;
const ROTATE_MS = 10000;

type FeedItem = {
    id: string;
    url: string | null;
    colors: string[];
    banner: { title: string; subtitle: string; cta: string };
};

let items: FeedItem[] = [];
let current: FeedItem | null = null;
let reduceMotion = false;
let rotateTimer: ReturnType<typeof setInterval> | undefined;

// the feed is already ranked by priority server-side; rotate by cycling through it.
let index = -1;
function nextItem() {
    if (items.length === 0) return;
    index = (index + 1) % items.length;
    current = items[index];
}

onMount(async () => {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Load the engagement tracker once. With the data-needle-whatsnew attribute
    // below, it auto-tracks impressions, *hover*, and click (incl. SPA-added
    // nodes — every rotation remounts the anchor as a fresh node it can wire).
    if (!document.querySelector("script[data-needle-whatsnew-loader]")) {
        const s = document.createElement("script");
        s.src = "https://marketer.needle.tools/whatsnew.js";
        s.defer = true;
        s.dataset.surface = SURFACE;
        s.setAttribute("data-needle-whatsnew-loader", "");
        document.head.appendChild(s);
    }

    try {
        const res = await fetch(FEED_URL);
        if (!res.ok) return;
        const data = await res.json();
        items = (data.items ?? []).filter((it: FeedItem) => it?.banner?.title);
        if (items.length === 0) return;

        nextItem();
        if (items.length > 1) {
            rotateTimer = setInterval(nextItem, ROTATE_MS);
        }
    } catch {
        // feed is non-critical; stay hidden on failure
    }
});

onDestroy(() => clearInterval(rotateTimer));

// theme from the item's authored colors (0–2 hex); fall back to brand green
$: accent = current?.colors?.[0] || "#99cc33";
$: ctaFg = readableOn(accent);

function readableOn(hex: string): string {
    const m = /^#?([\da-f]{6})$/i.exec(hex);
    if (!m) return "#1a1a1a";
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.45 ? "#1a1a1a" : "#ffffff";
}
</script>

{#if current}
    <aside
        class="whatsnew"
        aria-label="What's new at Needle"
        style="--wn-accent: {accent}; --wn-cta-fg: {ctaFg};"
    >
        <div class="wn-slot">
            {#key current.id}
                <a
                    class="wn-item"
                    href={current.url ?? "#"}
                    target="_blank"
                    rel="noopener"
                    data-needle-whatsnew={current.id}
                    in:fade={{ duration: reduceMotion ? 0 : 350 }}
                    out:fade={{ duration: reduceMotion ? 0 : 350 }}
                >
                    <span class="wn-text">
                        <span class="wn-title">{current.banner.title}</span>
                        <span class="wn-subtitle">{current.banner.subtitle}</span>
                    </span>
                    {#if current.banner.cta}
                        <span class="wn-cta">{current.banner.cta}</span>
                    {/if}
                </a>
            {/key}
        </div>
    </aside>
{/if}

<style>
.whatsnew {
    width: 100%;
    max-width: 44rem;
    margin: 8px auto 0;
    padding: 0 1rem;
    box-sizing: border-box;
}

/* both crossfading items share one grid cell, so the slot grows to fit its
   content (no fixed height -> no overflow/overlap on narrow screens) */
.wn-slot {
    display: grid;
}

.wn-item {
    grid-area: 1 / 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background-color: var(--color-bg-panel);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-card);
    box-shadow: 0 2px 10px rgba(26, 26, 26, 0.05);
    color: var(--color-text-primary);
    text-decoration: none;
}

.wn-item:hover {
    text-decoration: none;
}

.wn-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
}

.wn-title {
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--color-text-primary);
}

.wn-subtitle {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--color-text-secondary);
}

.wn-cta {
    flex-shrink: 0;
    padding: 7px 14px;
    border-radius: var(--radius-pill);
    background-color: var(--wn-accent);
    color: var(--wn-cta-fg);
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
    transition: transform 0.12s ease;
}

.wn-item:hover .wn-cta {
    transform: scale(1.04);
}

@media (max-width: 540px) {
    .wn-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .wn-cta,
    .wn-item:hover .wn-cta {
        transition: none;
        transform: none;
    }
}
</style>
