<script lang="ts">
    import { base } from "$app/paths";
    import { browser } from "$app/environment";
    import { page } from "$app/stores";

import Tag from "./Tag.svelte";

export let tags: any;
export let filter: string | null = null;
export let includeFilters: string[] = filter ? [filter] : [];
export let excludeFilters: string[] = [];
export let ignoreTags: string[] = [];
export let ignoreValuesForTags: string[] = [];

$: currentSearch = browser ? $page.url.search : "";

function setList(params: URLSearchParams, name: string, values: string[]) {
    params.delete(name);
    for (const value of values) params.append(name, value);
}

function tagHref(search: string, info: string, exclude = false) {
    const params = new URLSearchParams(search);
    const includes = params.getAll("tag");
    const excludes = params.getAll("notTag");
    const includeSet = new Set(includes);
    const excludeSet = new Set(excludes);

    if (exclude) {
        includeSet.delete(info);
        if (excludeSet.has(info)) excludeSet.delete(info);
        else excludeSet.add(info);
    }
    else if (includeSet.has(info) || excludeSet.has(info)) {
        includeSet.delete(info);
        excludeSet.delete(info);
    }
    else {
        includeSet.add(info);
        excludeSet.delete(info);
    }

    setList(params, "tag", [...includeSet]);
    setList(params, "notTag", [...excludeSet]);
    params.delete("category");

    const query = params.toString();
    return query ? `${base}/?${query}` : `${base}/`;
}

</script>

<script context="module" lang="ts">

export function showInfo(array: any, key: string) {
    if (key === "scenes") // special case, 1 scene is normal
        return array[key] > 1;
    return array[key];
}

</script>

<ul class="extensions">
    {#each Object.keys(tags).filter(x => ignoreTags.indexOf(x) < 0)  as info}
        {#if showInfo(tags, info)}
            <Tag
                href={tagHref(currentSearch, info)}
                excludeHref={tagHref(currentSearch, info, true)}
                selected={includeFilters.includes(info)}
                excluded={excludeFilters.includes(info)}
                name={info}
                value={tags[info]}
                showValue={ignoreValuesForTags.indexOf(info) < 0}
                />
        {/if}
    {/each}
</ul>

<style>

ul {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    justify-content: flex-start;
    margin: 0px -7px;
}

</style>
