/// helpful stuff
// https://joshcollinsworth.com/blog/build-static-sveltekit-markdown-blog/

// we're in nodejs here; we can use path and so on
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';

import { marked } from 'marked';

// find all glb files in folder
// const files = import.meta.glob("D:/git/pfc-packages-master/development/pfc-modelexporter/development/ModelConversion/Exports/**.glb", { eager: true });

export const sourceDir = "/Users/herbst/git/glTF-Sample-Models/2.0/"; //"E:/git/glTF-Sample-Models/2.0/";


const files = globSync(sourceDir + "**/**.glb").sort();
const images = [];
// console.log("ALL FILES", files);

/*
declare type File = {
    path: string,
    name: string,
    uri: string,
}
*/

let mdPath = "";
let mdDirName = "";

/** @type{string | null} */
let firstFoundH1 = null;
/** @type{string | null} */
let firstFoundImage = null;

const slugger = new marked.Slugger()
const originalRenderer = new marked.Renderer();
const renderer = {

   /**
   * @param {string} href
   * @param {string} title
   * @param {string} text
   */
    image(href, title, text) {

        // check if this is an absolute URL
        const isAbsoluteUrl = href.startsWith("http://") || href.startsWith("https://");
        if (isAbsoluteUrl) {
            return false;
        }

        const targetPath = `resources/` + mdDirName + `/` + href;
        const directoryPart = path.dirname(href);
        images.push({
            absolutePath: path.resolve(mdPath, href),
            targetPath: "resources/" + mdDirName + "/" + directoryPart,
        });
        
        // seems we can't just call the base implementation, so
        // this is a rough copy of the base implementation that does less sanitization.
        // return false;

        if (!firstFoundImage)
            firstFoundImage = "/" + targetPath;

        let out = `<img src="/${targetPath}" alt="${text}"`;
        if (title) {
          out += ` title="${title}"`;
        }
        out += '/>';
        return out;
    },
    link(href, title, text) {
        // TODO probably need to handle relative URLs and decide what to do with them.
        if (!href.startsWith("http"))
            console.log("Found link: " + href);

        if (href.toLowerCase().endsWith("/readme.md"))
            // strip it out
            href = href.substring(0, href.length - 10);

        /*
        switch(href) {
            case "/NormalTangentTest":
                href ="/models/NormalTangentTest";
                break;
            case "/NormalTangentMirrorTest":
                href ="/models/NormalTangentMirrorTest";
                break;
            case "/WaterBottle/":
                href ="/models/WaterBottle";
                break;
            case "/TextureTransformTest":
                href ="/models/TextureTransformTest";
                break;
            default:
                break;
        }
        */

        return originalRenderer.link(href, title, text);
    },

    heading(text, level) {
        const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
    
        if (level === 1 && !firstFoundH1)
            firstFoundH1 = text;

        return `
                <h${level}>
                  <a name="${escapedText}" class="anchor" href="#${escapedText}">
                    <span class="header-link"></span>
                  </a>
                  ${text}
                </h${level}>`;
      },
};

/** @type {Array<{path:string, name:string, displayName: string, uri:string, previewUri: string | null, downloadUri:string, size: number, key: number, readme: string}>} */
const array = [];

marked.use({renderer});

for (const [index, file] of files.entries()) {
    const readmePath = globSync(
        path.resolve(file, "../..", "**/Readme.md"), 
        { 
            nocase: true 
        }
    )[0];

    const baseUrlPath = path.resolve(readmePath, "..");
    const dirName = path.parse(baseUrlPath).name;
    mdPath = baseUrlPath;
    mdDirName = dirName;

    firstFoundH1 = null;
    firstFoundImage = null;
    const readmeText = marked.parse(
        fs.readFileSync(
            readmePath,
            {
                encoding: 'utf8',
            }
        ),
        { 
            headerIds: false, 
            mangle: false, 
            gfm: true,
        },
    )
    
    array.push({
        // make canonical path
        path: path.resolve(file).replaceAll("\\", "/"),
        name: path.parse(file).name,
        displayName: firstFoundH1 || path.parse(file).name,
        previewUri: firstFoundImage,
        uri: "/models/" + path.parse(file).name,
        downloadUri: "/downloads/" + path.parse(file).name + ".glb",
        size: fs.existsSync(file) ? fs.statSync(file).size : 0,
        key: index,
        // get readme file related to this one by traversing directory up and looking for Readme.md (in any casing)
        readme: readmeText,
    })
}

// console.log(images);

export { array as files, images };