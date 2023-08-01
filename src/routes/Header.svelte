<script>
	import { page } from '$app/stores';
	import { base } from '$app/paths';
</script>

<header>
	<div class="corner">
		<!--
		<a href="https://kit.svelte.dev">
			<img src={logo} alt="SvelteKit" />
		</a>
		-->
	</div>

	<nav>
		<ul>
			<li aria-current={$page.url.pathname === base + '/' ? 'page' : undefined}>
				<a href="{base}/">Explore</a>
			</li>
			<li aria-current={$page.url.pathname === base + '/about' ? 'page' : undefined}>
				<a href="{base}/about">About</a>
			</li>
			<!--
			<li aria-current={$page.url.pathname === base + '/models' ? 'page' : undefined}>
				<a href="{base}/models">Models</a>
			</li>
			-->
		</ul>
	</nav>

	<div class="corner">
		<!--
		<a href="https://github.com/sveltejs/kit">
			<img src={github} alt="GitHub" />
		</a>
		-->
	</div>
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
	}

	.corner {
		width: 3em;
		height: 3em;
	}

	nav {
		display: flex;
		justify-content: center;
	}

	ul {
		position: relative;
		margin: 0;
		height: 3em;
		display: flex;
		justify-content: center;
		align-items: center;
		list-style: none;
		background: var(--color-bg-0);
		background-size: contain;
		border-radius: 30px;
		padding: 0 10px;
	}

	li {
		position: relative;
		height: 100%;
	}

	li[aria-current='page'] {
		font-weight: bold;
	}

	/*
	li[aria-current='page']::before {
		--size: 6px;
		content: '';
		width: 0;
		height: 0;
		position: absolute;
		top: 0;
		left: calc(50% - var(--size));
		border: var(--size) solid transparent;
		border-top: var(--size) solid var(--color-theme-1);
	}
	*/

	nav a {
		display: flex;
		height: 100%;
		align-items: center;
		padding: 0 0.5rem;
		text-decoration: none;
	}
</style>
