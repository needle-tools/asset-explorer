// Run npm run generate:asset-sources to refresh against Khronos main.
// For reproducible/offline comparisons, pass --upstream-ref <commit> (and optionally --fork-ref <commit>).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectSourceRevision, classifySource } from './lib/asset-source-comparison.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.join(root, 'submodules/glTF-Sample-Assets');
const upstreamRepository = 'KhronosGroup/glTF-Sample-Assets';
const forkRepository = 'needle-tools/glTF-Sample-Assets';
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
let upstreamRef = option('--upstream-ref');
if (!upstreamRef) {
	git('fetch', '--no-tags', `https://github.com/${upstreamRepository}.git`, 'main');
	upstreamRef = 'FETCH_HEAD';
}
const forkRevision = git('rev-parse', option('--fork-ref') ?? 'HEAD');
const upstreamRevision = git('rev-parse', upstreamRef);
const mergeBase = git('merge-base', forkRevision, upstreamRevision);
function tree(ref) {
	return new Map(git('ls-tree', '-r', '-z', ref, '--', 'Models').split('\0').filter(Boolean).map(line => {
		const [metadata, file] = line.split('\t');
		return [file, metadata.split(' ')[2]];
	}));
}
const fork = tree(forkRevision);
const upstream = tree(upstreamRevision);
const baseline = tree(mergeBase);
const upstreamModels = new Set([...upstream.keys(), ...baseline.keys()].map(file => file.split('/')[1]));
function sourceFor(file) {
	const selected = selectSourceRevision(fork.get(file), upstream.get(file), baseline.get(file), upstreamRevision, mergeBase, forkRevision);
	return { repository: selected.upstream ? upstreamRepository : forkRepository, revision: selected.revision };
}
const assets = {};
const summary = { khronos: 0, needleAdded: 0, needleModified: 0 };
for (const [file, blob] of fork) {
	if (!file.endsWith('.glb')) continue;
	const source = sourceFor(file);
	const kind = classifySource(source.repository === upstreamRepository, upstreamModels.has(file.split('/')[1]));
	const directory = file.split('/').slice(0, 2).join('/');
	const readmePath = [...fork.keys()].find(candidate => candidate.toLowerCase() === `${directory}/readme.md`.toLowerCase());
	assets[file] = {
		kind,
		blob,
		source,
		upstreamBlob: upstream.get(file) ?? null,
		upstreamChanged: kind === 'khronos' && source.revision !== upstreamRevision,
		readme: readmePath ? { path: readmePath, ...sourceFor(readmePath) } : null,
	};
	summary[kind === 'khronos' ? 'khronos' : kind === 'needle-added' ? 'needleAdded' : 'needleModified']++;
}
const output = {
	schemaVersion: 1,
	upstream: { repository: upstreamRepository, revision: upstreamRevision },
	fork: { repository: forkRepository, revision: forkRevision },
	mergeBase,
	summary,
	assets,
};
const destination = path.join(root, 'src/lib/server/asset-sources.json');
const serialized = JSON.stringify(output, null, 2) + '\n';
if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== serialized) {
	fs.writeFileSync(destination, serialized);
}
console.log(JSON.stringify({ forkRevision, upstreamRevision, mergeBase, summary }, null, 2));
