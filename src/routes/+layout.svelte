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
		<p>
			Made by <a href="https://needle.tools" target="_blank">Needle</a>
			and
			<a href="https://prefrontalcortex.de" target="_blank">
				prefrontal cortex
			</a>
		</p>
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
		padding: 12px;
	}

	footer a {
		font-weight: bold;
	}

	@media (min-width: 480px) {
		footer {
			padding: 12px 0;
		}
	}
</style>
