export function needleCloudUploadUrl(assetUri: string, pageOrigin: string, development = false) {
	const origin = new URL(pageOrigin);
	const local = development || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
	const upload = new URL("/upload", local ? "https://localhost:5173" : "https://cloud.needle.tools");
	upload.searchParams.set("url", new URL(assetUri, origin).href);
	return upload.href;
}
