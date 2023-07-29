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
        <source src={data.downloadUri.replace(".glb", ".glb.three.usdz")} type="model/vnd.usdz+zip" />
    </model>
    -->
    
    <div class="info">
        <h2 class="info-header">Information and Downloads</h2>
        <ModelTags tags={data.info} />
        
        <ul class="download-links">
            <li>
                <a href={data.downloadUri} download>
                    <img src={data.previewUri} alt="screenshot from source"/>
                    <span>Download GLB</span>
                    <span class="file-description">Original File</span>
                </a>
            </li>
            <li>
                <a rel="ar" href={data.downloadUri.replace(".glb", ".glb.three.usdz")} download>
                    <img src={data.downloadUri.replace(".glb", ".glb.three.png")} alt="screenshot from three.js conversion"/>
                    <span>Download USDZ</span>
                    <span class="file-description">Converted with three.js</span>
                </a>
            </li>
            <li>
                <a rel="ar" href={data.downloadUri.replace(".glb", ".glb.blender.usdz")} download>
                    <img src={data.downloadUri.replace(".glb", ".glb.blender.png")} alt="screenshot from blender conversion"/>
                    <span>Download USDZ</span>
                    <span class="file-description">Converted with Blender</span>
                </a>
            </li>
        </ul>
    </div>

    <div class="info">
        <h2 class="info-header">Description</h2>
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

.info-header {
    text-align: center;
    opacity: 0.7;
}

.file-description {
    color:grey;
    font-size: 0.8rem;
}

.download-links {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    padding: 0;
}

.download-links li {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 10px;
}

.download-links li a {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.download-links img {
    max-width: 200px;
    max-height: 200px;
}

:global(.info img) {
    max-width: 100%;
}
</style>