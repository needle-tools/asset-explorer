/// helpful stuff
// https://joshcollinsworth.com/blog/build-static-sveltekit-markdown-blog/

// we're in nodejs here; we can use path and so on
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';

// find all glb files in folder
// const files = import.meta.glob("D:/git/pfc-packages-master/development/pfc-modelexporter/development/ModelConversion/Exports/**.glb", { eager: true });

export const sourceDir = "/Users/herbst/git/glTF-Sample-Models/2.0/"; //"E:/git/glTF-Sample-Models/2.0/";


const files = globSync(sourceDir + "**/**.glb").sort();
// console.log("ALL FILES", files);

/*
declare type File = {
    path: string,
    name: string,
    uri: string,
}
*/

// const array: File[] = [];
// JSDoc annotation to type the array
/** @type {Array<{path:string, name:string, uri:string, downloadUri:string, size: number, key: number}>} */
const array = [];

for (const [index, file] of files.entries()) {
    array.push({
        // make canonical path
        path: path.resolve(file).replaceAll("\\", "/"),
        name: path.parse(file).name,
        uri: "/models/" + path.parse(file).name,
        downloadUri: "/downloads/" + path.parse(file).name + ".glb",
        size: fs.existsSync(file) ? fs.statSync(file).size : 0,
        key: index,
    })
}

export { array as files };