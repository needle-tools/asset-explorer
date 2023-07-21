import { files } from './../../../dynamicFiles'

export async function load({ params }){
    return { 
        models: files.map((file) => {
            return {
                name: file.name,
                slug: file.name.replace(".glb", ""),
                size: file.size,
            };
        }),
    }
};