<svelte:head>
	<title>About</title>
	<meta name="description" content="About this app" />
</svelte:head>

<div class="text-column">
	<h1>Asset Explorer</h1>

	<h2>What is this?</h2>
	<p>This page contains glTF models and their USDZ counterparts. As conversion and USDZ rendering are still very much application dependant, multiple conversions of the same glTF file are provided.</p>
	<p>Currently, conversions are done with the needle-tools/three.js fork r154.1 and Blender 3.6.</p>

	<h2>Why</h2>
	<p>
		File interoperability is hard. It's getting easier though – modern formats like glTF and USD bring great features and capabilities to the table.  
		Currently, the 3D world is split: glTF is often used for realtime pipelines, while USD is often used for film productions. However, these worlds start to merge; and so do the capabilities of these formats.
	</p>
	<p>
		Thus, it becomes more important that there are good test files, both for these formats as well as for conversions between them.
	</p>
	<p>
		This page is targeted at implementers, developers, and designers working with these file formats.
		A clear goal is to allow you to download files for a specific usecase and check if your target viewer/platform supports what you want it to support.
	</p>

	<h2>Source Files</h2>
	<p>This page: <a href="https://github.com/needle-tools/asset-explorer" target="_blank">needle-tools/asset-explorer</a></p>
	<p>The glTF sample models: <a href="https://github.com/KhronosGroup/glTF-Sample-Models" target="_blank">KhronosGroup/glTF-Sample-Models</a></p>
	<p>Generated model files: conversions branch on <a href="https://github.com/needle-tools/glTF-Sample-Models/tree/conversions/2.0" target="_blank">needle-tools/glTF-Sample-Models</a></p>
	<p>The USD Working Group assets repository: <a href="https://github.com/usd-wg/assets/" target="_blank">usd-wg/assets</a></p>

	<h2>Reach out</h2>
	<p>
		There's more to do! Roundtrips between conversion tools, improvements to existing converters, better visibility into USDZ features, integrating Autodesk' USD viewer directly, integrating "model" and "model-viewer" as alternative display options, ...
		Feel free to <a href="mailto:felix@needle.tools">contact us</a>!
	</p>
</div>

<style>
	p {
		margin: 0;
		margin-bottom: 0.4em;
	}
</style>