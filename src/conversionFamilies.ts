export type ConversionFamily = {
    id: string;
    label: string;
    shortLabel: string;
    suffix: string;
    description: string;
    converter: string;
    versionLabel: string;
    logo?: string;
    historical?: boolean;
};

export const conversionFamilies: ConversionFamily[] = [
    {
        id: "three-r154",
        label: "three.js",
        shortLabel: "three r154",
        suffix: "three",
        description: "Converted with three.js r154, Needle fork",
        converter: "three",
        versionLabel: "r154 Needle fork",
        logo: "threejs.svg",
        historical: true,
    },
    {
        id: "three-r185",
        label: "three.js",
        shortLabel: "three r185",
        suffix: "three-r185",
        description: "Converted with upstream three.js 0.185.0",
        converter: "three",
        versionLabel: "0.185.0",
        logo: "threejs.svg",
    },
    {
        id: "needle-engine",
        label: "Needle Engine",
        shortLabel: "Needle",
        suffix: "needle-engine",
        description: "Converted with Needle Engine 5.1.2 USDZExporter",
        converter: "needle-engine",
        versionLabel: "5.1.2",
        logo: "needle-symbol.svg",
    },
    {
        id: "blender-3-6",
        label: "Blender",
        shortLabel: "Blender 3.6",
        suffix: "blender",
        description: "Converted with Blender 3.6",
        converter: "blender",
        versionLabel: "3.6",
        logo: "blender.svg",
        historical: true,
    },
    {
        id: "blender-5-1",
        label: "Blender",
        shortLabel: "Blender 5.1",
        suffix: "blender-5-1",
        description: "Converted with Blender 5.1.2",
        converter: "blender",
        versionLabel: "5.1.2",
        logo: "blender.svg",
    },
    {
        id: "openusd-adobe-gltf",
        label: "OpenUSD + Adobe glTF",
        shortLabel: "Adobe glTF",
        suffix: "openusd-adobe-gltf",
        description: "Converted with OpenUSD 26.05 and Adobe glTF file-format plugin 2026.03",
        converter: "openusd-adobe-gltf",
        versionLabel: "OpenUSD 26.05 + Adobe 2026.03",
    },
    {
        id: "guc",
        label: "GUC",
        shortLabel: "GUC",
        suffix: "guc",
        description: "Converted with GUC 0.5",
        converter: "guc",
        versionLabel: "0.5",
    },
    {
        id: "omniverse",
        label: "Omniverse",
        shortLabel: "Omniverse",
        suffix: "ov",
        description: "Converted with Omniverse Kit 105.0",
        converter: "omniverse",
        versionLabel: "Kit 105.0",
        logo: "omniverse.svg",
        historical: true,
    },
];

export const activeConversionFamilies = conversionFamilies.filter((family) => !family.historical);
