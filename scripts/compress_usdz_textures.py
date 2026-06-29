#!/usr/bin/env python3
"""Create experimental smaller USDZ packages by JPEG-encoding opaque PNGs.

The script extracts a USDZ with OpenUSD, converts PNG files that have no alpha
channel or an all-opaque alpha channel to JPEG, updates Sdf.AssetPath texture
references in extracted USD layers, repackages with OpenUSD, and validates the
new package with usdchecker.
"""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
from pxr import Sdf, Usd, UsdUtils


USD_LAYER_SUFFIXES = {".usd", ".usda", ".usdc"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("usdz", nargs="+", type=Path, help="USDZ package(s) to process.")
    parser.add_argument("--quality", type=int, default=95, help="JPEG quality. Default: 95.")
    parser.add_argument("--suffix", default=".jpeg95", help="Suffix before .usdz for output packages.")
    parser.add_argument("--output", type=Path, help="Output path. Only valid for one input.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing output packages.")
    parser.add_argument("--keep-extracted", type=Path, help="Copy the final extracted package tree here.")
    parser.add_argument("--skip-usdchecker", action="store_true", help="Do not run usdchecker on outputs.")
    parser.add_argument("--usdchecker", default="usdchecker", help="usdchecker executable to use.")
    parser.add_argument("--usdzip", default="usdzip", help="usdzip executable to use.")
    parser.add_argument(
        "--convert-layers-to-usdc",
        action="store_true",
        help="Also export extracted .usd/.usda layers as .usdc and update sublayer paths.",
    )
    parser.add_argument("--json", action="store_true", help="Emit a JSON summary.")
    args = parser.parse_args()
    if args.output and len(args.usdz) != 1:
        parser.error("--output can only be used with a single input")
    if not 1 <= args.quality <= 100:
        parser.error("--quality must be between 1 and 100")
    return args


def output_path_for(input_path: Path, suffix: str, explicit_output: Path | None) -> Path:
    if explicit_output:
        return explicit_output
    if input_path.suffix.lower() != ".usdz":
        raise ValueError(f"Expected .usdz input: {input_path}")
    return input_path.with_name(input_path.stem + suffix + input_path.suffix)


def package_root_name(usdz_path: Path) -> str:
    package = Sdf.ZipFile.Open(str(usdz_path))
    if not package:
        raise RuntimeError(f"Could not open USDZ package: {usdz_path}")
    names = package.GetFileNames()
    if not names:
        raise RuntimeError(f"USDZ package is empty: {usdz_path}")
    return names[0]


def is_opaque_png(path: Path) -> tuple[bool, str]:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        if image.format != "PNG":
            return False, "not PNG"
        if image.mode == "P" and "transparency" in image.info:
            rgba = image.convert("RGBA")
            alpha = rgba.getchannel("A")
            return alpha.getextrema() == (255, 255), f"palette alpha extrema {alpha.getextrema()}"
        if "A" not in image.getbands():
            return True, f"{image.mode} no alpha"
        alpha = image.getchannel("A")
        extrema = alpha.getextrema()
        return extrema == (255, 255), f"{image.mode} alpha extrema {extrema}"


def convert_png_to_jpeg(png_path: Path, quality: int) -> tuple[Path | None, dict]:
    opaque, reason = is_opaque_png(png_path)
    info = {
        "png": str(png_path),
        "eligible": opaque,
        "reason": reason,
        "originalBytes": png_path.stat().st_size,
    }
    if not opaque:
        return None, info

    jpg_path = png_path.with_suffix(".jpg")
    with Image.open(png_path) as image:
        image = image.convert("RGB")
        image.save(jpg_path, format="JPEG", quality=quality, optimize=True)
    with Image.open(jpg_path) as image:
        image.verify()
    info["jpeg"] = str(jpg_path)
    info["jpegBytes"] = jpg_path.stat().st_size
    info["savedBytes"] = info["originalBytes"] - info["jpegBytes"]
    png_path.unlink()
    return jpg_path, info


def resolve_asset_path(layer_path: Path, asset_path: str) -> Path | None:
    if not asset_path or asset_path.startswith(("http://", "https://", "data:")):
        return None
    if asset_path.startswith("@") and asset_path.endswith("@"):
        asset_path = asset_path[1:-1]
    return (layer_path.parent / asset_path).absolute()


def package_relative_asset_path(layer_path: Path, asset_path: str, extracted_dir: Path) -> str | None:
    if not asset_path or asset_path.startswith(("http://", "https://", "data:")) or os.path.isabs(asset_path):
        return None
    if asset_path.startswith("@") and asset_path.endswith("@"):
        asset_path = asset_path[1:-1]
    layer_dir = layer_path.parent.relative_to(extracted_dir).as_posix()
    if layer_dir == ".":
        layer_dir = ""
    return posixpath.normpath(posixpath.join(layer_dir, asset_path))


def relative_package_asset_path(layer_path: Path, target_package_path: str, old_value: str, extracted_dir: Path) -> str:
    layer_dir = layer_path.parent.relative_to(extracted_dir).as_posix()
    if layer_dir == ".":
        layer_dir = ""
    rel = posixpath.relpath(target_package_path, layer_dir or ".")
    if old_value.startswith("./") and not rel.startswith("."):
        return "./" + rel
    return rel


def relative_asset_path(layer_path: Path, target_path: Path, old_value: str) -> str:
    rel = os.path.relpath(target_path, layer_path.parent)
    rel = rel.replace(os.sep, "/")
    if old_value.startswith("./") and not rel.startswith("."):
        return "./" + rel
    return rel


def replace_asset_value(value, layer_path: Path, extracted_dir: Path, replacements: dict[str, str]):
    if isinstance(value, Sdf.AssetPath):
        package_path = package_relative_asset_path(layer_path, value.path, extracted_dir)
        if package_path in replacements:
            return Sdf.AssetPath(
                relative_package_asset_path(layer_path, replacements[package_path], value.path, extracted_dir)
            ), True
    if isinstance(value, (list, tuple)):
        changed = False
        new_values = []
        for item in value:
            new_item, item_changed = replace_asset_value(item, layer_path, extracted_dir, replacements)
            changed = changed or item_changed
            new_values.append(new_item)
        if changed:
            return type(value)(new_values), True
    return value, False


def rewrite_layer_asset_paths(layer_path: Path, extracted_dir: Path, replacements: dict[str, str]) -> int:
    layer = Sdf.Layer.FindOrOpen(str(layer_path))
    if not layer:
        raise RuntimeError(f"Could not open USD layer: {layer_path}")
    changed = 0

    def visit(path: Sdf.Path) -> None:
        nonlocal changed
        obj = layer.GetObjectAtPath(path)
        if not obj or not hasattr(obj, "default"):
            return
        value = obj.default
        new_value, value_changed = replace_asset_value(value, layer_path, extracted_dir, replacements)
        if value_changed:
            obj.default = new_value
            changed += 1

    layer.Traverse("/", visit)
    if changed:
        if not layer.Save():
            raise RuntimeError(f"Could not save edited layer: {layer_path}")
    return changed


def replace_composition_item(item, layer_path: Path, extracted_dir: Path, replacements: dict[str, str]):
    asset_path = getattr(item, "assetPath", None)
    if not asset_path:
        return item, False
    package_path = package_relative_asset_path(layer_path, asset_path, extracted_dir)
    if package_path not in replacements:
        return item, False
    new_asset_path = relative_package_asset_path(layer_path, replacements[package_path], asset_path, extracted_dir)
    if isinstance(item, Sdf.Reference):
        return Sdf.Reference(new_asset_path, item.primPath, item.layerOffset, item.customData), True
    if isinstance(item, Sdf.Payload):
        return Sdf.Payload(new_asset_path, item.primPath, item.layerOffset), True
    return item, False


def rewrite_list_op_items(list_op, layer_path: Path, extracted_dir: Path, replacements: dict[str, str]) -> int:
    changed = 0
    for attr_name in ("addedItems", "prependedItems", "appendedItems", "deletedItems", "orderedItems", "explicitItems"):
        items = list(getattr(list_op, attr_name))
        if not items:
            continue
        new_items = []
        attr_changed = False
        for item in items:
            new_item, item_changed = replace_composition_item(item, layer_path, extracted_dir, replacements)
            new_items.append(new_item)
            attr_changed = attr_changed or item_changed
        if attr_changed:
            setattr(list_op, attr_name, new_items)
            changed += 1
    return changed


def rewrite_layer_composition_asset_paths(layer_path: Path, extracted_dir: Path, replacements: dict[str, str]) -> int:
    layer = Sdf.Layer.FindOrOpen(str(layer_path))
    if not layer:
        raise RuntimeError(f"Could not open USD layer: {layer_path}")
    changed = 0

    def visit(path: Sdf.Path) -> None:
        nonlocal changed
        obj = layer.GetObjectAtPath(path)
        if not obj or obj.__class__.__name__ != "PrimSpec":
            return
        changed += rewrite_list_op_items(obj.referenceList, layer_path, extracted_dir, replacements)
        changed += rewrite_list_op_items(obj.payloadList, layer_path, extracted_dir, replacements)

    layer.Traverse("/", visit)
    if changed:
        if not layer.Save():
            raise RuntimeError(f"Could not save composition edits: {layer_path}")
    return changed


def convert_layers_to_usdc(root_path: Path, extracted_dir: Path) -> tuple[Path, dict]:
    layer_paths = sorted(path for path in extracted_dir.rglob("*") if path.suffix.lower() in {".usd", ".usda"})
    if not layer_paths:
        return root_path, {"converted": 0, "editedSublayerLayers": 0, "editedCompositionListOps": 0, "layers": []}

    mapping = {path.absolute(): path.with_suffix(".usdc").absolute() for path in layer_paths}
    package_mapping = {
        path.relative_to(extracted_dir).as_posix(): path.with_suffix(".usdc").relative_to(extracted_dir).as_posix()
        for path in layer_paths
    }
    edited_sublayers = 0
    edited_composition = 0
    for layer_path in sorted(extracted_dir.rglob("*")):
        if layer_path.suffix.lower() not in USD_LAYER_SUFFIXES:
            continue
        layer = Sdf.Layer.FindOrOpen(str(layer_path))
        if not layer:
            raise RuntimeError(f"Could not open USD layer: {layer_path}")
        sublayers = list(layer.subLayerPaths)
        changed = False
        for index, sublayer in enumerate(sublayers):
            resolved = resolve_asset_path(layer_path, sublayer)
            if resolved in mapping:
                sublayers[index] = relative_asset_path(layer_path, mapping[resolved], sublayer)
                changed = True
        if changed:
            layer.subLayerPaths = sublayers
            if not layer.Save():
                raise RuntimeError(f"Could not save sublayer edits: {layer_path}")
            edited_sublayers += 1
        edited_composition += rewrite_layer_composition_asset_paths(layer_path, extracted_dir, package_mapping)

    converted = []
    for source_path, target_path in mapping.items():
        layer = Sdf.Layer.FindOrOpen(str(source_path))
        if not layer:
            raise RuntimeError(f"Could not open USD layer for USDC export: {source_path}")
        if not layer.Export(str(target_path)):
            raise RuntimeError(f"Could not export USDC layer: {target_path}")
        converted.append({"from": str(source_path), "to": str(target_path)})
        Path(source_path).unlink()

    new_root = Path(mapping.get(root_path.absolute(), root_path.absolute()))
    return new_root, {
        "converted": len(converted),
        "editedSublayerLayers": edited_sublayers,
        "editedCompositionListOps": edited_composition,
        "layers": converted,
    }


def validate_stage(path: Path) -> None:
    stage = Usd.Stage.Open(str(path))
    if not stage:
        raise RuntimeError(f"OpenUSD could not open stage: {path}")


def run_usdchecker(path: Path, executable: str) -> str:
    result = subprocess.run([executable, str(path)], text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"usdchecker failed for {path}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result.stdout + result.stderr


def create_usdz_with_usdzip(extracted_dir: Path, root_path: Path, output_path: Path, executable: str) -> None:
    files = [path for path in sorted(extracted_dir.rglob("*")) if path.is_file()]
    root_relative = root_path.relative_to(extracted_dir).as_posix()
    relative_files = [root_relative]
    relative_files.extend(
        path.relative_to(extracted_dir).as_posix()
        for path in files
        if path.relative_to(extracted_dir).as_posix() != root_relative
    )
    if output_path.exists():
        output_path.unlink()
    result = subprocess.run(
        [executable, "-r", str(output_path), *relative_files],
        cwd=extracted_dir,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"usdzip failed for {output_path}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )


def process_package(input_path: Path, output_path: Path, args: argparse.Namespace) -> dict:
    if output_path.exists() and not args.force:
        raise RuntimeError(f"Output already exists, pass --force to overwrite: {output_path}")
    original_size = input_path.stat().st_size
    root_name = package_root_name(input_path)

    with tempfile.TemporaryDirectory(prefix="usdz-jpeg95-") as tmp:
        extracted_dir = Path(tmp) / "package"
        extracted_dir.mkdir()
        if not UsdUtils.ExtractUsdzPackage(str(input_path), str(extracted_dir), False, False, True):
            raise RuntimeError(f"Could not extract USDZ package: {input_path}")
        root_path = extracted_dir / root_name
        if not root_path.exists():
            raise RuntimeError(f"Root layer from package order was not extracted: {root_name}")

        conversions = []
        replacements: dict[str, str] = {}
        for png_path in sorted(extracted_dir.rglob("*.png")):
            jpg_path, info = convert_png_to_jpeg(png_path, args.quality)
            conversions.append(info)
            if jpg_path:
                replacements[png_path.relative_to(extracted_dir).as_posix()] = jpg_path.relative_to(extracted_dir).as_posix()

        rewritten_asset_paths = 0
        if replacements:
            for layer_path in sorted(extracted_dir.rglob("*")):
                if layer_path.suffix.lower() in USD_LAYER_SUFFIXES:
                    rewritten_asset_paths += rewrite_layer_asset_paths(layer_path, extracted_dir, replacements)

        layer_conversion = {"converted": 0, "layers": []}
        if args.convert_layers_to_usdc:
            root_path, layer_conversion = convert_layers_to_usdc(root_path, extracted_dir)

        validate_stage(root_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        create_usdz_with_usdzip(extracted_dir, root_path, output_path, args.usdzip)
        package = Sdf.ZipFile.Open(str(output_path))
        package_names = package.GetFileNames() if package else []
        externalized = [name for name in package_names if name.split("/", 1)[0].isdigit()]
        if externalized:
            raise RuntimeError(
                "Packaged output contains numbered externalized dependencies; "
                f"asset path rewrite likely failed: {externalized[:8]}"
            )
        validate_stage(output_path)
        usdchecker_output = "" if args.skip_usdchecker else run_usdchecker(output_path, args.usdchecker)

        if args.keep_extracted:
            keep_path = args.keep_extracted
            if len(args.usdz) > 1:
                keep_path = keep_path / input_path.stem
            if keep_path.exists():
                shutil.rmtree(keep_path)
            shutil.copytree(extracted_dir, keep_path)

    output_size = output_path.stat().st_size
    converted_images = [item for item in conversions if item.get("jpeg")]
    return {
        "input": str(input_path),
        "output": str(output_path),
        "originalBytes": original_size,
        "outputBytes": output_size,
        "savedBytes": original_size - output_size,
        "savedPercent": round((original_size - output_size) / original_size * 100, 2) if original_size else 0,
        "pngImages": len(conversions),
        "convertedImages": len(converted_images),
        "skippedImages": len(conversions) - len(converted_images),
        "rewrittenAssetPaths": rewritten_asset_paths,
        "imageConversions": conversions,
        "layerConversion": layer_conversion,
        "usdchecker": "skipped" if args.skip_usdchecker else ("Success" if "Success" in usdchecker_output else "OK"),
    }


def print_human(summary: dict) -> None:
    print(f"{summary['input']}")
    print(f"  -> {summary['output']}")
    print(
        f"  {summary['convertedImages']}/{summary['pngImages']} PNGs converted, "
        f"{summary['rewrittenAssetPaths']} asset paths updated"
    )
    if summary["layerConversion"]["converted"]:
        print(f"  {summary['layerConversion']['converted']} USD layers exported as USDC")
    print(
        f"  size: {summary['originalBytes']:,} -> {summary['outputBytes']:,} bytes "
        f"({summary['savedPercent']}% saved)"
    )
    print(f"  usdchecker: {summary['usdchecker']}")


def main() -> int:
    args = parse_args()
    summaries = []
    for input_path in args.usdz:
        input_path = input_path.resolve()
        output_path = output_path_for(input_path, args.suffix, args.output).resolve()
        summaries.append(process_package(input_path, output_path, args))
    if args.json:
        print(json.dumps(summaries, indent=2))
    else:
        for summary in summaries:
            print_human(summary)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
