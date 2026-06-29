import { attachAssetAnalysis, collectFileInformation } from "../../dynamicFiles";
import { error } from "@sveltejs/kit";

export async function load({ params, url }) {
  const name = params.slug;

  const { files } = await collectFileInformation(); // can't filter since we need at least next/prev

  // get index in files array
  const index = files.findIndex((element) => element.name === name);
  if (index < 0) {
    throw error(404, `Unknown model: ${name}`);
  }

  // get previous, current and next
  const previous = index > 0 ? files[index - 1] : null; 
  const current = attachAssetAnalysis(files[index]);
  const next = index < files.length - 1 ? files[index + 1] : null;

  return {
    // entries: [previous, current, next],
    model: current,
    previous: previous,
    next: next,
    pageOrigin: url.origin,
  };
}
