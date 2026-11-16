import path from "path";
import fs from 'fs';
import { marked } from 'marked';

export async function load({ params }) {

    const readmePath = path.resolve("README.md");
    let readmeText = marked.parse(
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

    const sections: { id: string; title: string }[] = [];
    readmeText = readmeText.replace(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/g, (_match: string, level: string, html: string) => {
        const title = html.replace(/<[^>]+>/g, "")
            .replace(/&#(\d+);/g, (_entity, code) => String.fromCodePoint(Number(code)))
            .replace(/&#x([a-f0-9]+);/gi, (_entity, code) => String.fromCodePoint(parseInt(code, 16)))
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
            .replace(/\s+/g, " ").trim();
        const id = "about-" + sections.length;
        sections.push({ id, title });
        return `<h${level} id="${id}">${html}</h${level}>`;
    });

    return {
        sections,
        readme: readmeText,
    }
};