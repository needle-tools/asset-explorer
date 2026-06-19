<script>
	import Header from "./Header.svelte";
	import "./styles.css";
</script>

<div class="app">
	<Header />

	<main>
		<slot />
	</main>

	<footer>
		<p class="made-by">
			Made by <a href="https://needle.tools" target="_blank" rel="noopener">Needle</a>
		</p>
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
		padding: 1rem;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 6px;
		padding: 24px 12px;
		margin-top: 16px;
		border-top: 1px solid var(--color-border-subtle);
	}

	.made-by {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}

	footer a {
		font-weight: 700;
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 8px 18px;
		font-size: 0.85rem;
	}

	@media (min-width: 480px) {
		footer {
			padding: 24px 0;
		}
	}
</style>
