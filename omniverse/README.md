## Kit Location

Installed apps contain a subfolder that symlinks to kit:  
`C:\Users\herbst\AppData\Local\ov\pkg\code-2023.1.1\kit`

The actual folder is in ov/pkg/deps:  
`C:\Users\herbst\AppData\Local\ov\pkg\deps\b0731af547a6ff5e8594b78c61f3ca82` 

## Example Command

```bash
/path/to/kit.exe --enable omni.kit.asset_converter --exec "/path/to/convert_to_usdz.py glTF-Sample-Models/2.0/2CylinderEngine/glTF/2CylinderEngine.gltf glTF-Sample-Models/2.0/2CylinderEngine/usdz/2CylinderEngine.glb.ov.usdz"
```

```bash
C:\Users\herbst\AppData\Local\ov\pkg\code-2023.1.1\kit --enable omni.kit.asset_converter --exec "omniverse/convert_to_usdz.py submodules\glTF-Sample-Models\2.0\AntiqueCamera\glTF-Binary\AntiqueCamera.glb submodules\glTF-Sample-Models\2.0\AntiqueCamera\glTF-Binary\AntiqueCamera.glb.ov.usdz"
```