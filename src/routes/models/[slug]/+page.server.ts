import { files } from "./../../../../dynamicFiles";

export async function load({ params }) {
  const name = params.slug;

  console.log("Page parameters: slug=" + params.slug);

  // get index in files array
  const index = files.findIndex((element) => element.name === name);

  // get previous, current and next
  const previous = index > 0 ? files[index - 1] : null; 
  const current = files[index];
  const next = index < files.length - 1 ? files[index + 1] : null;


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
