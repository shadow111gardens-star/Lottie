import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
const browser = new Window({url:'http://localhost/dashboard'});
globalThis.window = browser;
const output = new URL('./.project-list-loading.mjs', import.meta.url);
globalThis.listOwner = { uid: 'owner-a' };
globalThis.listDownloads = 0;
globalThis.listDocuments = [{ id: 'one', data: () => ({ ownerId: 'owner-a', projectId: 'one', name: 'Project', type: 'SVG', layerCount: 1, r2: { thumbnail: 'preview-v1', source: ['users/owner-a/projects/one/source/hash/photo.png'], lottie: 'users/owner-a/projects/one/lottie/hash/animation.json' } }) }];
const mocks = {
  firebase: 'export const db={}; export const firebaseError=null; export function getFirebaseAuth(){return {currentUser:globalThis.listOwner};}',
  firestore: 'export function collection(){} export async function getDocs(){return {docs:globalThis.listDocuments};} export function doc(){} export function getDoc(){} export function setDoc(){} export function updateDoc(){} export function deleteDoc(){} export function serverTimestamp(){} export function runTransaction(){}',
  storage: 'export async function currentOwner(){return globalThis.listOwner;} export function assertOwner(user){if(user.uid!==globalThis.listOwner?.uid)throw Error("Owner changed");} export function assetBlob(){globalThis.listDownloads++;return new Promise(resolve=>{globalThis.resolveThumbnail=resolve;});} export async function dataUrl(value){return value;} export function upload(){} export function prefix(){} export function digest(){} export function storageRequest(){}',
};
const bundle = await build({ stdin: { contents: 'export {readProjects,cachedProjects} from "./src/projects/store";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false, plugins: [{ name: 'listing-network', setup(build) {
  build.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'mock' }));
  build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'mock' }));
  build.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: 'storage', namespace: 'mock' }));
  build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path] }));
} }] });
await writeFile(output, bundle.outputFiles[0].text);
try {
  const api = await import(output.href);
  const updates = [];
  const listing = await api.readProjects(project => updates.push(project));
  assert.equal(listing.projects.length, 1, 'Metadata returns while thumbnail download is unresolved');
  assert.equal(listing.projects[0].preview, undefined);
  assert.deepEqual(listing.projects[0].assets.map(asset=>[asset.name,asset.kind]), [['photo.png','Image'],['Project.json','Lottie']]);
  assert.equal(api.cachedProjects().projects.length, 1, 'Returning dashboard has synchronous project metadata');
  globalThis.resolveThumbnail('data:preview-v1');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(updates[0].preview, 'data:preview-v1');
  assert.equal(api.cachedProjects().projects[0].preview, 'data:preview-v1');
  await api.readProjects();
  assert.equal(globalThis.listDownloads, 1, 'Repeated refresh reuses downloaded thumbnail');
  globalThis.listOwner = { uid: 'owner-b' };
  assert.equal(api.cachedProjects().projects.length, 0, 'Account change never exposes previous owner cache');
  globalThis.listOwner = { uid: 'owner-a' };
  globalThis.listDocuments[0].data = () => ({ ownerId: 'owner-a', projectId: 'one', name: 'Updated', type: 'SVG', layerCount: 1, r2: { thumbnail: 'preview-v2' } });
  await api.readProjects(project => updates.push(project));
  globalThis.listOwner = null;
  globalThis.resolveThumbnail('data:preview-v2');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(updates.length, 1, 'Late thumbnail cannot update signed-out dashboard');
  console.log('PASS Project metadata loads before previews, synchronous cache, thumbnail reuse and owner isolation');
} finally { await unlink(output); await browser.happyDOM.abort(); delete globalThis.window; }
