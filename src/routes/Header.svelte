<script>
	import { page } from "$app/stores";
	import { base } from "$app/paths";
</script>

<header>
	<div class="spacer"></div>
	<nav>
		<ul>
			<li>
				<a
					class="logo"
					href="https://needle.tools"
					target="_blank"
				>
					<img
						src="needle-logo-black.svg"
						alt="Needle"
						class="needle-logo"
					/>
				</a>
			</li>
			<li
				aria-current={$page.url.pathname === base + "/"
					? "page"
					: undefined}
			>
				<a href="{base}/">Explore</a>
			</li>
			<li
				aria-current={$page.url.pathname === base + "/about"
					? "page"
					: undefined}
			>
				<a href="{base}/about">About</a>
			</li>
			<!--
			<li aria-current={$page.url.pathname === base + '/models' ? 'page' : undefined}>
				<a href="{base}/models">Models</a>
			</li>
			-->
		</ul>
	</nav>
	<div class="spacer"></div>
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
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

	li[aria-current="page"] {
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

	.logo {
		width: 120px;
		margin-right: 1rem;
	}
</style>
