<script lang="ts">
import NeedleEngine from "../../NeedleEngine.svelte";

export let data;

function readableBytes(bytes: number) {
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
        (bytes / Math.pow(1024, i)).toFixed(2) +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    );
}

</script>

<div class="text-column">
    <div class="info">
        <h1><a href={data.uri}>{data.name}</a></h1>
        <h2>Size: {readableBytes(data.size)}</h2>
        <a href={data.downloadUri}>Download</a>
    </div>
    <NeedleEngine src={data.downloadUri} />
    <div class="info">
        {@html data.readme} 
    </div>
</div>

<style>
.text-column {
    background-color: white;
    border: 1px solid black;
    border-radius: 10px;
    margin: 20px;
    /* overflow: hidden; */
}

.info {
    padding: 10px;
}
</style>