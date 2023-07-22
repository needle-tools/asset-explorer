import { collectFileInformation } from './../../../dynamicFiles'

export async function load({ params }){
    const { files } = await collectFileInformation();
    return { 
        models: files.map((file) => {
            return {
                name: file.displayName,
                slug: file.name.replace(".glb", ""),
                thumbnail: file.previewUri,
                size: file.size,
                extras: {
                    extensions: file.extensions,
                    info: file.info,
                }
            };
        }),
    }
};