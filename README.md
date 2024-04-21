# Asset Explorer

## What's this?

This page contains glTF models and their USDZ counterparts. As conversion and USDZ rendering are still very much application dependant, multiple conversions of the same glTF file are provided.

Currently, conversions are done with the needle-tools/three.js fork r154.1 and Blender 3.6. Please note that while conversions are checked for file integrity (they pass usdchecker), they are not checked for correctness – more likely then not, conversions won't be perfect. That's part of why this project exists! 

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

## Current Status

Currently, only files from the glTF-Sample-Models repository are displayed. 
Soon, this will switch over to the newer glTF-Sample-Assets repository.  
Additionally, the plan is to include other sources like USD-WG/assets.  

Linking out to tools like [gltf.report](https://gltf.report) would be nice to have.  
An embedded viewer with drag-drop capabilities would also be nice to have.  

### Known Issues – Conversions

Conversions to USDZ are currently done with
- three.js r154, needle-tools' fork (supports hierarchy and animations)
- Blender 3.6
- guc 0.4

The idea is to re-run conversions when these tools improve in a meaningful way to reflect the current state of the art.  
Blender 4.x will likely drastically improve the USD support of Blender, and conversions will be redone at that point.  

### Known Issues – USD Web Viewer

The USD Web Viewer has a very limited set of capabilities when it comes to displaying files. Mainly, the three.js Hydra delegate is _very_ incomplete. The following features are **not** supported:  
- skinned meshes
- some texture formats and ways of referencing them
- some material formats and ways how textures are referenced and used
- blend shapes
- vertex colors

Generally, USD support is very spotty across the USD ecosystem; always test what USD version / schemas / feature sets your particular target viewer(s) support. 

## Source Files

- This page: <a href="https://github.com/needle-tools/asset-explorer" target="_blank">needle-tools/asset-explorer</a>  
- The glTF sample models: <a href="https://github.com/KhronosGroup/glTF-Sample-Models" target="_blank">KhronosGroup/glTF-Sample-Models</a>  
- Generated model files: conversions branch on <a href="https://github.com/needle-tools/glTF-Sample-Models/tree/conversions/2.0" target="_blank">needle-tools/glTF-Sample-Models</a>  
- The USD Working Group assets repository: <a href="https://github.com/usd-wg/assets/" target="_blank">usd-wg/assets</a>  

## Reach out

There's more to do! Roundtrips between conversion tools, improvements to existing converters, better visibility into USDZ features, integrating Autodesk' USD viewer directly, integrating "model" and "model-viewer" as alternative display options, ...  

Feel free to <a href="mailto:felix@needle.tools">contact us</a>!