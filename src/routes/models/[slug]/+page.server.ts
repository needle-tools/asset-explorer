import { collectFileInformation } from "./../../../../dynamicFiles";

export async function load({ params }) {
  const name = params.slug;

  const { files } = await collectFileInformation();

  console.log("Page parameters: slug=" + params.slug);

  // get index in files array
  const index = files.findIndex((element) => element.name === name);

  // get previous, current and next
  const previous = index > 0 ? files[index - 1] : null; 
  const current = files[index];
  const next = index < files.length - 1 ? files[index + 1] : null;


  return {
    // entries: [previous, current, next],
    entries: [current],
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
