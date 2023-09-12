import os
import pathlib
import asyncio
import tempfile
import argparse
from pathlib import Path

from pxr import Usd

import omni.log
import omni.kit.asset_converter as asset_converter


async def convert_to_usd(in_file: str, out_file: str, usdpreviewsurface: bool = True):
    converter_manager = asset_converter.get_instance()
    context = omni.kit.asset_converter.AssetConverterContext()
    context.export_preview_surface = usdpreviewsurface

    omni.log.warn(f"{in_file} > {out_file}")
    task = converter_manager.create_converter_task(in_file, out_file, None, context)
    await task.wait_until_finished()
    return task


async def convert_to_usdz(in_folder: str, out_file: Path):
    if out_file.exists():
        out_file.unlink()

    if not out_file.parent.exists():
        os.makedirs(out_file.parent)

    zip_writer = Usd.ZipFileWriter.CreateNew(str(out_file))
    with zip_writer:
        for file_ in pathlib.Path(in_folder).rglob("*.*"):
            abs_path_str = str(file_)
            rel_path_str = file_.relative_to(in_folder)
            omni.log.warn(f"adding to usdz: {abs_path_str}")
            zip_writer.AddFile(abs_path_str, str(rel_path_str))
    omni.log.warn(f"Completed writing {out_file}")


async def convert_file(src_path: str, dest_path: str):
    with tempfile.TemporaryDirectory() as tempdir:
        tmp_usd = pathlib.Path(tempdir).joinpath(".ov.usd")

        await convert_to_usd(src_path, str(tmp_usd))
        await convert_to_usdz(tempdir, Path(dest_path))


def main():
    parser = argparse.ArgumentParser(description="Convert files to USDZ format.")
    parser.add_argument("src_path", help="Source file path to convert.")
    parser.add_argument("dest_path", help="Destination path for the converted file.")
    parser.add_argument(
        "--usdpreviewsurface",
        type=bool,
        default=True,
        help="Create USD preview surface. Default is True.",
    )

    args = parser.parse_args()

    asyncio.run(convert_file(args.src_path, args.dest_path))


if __name__ == "__main__":
    main()