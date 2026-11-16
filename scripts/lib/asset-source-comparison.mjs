// Compare source content only; generated previews/conversions are deliberately excluded.
export function selectSourceRevision(forkBlob, upstreamBlob, baselineBlob, upstreamRevision, mergeBase, forkRevision) {
	if (forkBlob && forkBlob === upstreamBlob) return { upstream: true, revision: upstreamRevision };
	if (forkBlob && forkBlob === baselineBlob) return { upstream: true, revision: mergeBase };
	return { upstream: false, revision: forkRevision };
}

export function classifySource(isUpstream, upstreamModelExists) {
	return isUpstream ? 'khronos' : upstreamModelExists ? 'needle-modified' : 'needle-added';
}
