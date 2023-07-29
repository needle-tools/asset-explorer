# Asset Explorer

## Howto

This is currently quite hacky. Vanilla three doesn't run on node.
To run file conversion,
- open dynamicFiles.ts
- set the various "generate" flags at the top to true
- npm link /path/to/three/on/the/hacky/branch
- (optional) adjust the file slicing in dynamicFiles.ts to e.g. only test with a few
- npm run dev
- this will generate files. However, settings aren't good for actually using the server; local three doesn't work for some reason.

## TODO Hacks

- would be nice not having to hack three for nodejs support
    - could probably mock ImageBitmapLoader instead of ImageLoader, maybe even from the outside
- currently can't import the better USDZExporter from needle-tools/engine (same problems running in node)
    - copied it here but better would be one codecase

## Goals

- allow for multiple submodules and structure callbacks for each of them (where to find files and readmes)
    - khronos/gltf-sample-models
    - usd-wg/assets
    - needle/test-assets
- allow generating new files from existing ones
    - GLB to USDZ with three
    - GLB to USDZ with Blender
    - GLB to USDZ with Omniverse
    - GLB to USDZ with Reality Converter
    - USDZ to GLB with three (*for the files generated with three)
    - USDZ to GLB with Blender
    - USDZ to GLB with Omniverse
    - Screenshots from GLB
    - Screenshots from USDZ
- allow to see at a glance what the source format is
    - usdz or gltf
- allow to see what features a file has
    - gltf-transform for gltf
    - usdview for usdz
- switch between files and renderers
    - files are GLB or USDZ; there may be multiple versions (e.g. GLB and roundtrip GLB, or GLB and 3 different USDZ conversions)
    - renderers can show GLB (needle-engine, model-viewer), USDZ (Autodesk), or both (model)
    - e.g. show glTF with needle-engine or model-viewer or model
    - show USDZ with model or Autodesk's render delegate

## TODO Structure

- models
    - glTF-sample-models // model source
          README.md
        - Avocado // model name
            - Avocado.glb
            - Avocado.glb.png
            - README.md
            - Avocado.glb.three.usdz
            - Avocado.glb.three.usdz.png
            - Avocado.glb.three.usdz.three.glb
            - Avocado.glb.three.usdz.three.glb.png
            - Avocado.glb.three.usdz.blender.glb
            - Avocado.glb.three.usdz.blender.glb.png
            - Avocado.glb.blender.usdz
            - Avocado.glb.blender.usdz.png
            - Avocado.glb.blender.usdz.blender.glb
            - Avocado.glb.blender.usdz.blender.glb.png
            - Avocado.glb.omniverse.usdz
            - Avocado.glb.omniverse.usdz.png
            - Avocado.glb.three.glb
            - Avocado.glb.three.glb.png
    - usd-wg-assets
- submodules
    - gltf-sample-models
    - usd-wg-assets
    - needle-test-assets