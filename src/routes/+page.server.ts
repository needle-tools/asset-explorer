import { collectFileInformation } from '../dynamicFiles'
import fs from 'fs';

type CategoryNode = {
    name: string;
    path: string;
    count: number;
    children: CategoryNode[];
};

// Disabled for now. The USD-WG catalog import is useful later, but it should not
// be included in the app until we decide how/where it belongs.
const INCLUDE_USD_WG_ASSETS = false;

function displayCategoryName(name: string) {
    if (name === "glTF Sample Assets") return "glTF Sample Assets";
    if (name === "USD WG Assets") return "USD WG Assets";
    if (name === "full_assets") return "Full Assets";
    if (name === "test_assets") return "Test Assets";
    if (name === "USD_Mini_Car_Kit") return "USD Mini Car Kit";
    if (name === "McUsd") return "McUSD";
    if (name === "usd-wg") return "USD WG";
    if (name === "gltf") return "glTF";
    const displayName = name
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
    return displayName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getUsdAssets() {
    if (!INCLUDE_USD_WG_ASSETS) return [];
    if (!fs.existsSync("usd-assets-manifest.json")) return [];
    const manifest = JSON.parse(fs.readFileSync("usd-assets-manifest.json", "utf8"));
    return (manifest.assets ?? []).map((asset: any) => ({
        kind: "usd",
        name: asset.name,
        slug: asset.slug,
        thumbnail: asset.thumbnailUri,
        url: asset.externalUrl,
        external: true,
        subheadline: asset.subheadline ?? "USD WG Asset",
        categoryPath: asset.categoryPath ?? ["USD WG Assets"],
        extras: {
            info: {
                source: asset.source,
                collection: asset.collection,
            },
        },
    }));
}

function addCategory(root: CategoryNode, categoryPath: string[]) {
    let current = root;
    current.count++;
    for (const [index, part] of categoryPath.entries()) {
        const path = categoryPath.slice(0, index + 1).join("/");
        let child = current.children.find((entry) => entry.path === path);
        if (!child) {
            child = { name: displayCategoryName(part), path, count: 0, children: [] };
            current.children.push(child);
        }
        child.count++;
        current = child;
    }
}

function buildCategoryTree(items: any[]) {
    const root: CategoryNode = { name: "All Assets", path: "", count: 0, children: [] };
    for (const item of items) addCategory(root, item.categoryPath ?? ["Assets"]);
    const sortNode = (node: CategoryNode) => {
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.children.forEach(sortNode);
    };
    sortNode(root);
    return root;
}

export async function load({ params }){
    const { files } = await collectFileInformation();
    const models = files.map((file) => {
            if(!file) {
                console.log("No file found");
                return;
            }
            return {
                kind: "gltf",
                name: file.displayName,
                slug: file.slug,
                thumbnail: file.previewUri,
                size: file.size,
                url: "/" + file.slug,
                external: false,
                groups: file.groups ?? [],
                categoryPath: ["glTF Sample Assets"],
                extras: {
                    extensions: file.extensions,
                    info: file.info,
                }
            };
        }).filter(Boolean);
    const usdAssets = getUsdAssets();
    const assets = [...models, ...usdAssets];
    return { 
        models,
        usdAssets,
        assets,
        categoryTree: buildCategoryTree(assets),
    }
};
