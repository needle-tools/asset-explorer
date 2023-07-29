# Asset Explorer

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
            Avocado.glb
            Avocado.glb.png
            README.md
        -   three-usdz // conversion step
            - Avocado.glb.three.usdz
            - Avocado.glb.three.usdz.png
            - three-glb // conversion step
                - Avocado.glb.three.usdz.three.glb
                - Avocado.glb.three.usdz.three.glb.png
            - blender-glb
                - Avocado.glb.three.usdz.blender.glb
                - Avocado.glb.three.usdz.blender.glb.png
        -   blender-usdz
            - Avocado.glb.blender.usdz
            - Avocado.glb.blender.usdz.png
            - blender-glb
                - Avocado.glb.blender.usdz.blender.glb
                - Avocado.glb.blender.usdz.blender.glb.png
        -   omniverse-usdz
            - Avocado.glb.omniverse.usdz
            - Avocado.glb.omniverse.usdz.png
        - three-glb
            - Avocado.glb.three.glb
            - Avocado.glb.three.glb.png
    - usd-wg-assets
- submodules
    - gltf-sample-models
    - usd-wg-assets
    - needle-test-assets