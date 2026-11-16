<script>
	import Header from "./Header.svelte";
	import WhatsNew from "$lib/WhatsNew.svelte";
	import "./styles.css";
</script>

<div class="app">
	<Header />

	<main>
		<slot />
	</main>

	<WhatsNew />

	<footer>
		<nav class="footer-links" aria-label="Needle links">
			<a href="https://needle.tools" target="_blank" rel="noopener">needle.tools</a>
			<a href="https://cloud.needle.tools" target="_blank" rel="noopener">Needle Cloud</a>
			<a href="https://usd-viewer.needle.tools" target="_blank" rel="noopener">USD Viewer</a>
			<a href="mailto:hi@needle.tools">Contact</a>
		</nav>
	</footer>
</div>

<svelte:head>
	<script
		src="https://analytics-2.needle.tools/api/script.js"
		data-site-id="f66265d727f4"
		defer
	></script>
</svelte:head>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 24px 24px 0;
        max-width: 1520px;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
        display: flex;
        justify-content: center;
        padding: 12px 16px;
        margin-top: 24px;
        color: var(--color-text-secondary);
    }

    .footer-links {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 4px 16px;
        font-size: 11px;
        line-height: 1.4;
    }

    footer a {
        color: inherit;
        font-weight: 400;
    }
</style>
