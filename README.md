# Asset Explorer

## What's this?

Asset Explorer is a public test gallery for glTF assets and their USDZ conversions. It lets you compare source files, converted files, preview renders, metadata, and converter provenance across a broad set of real-world 3D assets.

It is built by [Needle](https://needle.tools), the team behind [Needle Engine](https://needle.tools). We care deeply about high-quality 3D file interoperability, and we are very active in the 3D open source ecosystem around glTF, OpenUSD, FBX, MaterialX, three.js, and related tooling.

Conversions and renderings are intentionally shown side by side because 3D interchange is still application-dependent. A file can pass validation and still lose materials, animation, hierarchy, metadata, or rendering intent. That's part of why this project exists: it gives implementers a practical place to see what survives a conversion and where the ecosystem still needs work.

## Why

File interoperability is hard. It's getting easier though – modern formats like glTF and USD bring great features and capabilities to the table.  
Currently, the 3D world is split: glTF is often used for realtime pipelines, while USD is often used for film productions. However, these worlds start to merge; and so do the capabilities of these formats.  

Thus, it becomes more important that there are good test files, both for these formats as well as for conversions between them.  

This page is targeted at implementers, developers, and designers working with these file formats.  
A clear goal is to allow you to download files for a specific usecase and check if your target viewer/platform supports what you want it to support.  

## How to use this page

- find assets with particular features (e.g. blend shapes)
- present assets in fullscreen or AR
- download assets for testing (glTF, USDZ)
- check that your software properly supports glTF and USDZ
- check that your conversion tools produce proper files

## Source Files

- This page: <a href="https://github.com/needle-tools/asset-explorer" target="_blank">needle-tools/asset-explorer</a>  
- The glTF sample assets: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets" target="_blank">KhronosGroup/glTF-Sample-Assets</a>
- Generated USDZ conversions and preview renders live next to the assets they were produced from, with provenance metadata for the converter family and version.

## Contributing

Have a new converter, renderer, test asset, or interoperability case we should cover? Are you working on glTF, OpenUSD, FBX, MaterialX, three.js, or another part of the 3D toolchain and want to compare output here?

Please <a href="mailto:hi@needle.tools">reach out to us</a>. We are happy to collaborate on useful test cases, better conversion coverage, and clearer ways to show what data survives across tools.
