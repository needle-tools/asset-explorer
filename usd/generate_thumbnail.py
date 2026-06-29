#!/usr/bin/env python3

from pxr import Usd, UsdGeom, UsdMedia, Sdf, Gf, UsdUtils, UsdLux, UsdShade
import subprocess
import math
import os
import sys
import argparse
import shutil
import tempfile
from pathlib import Path

temp_dir = None

def parse_args():
    parser = argparse.ArgumentParser(description="This script takes a thumbnail image of the given USD file supplied and associates it with the file.")
    parser.add_argument('usd_file', 
                        type=str, 
                        help='The USD file you want to add a thumbnail to. If USDZ is input, a new USD file will be created to wrap the existing one called <input>_Thumbnail.usd')
    parser.add_argument('--dome-light',
                        type=str,
                        help='The path to the dome light HDR image to use, if any')
    parser.add_argument('--create-usdz-result', 
                        action='store_true',
                        help='Returns the resulting files as a new usdz file called <input>_Thumbnail.usdz')
    parser.add_argument('--width',
                        type=int,
                        help='The width of the image to generate. Default is 2048.',
                        default=2048)
    parser.add_argument('--height',
                        type=int,
                        help='The height of the image to generate. Default is 2048. If height is not specified, the image is square.')
    parser.add_argument('--output-extension', 
                        type=str, 
                        help='The file extension of the output image you want (exr, png..). If using exr, make sure your usd install includes OpenEXR',
                        default='png')
    parser.add_argument('--field-of-view',
                        type=float,
                        help='Vertical camera field of view in degrees. Default is 35.',
                        default=35.0)
    parser.add_argument('--camera-padding',
                        type=float,
                        help='Framing multiplier applied to the computed camera distance. Default is 1.12.',
                        default=1.12)
    parser.add_argument('--dome-intensity',
                        type=float,
                        help='Intensity authored on the dome light. Default is 1.0.',
                        default=1.0)
    parser.add_argument('--dome-exposure',
                        type=float,
                        help='Exposure authored on the dome light in stops. Default is 0.0.',
                        default=0.0)
    parser.add_argument('--verbose', 
                        action='store_true',
                        help='Prints out the steps as they happen')
    return parser.parse_args()

def generate_thumbnail(usd_file, verbose, extension):
    if verbose: 
        print("Step 1: Setting up the camera...")
    
    subject_stage = Usd.Stage.Open(usd_file)
    subject_file = usd_file

    if (UsdGeom.GetStageUpAxis(subject_stage) == 'Z'):
        subject_stage = generate_y_up_stage(subject_stage, usd_file)
        subject_file = temp_path('y_up.usda')

    setup_camera(subject_stage, subject_file)
    
    if verbose:
        print("Step 2: Taking the snapshot...")
    
    # Path("renders").mkdir(parents=True, exist_ok=True)

    image_path = str(create_image_filename(usd_file, extension)).replace("\\", "/")
    image_name = take_snapshot(image_path)

    return image_name

def generate_y_up_stage(stage, usd_file):
    y_up_stage = Usd.Stage.CreateNew(temp_path('y_up.usda'))
    new_top_level = UsdGeom.Xform.Define(y_up_stage, '/Root')

    for prim in stage.GetPseudoRoot().GetChildren():
        if prim != new_top_level.GetPrim():
            new_prim = y_up_stage.DefinePrim(new_top_level.GetPath().AppendChild(prim.GetName()), prim.GetTypeName())
            new_prim.SetActive(True)
            new_prim.GetReferences().AddReference(usd_file, prim.GetPath())

    # do this after the first loop because it's possible we didn't copy over the materials, so we need to make sure everything
    # is copied, then re-assign
    for prim in stage.GetPseudoRoot().GetChildren():
        mesh_prims = [mesh_prim for mesh_prim in Usd.PrimRange(prim) if mesh_prim.IsA(UsdGeom.Mesh)]
        for source_mesh_prim in mesh_prims:
            # Create a MaterialBindingAPI for the mesh prim
            binding = UsdShade.MaterialBindingAPI(source_mesh_prim)
            bound_material, binding_rel = binding.ComputeBoundMaterial()
           
            
            # get path to new prim (prepend top layer)
            root_mesh_prim = y_up_stage.GetPrimAtPath('/Root' + str(source_mesh_prim.GetPath()))
            
            root_material_prim = y_up_stage.GetPrimAtPath('/Root' + str(bound_material.GetPath()))
            root_material = UsdShade.Material(root_material_prim)

            materialBindingAPI = UsdShade.MaterialBindingAPI(root_mesh_prim)
            materialBindingAPI.Bind(root_material)

    # Apply the rotation to the parent prim
    UsdGeom.Xformable(new_top_level).AddRotateXOp().Set(270)

    y_up_stage.Save()
    return y_up_stage


def setup_camera(subject_stage, usd_file):
    camera_stage = create_camera()
    move_camera(camera_stage, subject_stage)

    # check if string is not empty
    if args.dome_light:
        add_domelight(camera_stage)

    sublayer_subject(camera_stage, usd_file)

def create_camera():
    stage = Usd.Stage.CreateNew(temp_path('camera.usda'))

    # Set metadata on the stage.
    stage.SetDefaultPrim(stage.DefinePrim('/ThumbnailGenerator', 'Xform'))
    stage.SetMetadata('metersPerUnit', 0.01)

    # Define the "MainCamera" under the "ThumbnailGenerator".
    camera = UsdGeom.Camera.Define(stage, '/ThumbnailGenerator/MainCamera')

    aspect = args.width / args.height if args.height else 1.0
    vertical_aperture = 24
    horizontal_aperture = vertical_aperture * aspect
    focal_length = vertical_aperture / (2 * math.tan(math.radians(args.field_of_view) / 2))

    # Set camera attributes explicitly so USD and browser reference renders can share a stable FOV.
    camera.CreateFocalLengthAttr(focal_length)
    camera.CreateFocusDistanceAttr(1)
    camera.CreateFStopAttr(0)
    camera.CreateHorizontalApertureAttr(horizontal_aperture)
    camera.CreateHorizontalApertureOffsetAttr(0)
    camera.CreateProjectionAttr("perspective")
    camera.CreateVerticalApertureAttr(vertical_aperture)
    camera.CreateVerticalApertureOffsetAttr(0)

    return stage

def move_camera(camera_stage, subject_stage):
    camera_prim = UsdGeom.Camera.Get(camera_stage, '/ThumbnailGenerator/MainCamera')
    camera_translation = create_camera_translation_and_clipping(subject_stage, camera_prim)
    apply_camera_translation(camera_stage, camera_prim, camera_translation)

def add_domelight(camera_stage):
    UsdLux.DomeLight.Define(camera_stage, '/ThumbnailGenerator/DomeLight')
    domeLight = UsdLux.DomeLight(camera_stage.GetPrimAtPath('/ThumbnailGenerator/DomeLight'))
    domeLight.CreateTextureFileAttr().Set(args.dome_light)
    domeLight.CreateTextureFormatAttr().Set("latlong")
    domeLight.CreateIntensityAttr().Set(args.dome_intensity)
    domeLight.CreateExposureAttr().Set(args.dome_exposure)

def create_camera_translation_and_clipping(subject_stage, camera_prim):
    bounding_box = get_bounding_box(subject_stage)
    min_bound = bounding_box.GetMin()
    max_bound = bounding_box.GetMax()

    subject_center = (min_bound + max_bound) / 2.0
    distance = get_distance_to_camera(min_bound, max_bound, camera_prim)

    center_of_thumbnail_face = Gf.Vec3d(subject_center[0], subject_center[1], max_bound[2])

    distanceInCm = distance * args.camera_padding
    
    cameraZ = center_of_thumbnail_face + get_camera_z_translation(distanceInCm)
    camera_prim.GetFocusDistanceAttr().Set(distanceInCm)

    # Keep the camera fit stable while making clipping independent from the asset's depth axis.
    # Very flat or unusually positioned assets can otherwise end up clipped even though they fit in frame.
    extent = max(
        max_bound[0] - min_bound[0],
        max_bound[1] - min_bound[1],
        max_bound[2] - min_bound[2],
        0.0001,
    )
    nearClip = max(distanceInCm * 0.001, 0.000001)
    farClip = max(distanceInCm + extent * 10, nearClip * 1000)
    clippingPlanes = Gf.Vec2f(nearClip, farClip)
    camera_prim.GetClippingRangeAttr().Set(clippingPlanes)

    if args.verbose:
        print("Calculating clipping planes... " + str(clippingPlanes))

    return cameraZ

def get_bounding_box(subject_stage):
    bboxCache = UsdGeom.BBoxCache(Usd.TimeCode.Default(), [UsdGeom.Tokens.default_])
    # Compute the bounding box for all geometry under the root
    root = subject_stage.GetPseudoRoot()
    return bboxCache.ComputeWorldBound(root).GetBox()

def get_distance_to_camera(min_bound, max_bound, camera_prim):
    aspect = args.width / args.height if args.height else 1.0
    vertical_fov = math.radians(args.field_of_view)
    horizontal_fov = 2 * math.atan(math.tan(vertical_fov / 2) * aspect)

    distance_to_capture_horizontal = calculate_camera_distance(max_bound[0] - min_bound[0], horizontal_fov)
    distance_to_capture_vertical = calculate_camera_distance(max_bound[1] - min_bound[1], vertical_fov)

    return max(distance_to_capture_horizontal, distance_to_capture_vertical)

def calculate_camera_distance(subject_size, field_of_view):
    # Subject size and field of view should be in the same units.
    distance = (subject_size / 2) / math.tan(field_of_view / 2)
    return distance

def get_camera_z_translation(distance):
    return Gf.Vec3d(0, 0, distance)

def apply_camera_translation(camera_stage, camera_prim, camera_translation):
    xformRoot = UsdGeom.Xformable(camera_prim.GetPrim())
    translateOp = None
    # Go through each operation in the xformable schema
    for op in xformRoot.GetOrderedXformOps():
        # If the operation is a translate operation, we've found our operation
        if op.GetOpType() == UsdGeom.XformOp.TypeTranslate:
            translateOp = op
            break

    # If no translate operation exists, create one
    if translateOp is None:
        translateOp = xformRoot.AddTranslateOp(UsdGeom.XformOp.PrecisionDouble)

    translateOp.Set(camera_translation)
    camera_stage.Save()

def sublayer_subject(camera_stage, input_file):
    camera_stage.GetRootLayer().subLayerPaths = [input_file]
    camera_stage.GetRootLayer().Save()

def take_snapshot(image_name):
    renderer = get_renderer()
    cmd = [
        'usdrecord',
        '--camera', 'MainCamera',
        '--imageWidth', str(args.width),
        '--renderer', renderer,
        '--colorCorrectionMode', 'sRGB',
        '--complexity', 'high',
    ]
    if args.dome_light:
        cmd.append('--disableCameraLight')
    cmd += [temp_path('camera.usda'), image_name]
    run_os_specific_usdrecord(cmd)
    return image_name

def get_renderer():
    if os.name == 'nt':
        print("windows default renderer GL being used...")
        return "GL"
    else:
        if sys.platform == 'darwin':
            print("macOS default renderer Storm being used...")
            return 'Storm'
        else:
            print("linux default renderer GL being used...")
            return 'GL'

def run_os_specific_usdrecord(cmd):
    if os.name == 'nt':
        subprocess.run(cmd, check=True, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    else:
        if sys.platform == 'darwin':
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        else:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

def create_image_filename(input_path, extension):
    return Path(input_path).with_suffix("." + extension)

def temp_path(filename):
    return str(Path(temp_dir) / filename)

def link_image_to_subject(subject_stage, image_name):
    subject_root_prim = subject_stage.GetDefaultPrim()
    mediaAPI = UsdMedia.AssetPreviewsAPI.Apply(subject_root_prim)
    thumbnails = UsdMedia.AssetPreviewsAPI.Thumbnails(defaultImage = Sdf.AssetPath(image_name))
    mediaAPI.SetDefaultThumbnails(thumbnails)
    subject_stage.GetRootLayer().Save()
    
def create_usdz_wrapper_stage(usdz_file):
    input_path = Path(usdz_file)
    file_name = input_path.stem.split('.')[0]
    wrapper_path = input_path.with_name(file_name + '_Thumbnail.usda')
    existing_stage = Usd.Stage.Open(usdz_file)
    new_stage = Usd.Stage.CreateNew(str(wrapper_path))
    
    UsdUtils.CopyLayerMetadata(existing_stage.GetRootLayer(), new_stage.GetRootLayer())

    new_stage.GetRootLayer().subLayerPaths = [usdz_file]
    new_stage.GetRootLayer().Save()
    return new_stage

def zip_results(usd_file, image_name, is_usdz):
    file_list = [usd_file, image_name]
    usdPath = Path(usd_file)

    if is_usdz:
        file_list.append(usdPath.with_name(usdPath.stem.split('.')[0] + '_Thumbnail.usda'))
        
    usdz_file = usdPath.with_suffix('_Thumbnail.usdz')
    cmd = ["usdzip", "-r", usdz_file] + file_list
    subprocess.run(cmd)

if __name__ == "__main__":

    args = parse_args()
    if args.dome_light:
        args.dome_light = str(Path(args.dome_light).resolve())
    temp_dir = tempfile.mkdtemp(prefix='asset-explorer-usd-thumbnail-')

    try:
        usd_file = args.usd_file
        is_usdz = ".usdz" in usd_file
        wrapper_stage_path = None
            
        image_name = generate_thumbnail(usd_file, args.verbose, args.output_extension)
        subject_stage = create_usdz_wrapper_stage(usd_file) if is_usdz else Usd.Stage.Open(usd_file)
        if is_usdz:
            wrapper_stage_path = subject_stage.GetRootLayer().realPath

        if args.verbose:
            print("Step 3: Linking thumbnail to subject...")

        link_image_to_subject(subject_stage, image_name)

        if args.create_usdz_result:
            if args.verbose:
                print("Step 4: Linking thumbnail to subject...")
            
            zip_results(usd_file, image_name, is_usdz)

        if wrapper_stage_path and os.path.isfile(wrapper_stage_path):
            os.remove(wrapper_stage_path)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
