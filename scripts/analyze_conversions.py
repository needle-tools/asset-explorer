#!/usr/bin/env python3

import argparse
import base64
import json
import os
import pathlib
import shutil
import struct

from pxr import Ar, Sdf, Usd, UsdGeom, UsdLux, UsdShade, UsdSkel


ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
SAMPLE_ASSETS_DIR = ROOT_DIR / "submodules" / "glTF-Sample-Assets"
LEGACY_MODELS_DIR = ROOT_DIR / "submodules" / "glTF-Sample-Models"
SOURCE_DIR = SAMPLE_ASSETS_DIR if (SAMPLE_ASSETS_DIR / "Models").exists() else LEGACY_MODELS_DIR
SOURCE_SUBFOLDER = "Models" if SOURCE_DIR == SAMPLE_ASSETS_DIR else "2.0"
PROVENANCE_PATH = SOURCE_DIR / "conversion-provenance.json"
ANALYSIS_DIR = SOURCE_DIR / "conversion-analysis"
ANALYSIS_INDEX_PATH = ANALYSIS_DIR / "index.json"
LEGACY_ANALYSIS_PATH = ROOT_DIR / "conversion-analysis.json"
LEGACY_ANALYSIS_DIR = ROOT_DIR / "conversion-analysis"


MATERIAL_FEATURE_COMPATIBILITY = {
    "baseColorTexture": ["diffuseColor", "textureFile"],
    "metallicRoughnessTexture": ["metallic", "roughness", "textureFile"],
    "normalTexture": ["normal", "textureFile"],
    "occlusionTexture": ["occlusion", "textureFile"],
    "emissiveTexture": ["emissiveColor", "textureFile"],
    "alphaMask": ["opacity"],
    "alphaBlend": ["opacity"],
    "KHR_materials_clearcoat": ["clearcoat"],
    "KHR_materials_ior": ["ior"],
    "KHR_materials_transmission": ["transmission"],
    "KHR_materials_specular": ["specular"],
    "KHR_materials_sheen": ["sheen"],
    "KHR_materials_anisotropy": ["anisotropy"],
    "KHR_materials_iridescence": ["iridescence"],
}

USD_MATERIAL_INPUT_FEATURES = {
    "diffuseColor",
    "emissiveColor",
    "opacity",
    "metallic",
    "roughness",
    "normal",
    "occlusion",
    "clearcoat",
    "ior",
    "transmission",
    "specular",
    "sheen",
    "anisotropy",
    "iridescence",
}


def normalize(path):
    return pathlib.Path(path).resolve().as_posix()


def analysis_file_name(slug):
    return slug + ".json"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--filter")
    parser.add_argument("--limit", type=int)
    return parser.parse_args()


def discover_assets(filter_name=None, limit=None):
    search_root = SOURCE_DIR / SOURCE_SUBFOLDER
    files = sorted(search_root.glob("**/glTF-Binary/*.glb"))
    if not files:
        files = sorted(search_root.glob("**/*.glb"))

    exclusions = {"2CylinderEngine", "GearboxAssy", "ReciprocatingSaw", "Buggy"}
    files = [file for file in files if file.stem not in exclusions]
    if filter_name:
        files = [file for file in files if file.stem == filter_name]
    if limit:
        files = files[:limit]
    return files


def read_glb(file):
    data = file.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"Not a GLB: {file}")

    offset = 12
    gltf_json = None
    binary = None
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<I4s", data, offset)
        chunk = data[offset + 8:offset + 8 + length]
        if chunk_type == b"JSON":
            gltf_json = json.loads(chunk.decode("utf8"))
        elif chunk_type == b"BIN\0":
            binary = chunk
        offset += 8 + length

    if gltf_json is None:
        raise ValueError(f"GLB has no JSON chunk: {file}")
    return gltf_json, binary


def image_info(data, mime_type=""):
    if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return {"width": struct.unpack(">I", data[16:20])[0], "height": struct.unpack(">I", data[20:24])[0], "type": "png"}

    if len(data) >= 10 and data[0:2] == b"\xff\xd8":
        offset = 2
        while offset + 9 < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            length = struct.unpack(">H", data[offset + 2:offset + 4])[0]
            if length < 2:
                break
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                return {"width": struct.unpack(">H", data[offset + 7:offset + 9])[0], "height": struct.unpack(">H", data[offset + 5:offset + 7])[0], "type": "jpeg"}
            offset += 2 + length

    if len(data) >= 30 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        chunk_type = data[12:16]
        if chunk_type == b"VP8X":
            width = 1 + int.from_bytes(data[24:27], "little")
            height = 1 + int.from_bytes(data[27:30], "little")
            return {"width": width, "height": height, "type": "webp"}
        if chunk_type == b"VP8 ":
            width = struct.unpack("<H", data[26:28])[0] & 0x3FFF
            height = struct.unpack("<H", data[28:30])[0] & 0x3FFF
            return {"width": width, "height": height, "type": "webp"}

    return {"width": None, "height": None, "type": mime_type or "unknown"}


def summarize_texture_images(images):
    total_pixels = 0
    known_dimensions = 0
    max_width = 0
    max_height = 0
    for image in images:
        width = image.get("width")
        height = image.get("height")
        if isinstance(width, int) and isinstance(height, int):
            known_dimensions += 1
            total_pixels += width * height
            max_width = max(max_width, width)
            max_height = max(max_height, height)

    return {
        "count": len(images),
        "knownDimensions": known_dimensions,
        "totalPixels": total_pixels,
        "totalBytes": sum(image.get("size", 0) for image in images),
        "maxWidth": max_width,
        "maxHeight": max_height,
    }


def summarize_usd_texture_assets(assets):
    return {
        "count": len(assets),
        "knownDimensions": 0,
        "totalPixels": None,
        "totalBytes": sum(asset.get("size", 0) for asset in assets),
        "maxWidth": None,
        "maxHeight": None,
    }


def source_feature_analysis(file):
    gltf_json, binary = read_glb(file)
    images = []

    for index, image in enumerate(gltf_json.get("images", [])):
        data = None
        if "bufferView" in image and binary is not None:
            view = gltf_json.get("bufferViews", [])[image["bufferView"]]
            start = view.get("byteOffset", 0)
            data = binary[start:start + view["byteLength"]]
        elif isinstance(image.get("uri"), str) and image["uri"].startswith("data:"):
            data = base64.b64decode(image["uri"].split(",", 1)[1])

        dimensions = image_info(data, image.get("mimeType")) if data else {"width": None, "height": None, "type": image.get("mimeType", "external")}
        images.append({"index": index, "size": len(data) if data else 0, **dimensions})

    primitives = [primitive for mesh in gltf_json.get("meshes", []) for primitive in mesh.get("primitives", [])]
    material_features = set()
    for material in gltf_json.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr:
            material_features.add("baseColorTexture")
        if "metallicRoughnessTexture" in pbr:
            material_features.add("metallicRoughnessTexture")
        if "normalTexture" in material:
            material_features.add("normalTexture")
        if "occlusionTexture" in material:
            material_features.add("occlusionTexture")
        if "emissiveTexture" in material:
            material_features.add("emissiveTexture")
        if material.get("alphaMode") == "MASK":
            material_features.add("alphaMask")
        if material.get("alphaMode") == "BLEND":
            material_features.add("alphaBlend")
        material_features.update(material.get("extensions", {}).keys())

    punctual_lights = gltf_json.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", [])
    texture_images = summarize_texture_images(images)
    return {
        "kind": "gltf",
        "file": normalize(file),
        "counts": {
            "scenes": len(gltf_json.get("scenes", [])),
            "nodes": len(gltf_json.get("nodes", [])),
            "meshes": len(gltf_json.get("meshes", [])),
            "primitives": len(primitives),
            "materials": len(gltf_json.get("materials", [])),
            "textures": len(gltf_json.get("textures", [])),
            "images": len(images),
            "cameras": len(gltf_json.get("cameras", [])),
            "lights": len(punctual_lights),
            "skins": len(gltf_json.get("skins", [])),
            "animations": len(gltf_json.get("animations", [])),
            "animationChannels": sum(len(animation.get("channels", [])) for animation in gltf_json.get("animations", [])),
            "morphTargetPrimitives": sum(1 for primitive in primitives if len(primitive.get("targets", [])) > 0),
            "variants": len(gltf_json.get("extensions", {}).get("KHR_materials_variants", {}).get("variants", [])),
        },
        "materialFeatures": sorted(material_features),
        "extensionsUsed": sorted(gltf_json.get("extensionsUsed", [])),
        "textureImages": texture_images,
    }


def is_light(prim):
    return (
        prim.IsA(UsdLux.BoundableLightBase)
        or prim.IsA(UsdLux.NonboundableLightBase)
        or prim.HasAPI(UsdLux.LightAPI)
        or prim.GetTypeName().endswith("Light")
    )


def authored_or_connected(shader_input):
    if shader_input.GetAttr().HasAuthoredValueOpinion():
        return True
    if shader_input.HasConnectedSource():
        return True
    sources, _invalid_paths = shader_input.GetConnectedSources()
    return bool(sources)


def resolve_texture_assets(stage, authored_texture_assets):
    resolver = Ar.GetResolver()
    root_identifier = stage.GetRootLayer().identifier
    assets = []
    seen = set()

    for authored_path in sorted(path for path in authored_texture_assets if path):
        normalized_authored_path = authored_path[2:] if authored_path.startswith("./") else authored_path
        package_path = normalized_authored_path
        if not Ar.IsPackageRelativePath(package_path) and not pathlib.PurePosixPath(package_path).is_absolute():
            package_path = Ar.JoinPackageRelativePath(root_identifier, normalized_authored_path)

        resolved_path = resolver.Resolve(package_path)
        if not resolved_path:
            assets.append({
                "path": authored_path,
                "resolvedPath": "",
                "size": 0,
                "width": None,
                "height": None,
            })
            continue

        resolved_key = str(resolved_path)
        if resolved_key in seen:
            continue
        seen.add(resolved_key)

        asset = resolver.OpenAsset(resolved_path)
        assets.append({
            "path": authored_path,
            "resolvedPath": resolved_key,
            "size": asset.GetSize() if asset else 0,
            "width": None,
            "height": None,
        })

    return assets


def usd_feature_analysis(usdz_file):
    stage = Usd.Stage.Open(str(usdz_file))
    if stage is None:
        raise RuntimeError(f"Could not open USD stage: {usdz_file}")

    counts = {
        "scenes": 1,
        "nodes": 0,
        "meshes": 0,
        "primitives": 0,
        "materials": 0,
        "textures": 0,
        "images": 0,
        "cameras": 0,
        "lights": 0,
        "skins": 0,
        "animations": 0,
        "animationChannels": 0,
        "morphTargetPrimitives": 0,
        "variants": 0,
    }
    material_features = set()
    authored_texture_assets = set()
    skel_prims = 0
    animated_attributes = 0
    skel_animation_prims = 0

    for prim in stage.Traverse():
        if not prim.IsActive():
            continue
        counts["nodes"] += 1
        counts["variants"] += len(prim.GetVariantSets().GetNames())

        if prim.IsA(UsdGeom.Mesh):
            counts["meshes"] += 1
            counts["primitives"] += 1
            mesh = UsdGeom.Mesh(prim)
            blend_shapes = mesh.GetBlendShapesRel() if hasattr(mesh, "GetBlendShapesRel") else None
            if blend_shapes and blend_shapes.HasAuthoredTargets():
                counts["morphTargetPrimitives"] += 1
        if prim.IsA(UsdShade.Material):
            counts["materials"] += 1
        if prim.IsA(UsdGeom.Camera):
            counts["cameras"] += 1
        if is_light(prim):
            counts["lights"] += 1
        if prim.IsA(UsdSkel.Skeleton) or prim.IsA(UsdSkel.Root) or prim.HasAPI(UsdSkel.BindingAPI):
            skel_prims += 1
        if prim.IsA(UsdSkel.Animation):
            skel_animation_prims += 1

        for attr in prim.GetAttributes():
            if attr.GetNumTimeSamples() > 0:
                animated_attributes += 1

        if prim.IsA(UsdShade.Shader):
            shader = UsdShade.Shader(prim)
            shader_id = shader.GetIdAttr().Get() or ""
            for shader_input in shader.GetInputs():
                if not authored_or_connected(shader_input):
                    continue
                base_name = shader_input.GetBaseName()
                if base_name == "file":
                    value = shader_input.Get()
                    if isinstance(value, Sdf.AssetPath):
                        authored_texture_assets.add(value.path or value.resolvedPath)
                    material_features.add("textureFile")
                elif base_name in USD_MATERIAL_INPUT_FEATURES:
                    material_features.add(base_name)
            if "UVTexture" in shader_id:
                material_features.add("textureFile")

    texture_assets = resolve_texture_assets(stage, authored_texture_assets)
    texture_images = summarize_usd_texture_assets(texture_assets)
    counts["textures"] = texture_images["count"]
    counts["images"] = texture_images["count"]
    counts["skins"] = skel_prims
    counts["animations"] = skel_animation_prims if skel_animation_prims > 0 else (1 if animated_attributes > 0 else 0)
    counts["animationChannels"] = animated_attributes

    package = Sdf.ZipFile.Open(str(usdz_file))

    return {
        "kind": "usd",
        "file": normalize(usdz_file),
        "counts": counts,
        "materialFeatures": sorted(material_features),
        "extensionsUsed": [],
        "textureImages": texture_images,
        "textureAssets": texture_assets,
        "packageEntries": len(package.GetFileNames()) if package else 0,
    }


def count_status(source_value, converted_value):
    if source_value == 0:
        return "absent" if converted_value == 0 else "added"
    if converted_value == 0:
        return "missing"
    if converted_value < source_value:
        return "reduced"
    return "present"


def compare_features(source, conversion):
    count_keys = [
        "meshes",
        "primitives",
        "materials",
        "textures",
        "images",
        "cameras",
        "lights",
        "skins",
        "animations",
        "animationChannels",
        "morphTargetPrimitives",
        "variants",
    ]
    counts = {}
    for key in count_keys:
        source_value = source["counts"].get(key, 0)
        converted_value = conversion["counts"].get(key, 0)
        counts[key] = {
            "source": source_value,
            "converted": converted_value,
            "status": count_status(source_value, converted_value),
        }

    converted_material_features = set(conversion.get("materialFeatures", []))
    material_features = []
    for feature in sorted(source.get("materialFeatures", [])):
        compatible_features = MATERIAL_FEATURE_COMPATIBILITY.get(feature, [feature])
        matched = [compatible for compatible in compatible_features if compatible in converted_material_features]
        material_features.append({
            "feature": feature,
            "compatibleFeatures": compatible_features,
            "matched": matched,
            "status": "present" if matched else "missing",
        })

    source_pixels = source.get("textureImages", {}).get("totalPixels", 0)
    converted_pixels = conversion.get("textureImages", {}).get("totalPixels", 0)
    return {
        "counts": counts,
        "texturePixels": {
            "source": source_pixels,
            "converted": converted_pixels,
            "ratio": converted_pixels / source_pixels if source_pixels > 0 and isinstance(converted_pixels, int) else None,
            "status": "unknown" if source_pixels > 0 and converted_pixels is None else count_status(source_pixels, converted_pixels or 0),
        },
        "materialFeatures": material_features,
        "missingMaterialFeatures": [feature["feature"] for feature in material_features if feature["status"] == "missing"],
    }


def write_index():
    assets = []
    for file in sorted(ANALYSIS_DIR.glob("*.json")):
        if file.name == "index.json":
            continue
        asset = json.loads(file.read_text())
        assets.append({
            "input": asset["input"],
            "slug": asset["slug"],
            "file": file.name,
            "source": {
                "counts": asset["source"].get("counts", {}),
                "materialFeatures": asset["source"].get("materialFeatures", []),
                "extensionsUsed": asset["source"].get("extensionsUsed", []),
                "textureImages": asset["source"].get("textureImages", {}),
            },
            "conversions": [
                {
                    "converter": conversion.get("converter"),
                    "converterVersion": conversion.get("converterVersion"),
                    "usdz": conversion.get("usdz"),
                    "error": conversion.get("error") or conversion.get("features", {}).get("error"),
                    "counts": conversion.get("features", {}).get("counts", {}),
                    "materialFeatures": conversion.get("features", {}).get("materialFeatures", []),
                    "textureImages": conversion.get("features", {}).get("textureImages", {}),
                    "comparison": conversion.get("comparison"),
                }
                for conversion in asset.get("conversions", [])
            ],
        })

    output = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "schemaVersion": 3,
        "analysis": "OpenUSD Python stage traversal",
        "source": {"directory": normalize(SOURCE_DIR)},
        "assets": sorted(assets, key=lambda asset: asset["slug"]),
    }
    ANALYSIS_INDEX_PATH.write_text(json.dumps(output, indent=2) + "\n")


def main():
    args = parse_args()
    provenance = json.loads(PROVENANCE_PATH.read_text())
    ANALYSIS_DIR.mkdir(exist_ok=True)

    if not args.filter and not args.limit:
        for file in ANALYSIS_DIR.glob("*.json"):
            file.unlink()

    successful_conversions = [
        conversion for conversion in provenance.get("conversions", [])
        if conversion.get("status") == "success" and conversion.get("usdz")
    ]

    for input_file in discover_assets(args.filter, args.limit):
        print(f"[analysis] {input_file.stem}", flush=True)
        source = source_feature_analysis(input_file)
        conversions = []
        input_conversions = [
            conversion for conversion in successful_conversions
            if normalize(conversion["input"]) == normalize(input_file)
        ]

        for conversion in input_conversions:
            print(f"  {conversion['converter']}", flush=True)
            try:
                features = usd_feature_analysis(pathlib.Path(conversion["usdz"]))
                conversions.append({
                    "converter": conversion["converter"],
                    "converterVersion": conversion.get("converterVersion"),
                    "usdz": normalize(conversion["usdz"]),
                    "features": features,
                    "comparison": compare_features(source, features),
                })
            except Exception as error:
                conversions.append({
                    "converter": conversion["converter"],
                    "converterVersion": conversion.get("converterVersion"),
                    "usdz": normalize(conversion["usdz"]),
                    "error": str(error),
                })

        asset = {
            "input": normalize(input_file),
            "slug": input_file.stem,
            "source": source,
            "conversions": conversions,
        }
        (ANALYSIS_DIR / analysis_file_name(asset["slug"])).write_text(json.dumps(asset, indent=2) + "\n")

    write_index()
    if LEGACY_ANALYSIS_PATH.exists():
        LEGACY_ANALYSIS_PATH.unlink()
    if LEGACY_ANALYSIS_DIR.exists() and LEGACY_ANALYSIS_DIR != ANALYSIS_DIR:
        shutil.rmtree(LEGACY_ANALYSIS_DIR)


if __name__ == "__main__":
    main()
