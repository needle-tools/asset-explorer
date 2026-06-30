#!/usr/bin/env python3

import argparse
import hashlib
import json
import math
import os
import pathlib
import zipfile
from collections import Counter

from pxr import Ar, Sdf, Usd, UsdGeom, UsdLux, UsdShade, UsdSkel


ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
SAMPLE_ASSETS_DIR = ROOT_DIR / "submodules" / "glTF-Sample-Assets"
LEGACY_MODELS_DIR = ROOT_DIR / "submodules" / "glTF-Sample-Models"
SOURCE_DIR = SAMPLE_ASSETS_DIR if (SAMPLE_ASSETS_DIR / "Models").exists() else LEGACY_MODELS_DIR
SOURCE_SUBFOLDER = "Models" if SOURCE_DIR == SAMPLE_ASSETS_DIR else "2.0"
PROVENANCE_PATH = SOURCE_DIR / "conversion-provenance.json"
DEFAULT_REPORT_PATH = SOURCE_DIR / "needle-backend-comparison.json"
DEFAULT_SKIP = {"NodePerformanceTest"}
FAST_STAGE_BYTES = 0


def normalize_path(path):
    return pathlib.Path(path).resolve().as_posix()


def parse_args():
    parser = argparse.ArgumentParser(description="Compare Needle USDA and USDC USDZ exports with OpenUSD Python.")
    parser.add_argument("--filter", help="Comma-separated asset names to compare.")
    parser.add_argument("--limit", type=int, help="Maximum number of assets to compare after filtering.")
    parser.add_argument("--skip", default=",".join(sorted(DEFAULT_SKIP)), help="Comma-separated asset names to skip.")
    parser.add_argument("--output", default=str(DEFAULT_REPORT_PATH), help="JSON report path.")
    parser.add_argument("--allow-missing", action="store_true", help="Do not fail when one backend output is missing.")
    return parser.parse_args()


def parse_filter_set(value):
    if not value:
        return None
    return {item.strip() for item in value.split(",") if item.strip()}


def discover_assets(filter_name=None, limit=None, skip_names=None):
    search_root = SOURCE_DIR / SOURCE_SUBFOLDER
    files = sorted(search_root.glob("**/glTF-Binary/*.glb"))
    if not files:
        files = sorted(search_root.glob("**/*.glb"))

    exclusions = {"2CylinderEngine", "GearboxAssy", "ReciprocatingSaw", "Buggy"}
    if skip_names:
        exclusions.update(skip_names)
    filters = parse_filter_set(filter_name)
    files = [file for file in files if file.stem not in exclusions]
    if filters:
        files = [file for file in files if file.stem in filters]
    if limit:
        files = files[:limit]
    return files


def stable_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value):
    return hashlib.sha256(stable_json(value).encode("utf8")).hexdigest()


def rounded(value):
    if math.isnan(value) or math.isinf(value):
        return str(value)
    if abs(value) < 1e-4:
        return 0
    return round(value, 2)


def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return rounded(value)
    if isinstance(value, Sdf.AssetPath):
        path = value.path or value.resolvedPath or ""
        return {"asset": pathlib.PurePosixPath(path).name, "extension": pathlib.PurePosixPath(path).suffix.lower()}
    if isinstance(value, Sdf.Path):
        return value.name
    if isinstance(value, bytes):
        return {"bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()}
    if hasattr(value, "pathString"):
        return pathlib.PurePosixPath(str(value.pathString)).name
    if value.__class__.__name__.startswith("Matrix"):
        matrix = []
        for row in range(16):
            matrix_row = []
            for column in range(16):
                try:
                    matrix_row.append(value[row][column])
                except Exception:
                    break
            if not matrix_row:
                break
            matrix.append(matrix_row)
        return normalize_value(matrix)
    if hasattr(value, "GetReal") and hasattr(value, "GetImaginary"):
        return normalize_value([value.GetReal(), value.GetImaginary()])
    if hasattr(value, "GetLength") and hasattr(value, "__getitem__"):
        items = []
        for index in range(16):
            try:
                items.append(value[index])
            except Exception:
                break
        if items:
            return normalize_value(items)
    if hasattr(value, "__iter__"):
        try:
            return [normalize_value(item) for item in value]
        except TypeError:
            pass
    return str(value)


def compact_value_signature(value):
    length = sequence_length(value)
    if length is not None and length > 64:
        indices = large_sequence_sample_indices(length)
        samples = [normalize_value(value[index]) for index in indices]
        return {"count": length, "sampled": True, "sha256": digest(samples)}

    normalized = normalize_value(value)
    if isinstance(normalized, list):
        return {"count": len(normalized), "sha256": digest(normalized)}
    return normalized


def compact_fast_value_signature(value):
    length = sequence_length(value)
    if length is not None:
        return {"count": length}
    return normalize_value(value)


def sequence_length(value):
    if isinstance(value, (str, bytes)) or value is None:
        return None
    try:
        return len(value)
    except Exception:
        return None


def large_sequence_sample_indices(length):
    indices = set(range(min(64, length)))
    indices.update(range(max(0, length - 64), length))
    if length > 128:
        for step in range(128):
            indices.add(round(step * (length - 1) / 127))
    return sorted(indices)


def attr_sort_key(signature):
    return stable_json({
        "name": signature.get("name"),
        "type": signature.get("type"),
        "times": signature.get("times"),
    })


def attr_signature(attr, fast_values=False):
    samples = attr.GetTimeSamples()
    signature = {
        "name": attr.GetName(),
        "type": attr.GetTypeName().type.typeName if attr.GetTypeName() else "",
    }
    if samples:
        if len(samples) > 64:
            indices = large_sequence_sample_indices(len(samples))
            sampled_times = [samples[index] for index in indices]
            signature["times"] = {
                "count": len(samples),
                "first": rounded(float(samples[0])),
                "last": rounded(float(samples[-1])),
                "sampled": True,
            }
            if not fast_values:
                signature["timeSampleHash"] = digest([compact_value_signature(attr.Get(time)) for time in sampled_times])
        else:
            signature["times"] = [rounded(float(time)) for time in samples]
            if not fast_values:
                signature["timeSampleHash"] = digest([compact_value_signature(attr.Get(time)) for time in samples])
    if attr.HasAuthoredValueOpinion():
        signature["default"] = compact_fast_value_signature(attr.Get()) if fast_values else compact_value_signature(attr.Get())
    return signature


def relationship_signature(rel):
    targets = [path.name for path in rel.GetTargets()]
    return {"name": rel.GetName(), "targets": sorted(targets)}


def is_light(prim):
    return (
        prim.IsA(UsdLux.BoundableLightBase)
        or prim.IsA(UsdLux.NonboundableLightBase)
        or prim.HasAPI(UsdLux.LightAPI)
        or prim.GetTypeName().endswith("Light")
    )


def shader_input_signature(shader_input):
    result = {
        "name": shader_input.GetBaseName(),
        "type": shader_input.GetTypeName().type.typeName if shader_input.GetTypeName() else "",
    }
    attr = shader_input.GetAttr()
    if attr.HasAuthoredValueOpinion():
        result["value"] = compact_value_signature(shader_input.Get())
    if shader_input.HasConnectedSource():
        sources, _invalid_paths = shader_input.GetConnectedSources()
        result["connections"] = sorted([
            {
                "sourceType": source.source.GetPrim().GetTypeName(),
                "sourceName": source.source.GetPrim().GetName(),
                "sourceOutput": source.sourceName,
            }
            for source in sources
        ], key=stable_json)
    return result


def material_signature(material_prim):
    material = UsdShade.Material(material_prim)
    outputs = sorted(output.GetBaseName() for output in material.GetOutputs())
    shader_ids = Counter()
    shader_inputs = Counter()
    shader_outputs = Counter()
    for prim in Usd.PrimRange(material_prim):
        if not prim.IsA(UsdShade.Shader):
            continue
        shader = UsdShade.Shader(prim)
        shader_id = shader.GetIdAttr().Get() or ""
        shader_ids[shader_id] += 1
        for shader_input in shader.GetInputs():
            value = shader_input.Get()
            value_kind = ""
            if isinstance(value, Sdf.AssetPath):
                value_kind = pathlib.PurePosixPath(value.path or value.resolvedPath or "").suffix.lower()
            elif value is not None:
                value_kind = shader_input.GetTypeName().type.typeName if shader_input.GetTypeName() else type(value).__name__
            shader_inputs[stable_json({
                "shader": shader_id,
                "name": shader_input.GetBaseName(),
                "type": shader_input.GetTypeName().type.typeName if shader_input.GetTypeName() else "",
                "valueKind": value_kind,
                "connected": shader_input.HasConnectedSource(),
            })] += 1
        for output in shader.GetOutputs():
            shader_outputs[stable_json({"shader": shader_id, "name": output.GetBaseName()})] += 1

    return {
        "outputs": outputs,
        "shaderIds": dict(sorted(shader_ids.items())),
        "shaderInputs": dict(sorted(shader_inputs.items())),
        "shaderOutputs": dict(sorted(shader_outputs.items())),
    }


def mesh_signature(prim, fast_values=False):
    mesh_attrs = {
        "points",
        "normals",
        "faceVertexCounts",
        "faceVertexIndices",
        "extent",
        "subdivisionScheme",
        "orientation",
        "doubleSided",
        "primvars:st",
        "primvars:displayColor",
        "primvars:displayOpacity",
        "skel:jointIndices",
        "skel:jointWeights",
    }
    attrs = [
        attr_signature(attr, fast_values)
        for attr in prim.GetAttributes()
        if attr.GetName() in mesh_attrs or attr.GetName().startswith("primvars:")
    ]
    signature = {
        "attrs": sorted(attrs, key=stable_json),
        "relationships": sorted([relationship_signature(rel) for rel in prim.GetRelationships()], key=stable_json),
        "apis": sorted(prim.GetAppliedSchemas()),
    }
    signature["attrs"] = sorted(signature["attrs"], key=attr_sort_key)
    return signature


def prim_component_signature(prim, fast_values=False):
    attrs = [attr_signature(attr, fast_values) for attr in prim.GetAttributes() if attr.HasAuthoredValueOpinion() or attr.GetNumTimeSamples() > 0]
    relationships = [relationship_signature(rel) for rel in prim.GetRelationships() if rel.HasAuthoredTargets()]
    return {
        "type": prim.GetTypeName(),
        "attrs": sorted(attrs, key=attr_sort_key),
        "relationships": sorted(relationships, key=stable_json),
        "apis": sorted(prim.GetAppliedSchemas()),
    }


def collect_texture_assets(stage):
    authored_paths = set()
    for prim in stage.Traverse():
        if not prim.IsA(UsdShade.Shader):
            continue
        for shader_input in UsdShade.Shader(prim).GetInputs():
            if shader_input.GetBaseName() != "file":
                continue
            value = shader_input.Get()
            if isinstance(value, Sdf.AssetPath):
                authored_paths.add(value.path or value.resolvedPath)

    resolver = Ar.GetResolver()
    root_identifier = stage.GetRootLayer().identifier
    assets = []
    for authored_path in sorted(path for path in authored_paths if path):
        package_path = authored_path[2:] if authored_path.startswith("./") else authored_path
        if not Ar.IsPackageRelativePath(package_path) and not pathlib.PurePosixPath(package_path).is_absolute():
            package_path = Ar.JoinPackageRelativePath(root_identifier, package_path)
        resolved_path = resolver.Resolve(package_path)
        asset = resolver.OpenAsset(resolved_path) if resolved_path else None
        assets.append({
            "name": pathlib.PurePosixPath(authored_path).name,
            "extension": pathlib.PurePosixPath(authored_path).suffix.lower(),
            "size": asset.GetSize() if asset else 0,
        })
    return assets


def package_signature(usdz_path):
    entries = []
    usdc_geometry = 0
    usdc_animation = 0
    bad_usdc_entries = []

    with zipfile.ZipFile(usdz_path) as archive:
        for info in archive.infolist():
            with archive.open(info) as file:
                header = file.read(8).decode("latin1", errors="replace")
            entries.append({
                "name": pathlib.PurePosixPath(info.filename).name,
                "dir": pathlib.PurePosixPath(info.filename).parent.as_posix(),
                "extension": pathlib.PurePosixPath(info.filename).suffix.lower(),
                "size": info.file_size,
                "header": header,
            })
            if info.filename.startswith("geometries/"):
                if header == "PXR-USDC":
                    usdc_geometry += 1
                else:
                    bad_usdc_entries.append(info.filename)
            if info.filename.startswith("animations/"):
                if header == "PXR-USDC":
                    usdc_animation += 1
                else:
                    bad_usdc_entries.append(info.filename)

    return {
        "entries": sorted(entries, key=lambda entry: (entry["dir"], entry["name"])),
        "usdcGeometryLayers": usdc_geometry,
        "usdcAnimationLayers": usdc_animation,
        "badUsdcLayerEntries": bad_usdc_entries,
    }


def stage_signature(usdz_path, force_fast_values=None):
    stage = Usd.Stage.Open(str(usdz_path))
    if stage is None:
        raise RuntimeError(f"Could not open USD stage: {usdz_path}")
    fast_values = pathlib.Path(usdz_path).stat().st_size > FAST_STAGE_BYTES if force_fast_values is None else force_fast_values

    type_counts = Counter()
    meshes = []
    materials = []
    skeletons = []
    skel_animations = []
    cameras = []
    lights = []
    animated_attrs = []
    authored_components = Counter()

    for prim in stage.Traverse():
        if not prim.IsActive():
            continue
        type_name = prim.GetTypeName()
        type_counts[type_name or ""] += 1

        if prim.IsA(UsdGeom.Mesh):
            meshes.append(mesh_signature(prim, fast_values))
        elif prim.IsA(UsdShade.Material):
            materials.append(material_signature(prim))
        elif prim.IsA(UsdSkel.Skeleton):
            skeletons.append(prim_component_signature(prim, fast_values))
        elif prim.IsA(UsdSkel.Animation):
            skel_animations.append(prim_component_signature(prim, fast_values))
        elif prim.IsA(UsdGeom.Camera):
            cameras.append(prim_component_signature(prim, fast_values))
        elif is_light(prim):
            lights.append(prim_component_signature(prim, fast_values))

        for attr in prim.GetAttributes():
            if attr.GetNumTimeSamples() > 0:
                animated_attrs.append(attr_signature(attr, fast_values))

        if not (
            prim.IsA(UsdGeom.Mesh)
            or prim.IsA(UsdShade.Material)
            or prim.IsA(UsdShade.Shader)
            or prim.IsA(UsdSkel.Skeleton)
            or prim.IsA(UsdSkel.Animation)
            or prim.IsA(UsdGeom.Camera)
            or is_light(prim)
        ):
            attr_names = sorted([
                attr.GetName()
                for attr in prim.GetAttributes()
                if attr.HasAuthoredValueOpinion() or attr.GetNumTimeSamples() > 0
            ])
            rel_names = sorted([
                rel.GetName()
                for rel in prim.GetRelationships()
                if rel.HasAuthoredTargets()
            ])
            component = {
                "type": prim.GetTypeName(),
                "attrs": attr_names,
                "relationships": rel_names,
                "apis": sorted(prim.GetAppliedSchemas()),
            }
            if component["attrs"] or component["relationships"] or component["apis"]:
                authored_components[stable_json(component)] += 1

    root_layer = stage.GetRootLayer()
    return {
        "startTimeCode": rounded(float(stage.GetStartTimeCode())),
        "endTimeCode": rounded(float(stage.GetEndTimeCode())),
        "timeCodesPerSecond": rounded(float(stage.GetTimeCodesPerSecond())),
        "metersPerUnit": rounded(float(UsdGeom.GetStageMetersPerUnit(stage))),
        "upAxis": UsdGeom.GetStageUpAxis(stage),
        "defaultPrimType": stage.GetDefaultPrim().GetTypeName() if stage.GetDefaultPrim() else "",
        "rootLayerFormat": root_layer.GetFileFormat().formatId if root_layer.GetFileFormat() else "",
        "fastValueSignatures": fast_values,
        "typeCounts": dict(sorted(type_counts.items())),
        "meshes": sorted(meshes, key=stable_json),
        "materials": sorted(materials, key=stable_json),
        "skeletons": sorted(skeletons, key=stable_json),
        "skelAnimations": sorted(skel_animations, key=stable_json),
        "cameras": sorted(cameras, key=stable_json),
        "lights": sorted(lights, key=stable_json),
        "animatedAttributes": sorted(animated_attrs, key=stable_json),
        "authoredComponents": dict(sorted(authored_components.items())),
        "textureAssets": sorted(collect_texture_assets(stage), key=stable_json),
    }


def comparable_package_signature(package):
    entries = []
    for entry in package["entries"]:
        comparable = {key: value for key, value in entry.items() if key not in {"name", "sha256", "size"}}
        entries.append(comparable)
    return sorted(entries, key=stable_json)


def comparable_stage_signature(signature):
    comparable = dict(signature)
    comparable.pop("fastValueSignatures", None)
    comparable["animatedAttributes"] = multiset_signature([
        {key: value for key, value in attr.items() if key != "default"}
        for attr in signature["animatedAttributes"]
    ])
    comparable["materials"] = multiset_signature([
        strip_generated_material_names(material)
        for material in signature["materials"]
    ])
    comparable["authoredComponents"] = signature["authoredComponents"]
    comparable["meshes"] = multiset_signature([
        strip_time_sample_defaults(strip_relationship_targets(mesh))
        for mesh in signature["meshes"]
    ])
    comparable["skeletons"] = multiset_signature([
        strip_time_sample_defaults(strip_relationship_targets(skeleton))
        for skeleton in signature["skeletons"]
    ])
    comparable["skelAnimations"] = multiset_signature([
        strip_time_sample_defaults(strip_relationship_targets(animation))
        for animation in signature["skelAnimations"]
    ])
    comparable["cameras"] = multiset_signature([
        strip_time_sample_defaults(strip_relationship_targets(camera))
        for camera in signature["cameras"]
    ])
    comparable["lights"] = multiset_signature([
        strip_time_sample_defaults(strip_relationship_targets(light))
        for light in signature["lights"]
    ])
    comparable["textureAssets"] = multiset_signature([
        {
            "extension": asset["extension"],
            "size": asset["size"],
        }
        for asset in signature["textureAssets"]
    ])
    return comparable


def multiset_signature(items):
    return dict(sorted(Counter(digest(item) for item in items).items()))


def strip_time_sample_defaults(value):
    if isinstance(value, dict):
        stripped = {key: strip_time_sample_defaults(item) for key, item in value.items()}
        if "timeSampleHash" in stripped or "times" in stripped:
            stripped.pop("default", None)
        return stripped
    if isinstance(value, list):
        return [strip_time_sample_defaults(item) for item in value]
    return value


def strip_relationship_targets(value):
    if isinstance(value, dict):
        if set(value.keys()) == {"name", "targets"}:
            return {"name": value["name"], "targetCount": len(value["targets"])}
        return {key: strip_relationship_targets(item) for key, item in value.items()}
    if isinstance(value, list):
        return [strip_relationship_targets(item) for item in value]
    return value


def strip_generated_material_names(material):
    def strip(value):
        if isinstance(value, dict):
            return {
                key: strip(item)
                for key, item in value.items()
                if key not in {"sourceName"}
            }
        if isinstance(value, list):
            return [strip(item) for item in value]
        if isinstance(value, str) and (value.endswith(".jpg") or value.endswith(".jpeg") or value.endswith(".png")):
            return pathlib.PurePosixPath(value).suffix.lower()
        return value
    return strip(material)


def first_diffs(left, right, path="$", limit=20):
    if limit <= 0:
        return []
    if type(left) is not type(right):
        return [{"path": path, "left": type(left).__name__, "right": type(right).__name__}]
    if isinstance(left, dict):
        diffs = []
        for key in sorted(set(left) | set(right)):
            if key not in left or key not in right:
                diffs.append({"path": f"{path}.{key}", "left": key in left, "right": key in right})
            else:
                diffs.extend(first_diffs(left[key], right[key], f"{path}.{key}", limit - len(diffs)))
            if len(diffs) >= limit:
                return diffs[:limit]
        return diffs
    if isinstance(left, list):
        if len(left) != len(right):
            return [{"path": f"{path}.length", "left": len(left), "right": len(right)}]
        diffs = []
        for index, (left_item, right_item) in enumerate(zip(left, right)):
            diffs.extend(first_diffs(left_item, right_item, f"{path}[{index}]", limit - len(diffs)))
            if len(diffs) >= limit:
                return diffs[:limit]
        return diffs
    if left != right:
        return [{"path": path, "left": left, "right": right}]
    return []


def find_conversion(provenance, input_file, converter):
    normalized_input = normalize_path(input_file)
    matches = [
        conversion
        for conversion in provenance.get("conversions", [])
        if conversion.get("status") == "success"
        and conversion.get("usdz")
        and normalize_path(conversion.get("input")) == normalized_input
        and conversion.get("converter") == converter
    ]
    return matches[-1] if matches else None


def main():
    args = parse_args()
    skip_names = parse_filter_set(args.skip) or set()
    provenance = json.loads(PROVENANCE_PATH.read_text())
    assets = discover_assets(args.filter, args.limit, skip_names)

    report = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "schemaVersion": 1,
        "source": {"directory": normalize_path(SOURCE_DIR)},
        "assets": [],
        "summary": {
            "compared": 0,
            "equivalent": 0,
            "different": 0,
            "missing": 0,
            "usdcLayerFailures": 0,
        },
    }

    failed = False
    for input_file in assets:
        name = input_file.stem
        print(f"[compare] {name}", flush=True)
        usda_conversion = find_conversion(provenance, input_file, "needle-engine")
        usdc_conversion = find_conversion(provenance, input_file, "needle-engine-usdc")
        asset_report = {
            "asset": name,
            "input": normalize_path(input_file),
            "usda": normalize_path(usda_conversion["usdz"]) if usda_conversion else None,
            "usdc": normalize_path(usdc_conversion["usdz"]) if usdc_conversion else None,
            "status": "pending",
        }

        if not usda_conversion or not usdc_conversion:
            asset_report["status"] = "missing"
            asset_report["missing"] = {
                "usda": not bool(usda_conversion),
                "usdc": not bool(usdc_conversion),
            }
            report["summary"]["missing"] += 1
            failed = failed or not args.allow_missing
            print("  missing backend output", flush=True)
            report["assets"].append(asset_report)
            continue

        usda_path = pathlib.Path(usda_conversion["usdz"])
        usdc_path = pathlib.Path(usdc_conversion["usdz"])
        usda_package = package_signature(usda_path)
        usdc_package = package_signature(usdc_path)
        usdc_layer_ok = usdc_package["usdcGeometryLayers"] > 0 and not usdc_package["badUsdcLayerEntries"]

        fast_values = usda_path.stat().st_size > FAST_STAGE_BYTES or usdc_path.stat().st_size > FAST_STAGE_BYTES
        usda_stage = stage_signature(usda_path, fast_values)
        usdc_stage = stage_signature(usdc_path, fast_values)
        comparable_usda = {
            "stage": comparable_stage_signature(usda_stage),
        }
        comparable_usdc = {
            "stage": comparable_stage_signature(usdc_stage),
        }

        equivalent = comparable_usda == comparable_usdc
        if not usdc_layer_ok:
            report["summary"]["usdcLayerFailures"] += 1
        if equivalent and usdc_layer_ok:
            asset_report["status"] = "equivalent"
            report["summary"]["equivalent"] += 1
            print(
                f"  ok meshes={len(usdc_stage['meshes'])} animatedAttrs={len(usdc_stage['animatedAttributes'])} "
                f"usdcGeometry={usdc_package['usdcGeometryLayers']} usdcAnimation={usdc_package['usdcAnimationLayers']}",
                flush=True,
            )
        else:
            asset_report["status"] = "different"
            asset_report["diffs"] = first_diffs(comparable_usda, comparable_usdc)
            failed = True
            report["summary"]["different"] += 1
            print("  different", flush=True)

        asset_report["usdaDigest"] = digest(comparable_usda)
        asset_report["usdcDigest"] = digest(comparable_usdc)
        asset_report["usdaCounts"] = {
            "meshes": len(usda_stage["meshes"]),
            "materials": len(usda_stage["materials"]),
            "animatedAttributes": len(usda_stage["animatedAttributes"]),
            "textures": len(usda_stage["textureAssets"]),
        }
        asset_report["usdcCounts"] = {
            "meshes": len(usdc_stage["meshes"]),
            "materials": len(usdc_stage["materials"]),
            "animatedAttributes": len(usdc_stage["animatedAttributes"]),
            "textures": len(usdc_stage["textureAssets"]),
            "usdcGeometryLayers": usdc_package["usdcGeometryLayers"],
            "usdcAnimationLayers": usdc_package["usdcAnimationLayers"],
            "badUsdcLayerEntries": usdc_package["badUsdcLayerEntries"],
        }
        report["summary"]["compared"] += 1
        report["assets"].append(asset_report)

    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(f"[compare] wrote {output}", flush=True)
    print(json.dumps(report["summary"], indent=2), flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
