import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const thumbnailImageFormat = {
    extension: "webp",
    quality: 90,
    alphaQuality: 100,
    method: 6,
    intermediateExtension: "png",
};

export function normalize(filePath) {
    return path.resolve(filePath).replaceAll("\\", "/");
}

export function nativeUsdEnv(openUsd) {
    return {
        ...process.env,
        PATH: `${path.join(openUsd, "bin")}:${process.env.PATH ?? ""}`,
        PXR_PLUGINPATH_NAME: path.join(openUsd, "plugin/usd"),
        PYTHONPATH: path.join(openUsd, "lib/python"),
        DYLD_LIBRARY_PATH: path.join(openUsd, "lib") + (process.env.DYLD_LIBRARY_PATH ? ":" + process.env.DYLD_LIBRARY_PATH : ""),
    };
}

export function createThumbnailSettings({ domeLight }) {
    return {
        domeLight: normalize(domeLight),
        domeIntensity: 1,
        domeExposure: 0,
        disableCameraLight: true,
        fieldOfView: 35,
        cameraPadding: 1.12,
        clipping: "near=max(distance*0.001, 0.000001), far=max(distance+maxExtent*10, near*1000)",
        width: 900,
        height: 760,
        extension: thumbnailImageFormat.extension,
        imageFormat: thumbnailImageFormat,
        renderer: process.platform === "darwin" ? "Storm" : "GL",
        colorCorrectionMode: "sRGB",
        complexity: "high",
        alpha: "usdrecord default transparent background",
    };
}

export function generatedThumbnailPath(usdzPath) {
    return usdzPath.replace(/\.usdz$/i, "." + thumbnailImageFormat.extension);
}

function commandText(command) {
    return command.join(" ");
}

function runCommand(command, { cwd, env, timeoutMs, dryRun, onCommand }) {
    onCommand?.(commandText(command));
    if (dryRun) {
        console.log("[dry-run] " + commandText(command));
        return { status: 0 };
    }

    const result = spawnSync(command[0], command.slice(1), {
        cwd,
        env,
        stdio: "inherit",
        timeout: timeoutMs,
    });
    if (result.error) throw result.error;
    if (result.signal) throw new Error(`Command failed (${result.signal}): ${commandText(command)}`);
    if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${commandText(command)}`);
    return result;
}

export function renderUsdThumbnail({
    usdzPath,
    screenshotPath = generatedThumbnailPath(usdzPath),
    rootDir,
    openUsd,
    domeLight,
    dryRun = false,
    onCommand,
}) {
    const settings = createThumbnailSettings({ domeLight });
    const intermediatePath = usdzPath.replace(/\.usdz$/i, "." + thumbnailImageFormat.intermediateExtension);
    const previousMtime = !dryRun && fs.existsSync(intermediatePath) ? fs.statSync(intermediatePath).mtimeMs : null;
    const commands = [];
    const rememberCommand = (command) => {
        commands.push(command);
        onCommand?.(command);
    };

    const renderCommand = [
        "python3",
        "usd/generate_thumbnail.py",
        usdzPath,
        "--dome-light", domeLight,
        "--width", String(settings.width),
        "--height", String(settings.height),
        "--field-of-view", String(settings.fieldOfView),
        "--camera-padding", String(settings.cameraPadding),
        "--dome-intensity", String(settings.domeIntensity),
        "--dome-exposure", String(settings.domeExposure),
        "--output-extension", thumbnailImageFormat.intermediateExtension,
    ];
    const webpCommand = [
        "cwebp",
        "-quiet",
        "-q", String(thumbnailImageFormat.quality),
        "-alpha_q", String(thumbnailImageFormat.alphaQuality),
        "-m", String(thumbnailImageFormat.method),
        intermediatePath,
        "-o", screenshotPath,
    ];

    try {
        runCommand(renderCommand, {
            cwd: rootDir,
            env: nativeUsdEnv(openUsd),
            timeoutMs: 300000,
            dryRun,
            onCommand: rememberCommand,
        });
    }
    catch (error) {
        const renderedIntermediateExists = !dryRun && fs.existsSync(intermediatePath);
        const renderedIntermediateChanged = renderedIntermediateExists && fs.statSync(intermediatePath).mtimeMs !== previousMtime;
        if (!renderedIntermediateChanged) throw error;
        const message = error instanceof Error ? error.message : String(error);
        const warning = "thumbnail metadata linking failed after intermediate PNG render: " + message;
        commands.push(warning);
        onCommand?.(warning);
        console.warn(`[thumbnail-warning] ${path.basename(usdzPath)} rendered intermediate PNG but thumbnail metadata linking failed: ${message}`);
    }

    runCommand(webpCommand, {
        cwd: rootDir,
        timeoutMs: 120000,
        dryRun,
        onCommand: rememberCommand,
    });

    if (!dryRun) {
        fs.rmSync(intermediatePath, { force: true });
        if (!fs.existsSync(screenshotPath)) throw new Error(`thumbnail render did not create ${screenshotPath}`);
    }

    return { screenshotPath, commands, settings };
}
