import fs from "fs";
import { files, sourceDir } from "./../../../../dynamicFiles";

export const prerender = true;

export async function load({ params }) {
  const name = params.slug;

  // slug is without extension and relative to the root folder

  const fullFileName = sourceDir + name + ".glb";

  console.log("Page parameters: slug=" + params.slug);

  // get index in files array
  const index = files.findIndex((element) => element.name === name);

  // get previous, current and next
  const previous = index > 0 ? files[index - 1] : null; 
  const current = files[index];
  const next = index < files.length - 1 ? files[index + 1] : null;

  // add additional info to them, e.g. file size

  /*
  // check existance
  if (!fs.existsSync(fullFileName)) {
    return {
      name,
      size: -1,
    };
  }

  const buffer = fs.readFileSync(fullFileName, (err, data) => {
    console.log(data);
  });

  console.log(buffer.length);
  */

  // fetch file and display info about it

  // check if file exists

  return {
    previous,
    current,
    next,
  };

  /*

    const post = await import(`../${params.slug}.md`)
    const { title, date } = post.metadata
    const content = post.default
  
    return {
      content,
      title,
      date,
    }

    */
}
