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
					href="{base}/"
				>
					<img
						src="{base}/needle-logo-black.svg"
						alt="Needle"
						class="needle-logo"
					/>
				</a>
			</li>
			<li class="app-wordmark">
				<span>Asset Explorer</span>
			</li>
			<li
				aria-current={$page.url.pathname === base + "/"
					? "page"
					: undefined}
			>
				<a href="{base}/">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10" />
						<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
					</svg>
					<span>Explore</span>
				</a>
			</li>
			<li
				aria-current={$page.url.pathname === base + "/about"
					? "page"
					: undefined}
			>
				<a href="{base}/about">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
					<span>About</span>
				</a>
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
		position: sticky;
		top: 10px;
		z-index: 50;
		/* only the pill should capture clicks; transparent sides stay click-through */
		pointer-events: none;
	}

	nav {
		display: flex;
		justify-content: center;
		pointer-events: auto;
	}

	ul {
		position: relative;
		margin: 0;
		height: 3em;
		display: flex;
		justify-content: center;
		align-items: center;
		list-style: none;
		background: var(--color-bg-panel);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-pill);
		padding: 0 10px;
		box-shadow: 0 1px 2px rgba(26, 26, 26, 0.04);
	}

	li {
		position: relative;
		height: 100%;
	}

	nav a {
		color: var(--color-text-primary);
	}

	nav a:hover {
		color: var(--color-green-dark);
		text-decoration: none;
	}

	li[aria-current="page"] {
		font-weight: 800;
	}

	li[aria-current="page"] a {
		color: var(--color-green-dark);
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
		gap: 6px;
		padding: 0 0.7rem;
		text-decoration: none;
	}

	.nav-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.logo {
		width: 120px;
		margin-right: 0.35rem;
	}

	.needle-logo {
		display: block;
		width: 100%;
		height: auto;
	}

	.app-wordmark {
		display: flex;
		align-items: center;
		padding: 0 0.85rem 0 0.25rem;
		white-space: nowrap;    
		font-weight: 200;
		font-size: 1.45rem;
		margin-left: -10px;
		color: #4f4f4f;
	}

	@media (max-width: 560px) {
		.app-wordmark {
			display: none;
		}
	}
</style>
