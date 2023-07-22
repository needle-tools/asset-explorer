<script>
export let data;
</script>

<svelte:head>
	<title>Model Overview</title>
	<meta name="description" content="About this app" />
</svelte:head>

<ul>
    {#each data.models as model}
        <li>
            <a href="/models/{model.slug}">
                <img src="{model.thumbnail}" alt="{model.name}" />
                <span>{model.name}</span>
            </a>
        </li>
    {/each}
</ul>

<style>
    :root {
        --size: 160px;
    }

    a {
        text-decoration: none;
        color: black;
        display: flex;
        flex-direction: column; 
        max-width: var(--size);
        transition: transform 0.2s ease-in-out, background-color 0.2s linear, margin 0.2s linear, padding 0.2s linear;
        font-size: 1rem;
        padding: 5px;
        margin: 0px;  
    }

    span {
    }

    ul {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        justify-content: space-evenly;
    }

    li {
        list-style-type: none;
    }
    
    img {
        width: var(--size);
        height: var(--size);
        object-fit: contain;
    }

    a:hover {
        transform: scale(1.05);
        background-color: white;
        padding: 10px;
        margin: -5px;
        border-radius: 10px;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
        z-index: 10;
    }
</style>