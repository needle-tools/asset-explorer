<script lang="ts">
import NeedleEngine from "../../NeedleEngine.svelte";
import ModelTags from "../ModelTags.svelte";

export let data;

function readableBytes(bytes: number) {
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
        (bytes / Math.pow(1024, i)).toFixed(2) +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    );
}

$: {
    // add more info
    data.info.fileSize = readableBytes(data.size);
}

</script>

<div class="text-column">
    <NeedleEngine src={data.downloadUri} />
    <!--
    <model>
        <source src={data.downloadUri + ".blender.usdz"} type="model/vnd.usdz+zip" />
    </model>
    -->
    <div class="info">
        <ModelTags tags={data.info} />
        <a href={data.downloadUri} download>Download .glb</a>
        <a href={data.downloadUri.replace(".glb", ".glb.three.usdz")} download>Download three .usdz</a>
        <a href={data.downloadUri.replace(".glb", ".glb.blender.usdz")} download>Download blender .usdz</a>
    </div>

    <div class="info">
        <img src={data.downloadUri.replace(".glb", ".glb.three.png")} alt="screenshot from three.js conversion"/>
        <img src={data.downloadUri.replace(".glb", ".glb.blender.png")} alt="screenshot from blender conversion"/>
        {@html data.readme} 
    </div>
</div>

<style>
.text-column {
    margin: 20px;
    /* overflow: hidden; */
}

.info {
    padding: 10px;
    background-color: white;
    border-radius: 10px;
    box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
    margin: 10px;
}

:global(.info img) {
    max-width: 100%;
}
</style>