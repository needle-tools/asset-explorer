import { files } from './../../../dynamicFiles'

export async function load({ params }){
    return { 
        models: files.map((file) => {
            return {
                name: file.displayName,
                slug: file.name.replace(".glb", ""),
                thumbnail: file.previewUri,
                size: file.size,
            };
        }),
    }
};