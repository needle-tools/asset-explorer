import path from "path";
import fs from 'fs';
import { marked } from 'marked';

export async function load({ params }) {

    const readmePath = path.resolve("README.md");
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

    return {
        readme: readmeText,
    }
};