import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { classifySource, selectSourceRevision } from '../scripts/lib/asset-source-comparison.mjs';

// Transpile the pure TypeScript helper with the project's compiler, including on Node versions without native TS support.
const helper = fs.readFileSync(new URL('../src/lib/assetProvenance.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { resolveAssetProvenance, rewriteAssetSourceLink } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const manifest = JSON.parse(fs.readFileSync(new URL('../src/lib/server/asset-sources.json', import.meta.url), 'utf8'));

test('MrFrog is attributed to the Needle fork with pinned source and README links', () => {
	const source = resolveAssetProvenance(manifest, 'Models/MrFrog/glTF-Binary/MrFrog.glb', 'Models/MrFrog/README.md');
	assert.equal(source.kind, 'needle-added');
	assert.equal(source.repository, 'needle-tools/glTF-Sample-Assets');
	assert(source.fileUrl.includes('/' + manifest.fork.revision + '/Models/MrFrog/'));
	assert(source.readmeUrl.includes('/needle-tools/glTF-Sample-Assets/'));
	assert.equal(source.upstreamUrl, null);
});

test('unchanged Khronos files retain their original repository', () => {
	const source = resolveAssetProvenance(manifest, 'Models/Avocado/glTF-Binary/Avocado.glb', 'Models/Avocado/README.md');
	assert.equal(source.kind, 'khronos');
	assert.equal(source.repository, 'KhronosGroup/glTF-Sample-Assets');
	assert(source.fileUrl.includes('/KhronosGroup/glTF-Sample-Assets/blob/'));
});

test('upstream updates are not misclassified as Needle modifications', () => {
	assert.deepEqual(selectSourceRevision('old', 'new', 'old', 'upstream', 'base', 'fork'), { upstream: true, revision: 'base' });
	assert.deepEqual(selectSourceRevision('same', 'same', 'old', 'upstream', 'base', 'fork'), { upstream: true, revision: 'upstream' });
	assert.deepEqual(selectSourceRevision('needle-edit', 'new', 'old', 'upstream', 'base', 'fork'), { upstream: false, revision: 'fork' });
	assert.equal(classifySource(false, true), 'needle-modified');
	assert.equal(classifySource(false, false), 'needle-added');
	assert.equal(classifySource(true, true), 'khronos');
});

test('generated conversion changes do not affect GLB origin', () => {
	for (const file of Object.keys(manifest.assets)) assert(file.endsWith('.glb'));
	assert.equal(classifySource(selectSourceRevision('glb', 'glb', 'glb', 'upstream', 'base', 'fork').upstream, true), 'khronos');
});

test('new or unclassified assets never silently inherit Khronos attribution', () => {
	const source = resolveAssetProvenance(manifest, 'Models/New/Example.glb', 'Models/New/README.md');
	assert.equal(source.kind, 'unclassified');
	assert.equal(source.repository, 'needle-tools/glTF-Sample-Assets');
	assert.equal(source.upstreamUrl, null);
});

test('README download and SampleViewer links resolve to the actual pinned source', () => {
	const raw = 'https://raw.GithubUserContent.com/KhronosGroup/glTF-Sample-Assets/main/./Models/MrFrog/glTF-Binary/MrFrog.glb';
	const rewritten = rewriteAssetSourceLink(manifest, raw);
	assert(rewritten.includes('/needle-tools/glTF-Sample-Assets/' + manifest.fork.revision + '/Models/MrFrog/'));
	const viewer = new URL(rewriteAssetSourceLink(manifest, 'https://github.khronos.org/glTF-Sample-Viewer-Release/?model=' + encodeURIComponent(raw)));
	assert.equal(viewer.searchParams.get('model'), rewritten);
	assert.equal(rewriteAssetSourceLink(manifest, 'https://example.com/license'), 'https://example.com/license');
	assert.equal(rewriteAssetSourceLink(manifest, '../other-model'), '../other-model');
});

test('Unicode filenames retain their origin and produce valid encoded source links', () => {
	const file = Object.keys(manifest.assets).find(file => /[^\x00-\x7f]/.test(file));
	assert(file, 'The comparison must include the Unicode sample');
	const source = resolveAssetProvenance(manifest, file, file.split('/').slice(0, 2).join('/') + '/README.md');
	assert.notEqual(source.kind, 'unclassified');
	assert.equal(decodeURIComponent(new URL(source.fileUrl).pathname).endsWith(file), true);
});
