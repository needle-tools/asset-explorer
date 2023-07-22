<script>
	import Header from './Header.svelte';
	// import NeedleEngine from './NeedleEngine.svelte';
	import './styles.css';

	// import { fileStore } from "./models/fileStore";

</script>

<div class="app">
	<Header />

	<main>
		<slot />
		<!--
		<div class="models">
			<NeedleEngine src={$fileStore.prev} />
			<NeedleEngine src={$fileStore.current} />
			<NeedleEngine src={$fileStore.next} />
		</div>
		-->
	</main>

	<footer>
		<p>made by <a href="https://needle.tools">needle</a></p>
	</footer>
</div>

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
