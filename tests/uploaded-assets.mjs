import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Window } from 'happy-dom';
import { indexedDB } from 'fake-indexeddb';
const win = new Window(); globalThis.window = win; globalThis.indexedDB = indexedDB;
globalThis.Event = win.Event;
globalThis.assetOwner = { uid: 'upload-owner' };
globalThis.assetDocuments = new Map(); globalThis.assetObjects = new Map();
globalThis.assetDigest = async blob => createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
const output = new URL('./.uploaded-assets.mjs', import.meta.url);
const mocks = {
  firebase: 'export const db={};export const firebaseError=null;export function getFirebaseAuth(){return {currentUser:globalThis.assetOwner};}',
  firestore: `export function collection(...args){return args.slice(1);}export function doc(...args){return args.at(-1);}
export async function setDoc(id,data){globalThis.assetDocuments.set(id,data);}export function serverTimestamp(){return {toMillis:()=>Date.now()};}
export async function getDoc(id){return {exists:()=>globalThis.assetDocuments.has(id),data:()=>globalThis.assetDocuments.get(id)};}
export async function getDocs(){return {docs:[...globalThis.assetDocuments].map(([id,value])=>({id,data:()=>value}))};}
export async function runTransaction(db,action){await action({get:getDoc,set:setDoc,update:(id,patch)=>globalThis.assetDocuments.set(id,{...globalThis.assetDocuments.get(id),...patch})});}
export async function updateDoc(id,patch){globalThis.assetDocuments.set(id,{...globalThis.assetDocuments.get(id),...patch});}export async function deleteDoc(id){globalThis.assetDocuments.delete(id);}`,
  storage: `export async function currentOwner(){return globalThis.assetOwner;}export function assertOwner(user){if(user.uid!==globalThis.assetOwner?.uid)throw Error('Account changed');}
export function prefix(user,id){return 'users/'+user.uid+'/projects/'+id+'/';}export async function digest(blob){return globalThis.assetDigest(blob);}
export async function dataUrl(blob){return 'data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');}
export async function upload(user,id,path,blob){const key=prefix(user,id)+path;globalThis.assetObjects.set(key,blob);return key;}
export async function assetBlob(user,id,key){assertOwner(user);return globalThis.assetObjects.get(key);}
export async function storageRequest(user,id,method,path){if(method==='DELETE'){if(globalThis.failAssetDelete)throw Error('Storage unavailable');for(const key of globalThis.assetObjects.keys())if(key.startsWith(prefix(user,id)))globalThis.assetObjects.delete(key);return {}; }if(path)return {blob:async()=>globalThis.assetObjects.get(prefix(user,id)+path)};return {json:async()=>({keys:[...globalThis.assetObjects.keys()].filter(key=>key.startsWith(prefix(user,id)+'source/'))})};}`,
};
const bundle = await build({ stdin: { contents: 'export {uploadLibraryFile,createProject,saveProject,readProjects,readUploadedAssets,deleteAsset,deleteProject,restoreProject,cachedProjects,loadProject} from "./src/projects/store";export {initialScene} from "./src/editor/model"; export {projectSignal,projectStopped} from "./src/projects/lifecycle";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false, plugins: [{ name: 'upload-boundary', setup(build) {
  build.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'mock' }));
  build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'mock' }));
  build.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: 'storage', namespace: 'mock' }));
  build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path] }));
} }] });
await writeFile(output, bundle.outputFiles[0].text);
try {
  const api = await import(output.href);
  const photo = new File(['original photo bytes'], 'holiday photo.png', { type: 'image/png' });
  const standalone = await api.uploadLibraryFile(photo);
  let listing = await api.readProjects();
  const library = listing.projects.find(project => project.id === standalone);
  assert.equal(library.libraryOnly, true);
  assert.equal(library.assets[0].name, 'holiday photo.png', 'Original name survives sanitized storage paths');
  assert.equal(await globalThis.assetObjects.get(library.assets[0].key).text(), 'original photo bytes');
  assert.equal(library.assets[0].kind, 'Image');
  const first = { ...api.initialScene('Uploads'), layers: [], files: { source: [{ name: 'first.svg', data: 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64') }] } };
  const id = await api.createProject('Uploads', first);
  const next = { ...first, files: { source: [{ name: 'second.jpg', data: 'data:image/jpeg;base64,' + Buffer.from('jpg').toString('base64') }] } };
  await api.saveProject(id, next);
  listing = await api.readProjects();
  assert.deepEqual(listing.projects.find(project => project.id === id).assets.map(asset => asset.name), ['first.svg', 'second.jpg'], 'Replacing scene keeps earlier uploads in library');
  assert.equal((await api.readUploadedAssets(id)).length, 2, 'Older uploaded blobs remain discoverable');
  await assert.rejects(api.uploadLibraryFile(new File([], 'empty.png')), /non-empty/);
  console.log('PASS Standalone uploads, original bytes/names, library-only metadata and accumulated SVG/photo upload history');
  const duplicate = await api.uploadLibraryFile(new File(['original photo bytes'], 'renamed-copy.png', { type: 'image/png' }));
  const deletedCopy = await api.uploadLibraryFile(photo);
  await api.deleteProject(deletedCopy);
  const unrelated = await api.uploadLibraryFile(new File(['other photo bytes'], 'holiday photo.png', { type: 'image/png' }));
  const imported = await api.createProject('Imported photo', { ...api.initialScene(), layers: [], files: { source: [{ name: photo.name, data: 'data:image/png;base64,' + Buffer.from('original photo bytes').toString('base64') }] } });
  const signal = api.projectSignal(globalThis.assetOwner.uid, standalone);
  await api.deleteAsset(standalone, library.assets[0]);
  await assert.rejects(api.restoreProject(deletedCopy), /no longer available/, 'Prior project Undo cannot restore the deleted asset');
  for (const removed of [standalone, duplicate, imported]) {
    assert.equal(globalThis.assetDocuments.has(removed), false);
    assert.ok(![...globalThis.assetObjects.keys()].some(key => key.includes(`/projects/${removed}/`)));
    assert.ok(!api.cachedProjects().projects.some(project => project.id === removed));
    await assert.rejects(api.loadProject(removed), /deleted/);
    await assert.rejects(api.restoreProject(removed), /no longer available/);
  }
  assert.equal(signal.aborted, true);
  assert.ok(globalThis.assetDocuments.has(unrelated));
  assert.ok(globalThis.assetDocuments.has(id));
  console.log('PASS Asset deletion removes matching copies, linked projects, cloud objects, caches and undo backups while preserving unrelated assets');
  const before = globalThis.assetDocuments.size;
  await assert.rejects(api.deleteAsset(unrelated, { ...library.assets[0] }), /does not belong/);
  assert.equal(globalThis.assetDocuments.size, before);
  const target = (await api.readProjects()).projects.find(project => project.id === unrelated);
  globalThis.failAssetDelete = true;
  await assert.rejects(api.deleteAsset(unrelated, target.assets[0]), /Cleanup will retry/);
  assert.ok(api.projectStopped(globalThis.assetOwner.uid, unrelated));
  globalThis.failAssetDelete = false;
  await new Promise(resolve => setTimeout(resolve, 5300));
  assert.ok(![...globalThis.assetObjects.keys()].some(key => key.includes(`/projects/${unrelated}/`)));
  await assert.rejects(api.restoreProject(unrelated), /no longer available/);
  console.log('PASS Foreign asset rejection and failed cloud cleanup retry without restoring permanently deleted files');
  const undoCopy = await api.uploadLibraryFile(new File(['cross-tab undo copy'], 'undo.png', { type: 'image/png' }));
  const undoAsset = (await api.readProjects()).projects.find(project => project.id === undoCopy).assets[0];
  await api.deleteProject(undoCopy);
  const permanent = JSON.parse(window.localStorage.getItem('svgforge-permanent-asset-deletions') || '{}');
  permanent[`${globalThis.assetOwner.uid}:${undoAsset.key.split('/').at(-2)}`] = Date.now();
  window.localStorage.setItem('svgforge-permanent-asset-deletions', JSON.stringify(permanent));
  await assert.rejects(api.restoreProject(undoCopy), /permanently deleted/, 'Deletion in another tab invalidates an old Undo backup');
  const tabSignal = api.projectSignal(globalThis.assetOwner.uid, id);
  let removedInOtherTab;
  window.addEventListener('svgforge-project-removed', event => { removedInOtherTab = event.detail; });
  const tombstones = JSON.parse(window.localStorage.getItem('svgforge-deleted-projects') || '[]');
  window.dispatchEvent(new win.StorageEvent('storage', { key: 'svgforge-deleted-projects', newValue: JSON.stringify([...tombstones, `${globalThis.assetOwner.uid}:${id}`]) }));
  assert.equal(tabSignal.aborted, true);
  assert.deepEqual(removedInOtherTab, { owner: globalThis.assetOwner.uid, id });
  await assert.rejects(api.loadProject(id), /deleted/);
  assert.ok(!api.cachedProjects().projects.some(project => project.id === id));
  console.log('PASS Cross-tab deletion cancels requests and prevents cached project reopening');
  const legacy = await api.uploadLibraryFile(new File(['legacy file'], 'legacy.png', { type: 'image/png' }));
  const legacyCopy = await api.uploadLibraryFile(new File(['legacy file'], 'copy.png', { type: 'image/png' }));
  const legacyDocument = globalThis.assetDocuments.get(legacy), originalKey = legacyDocument.assets[0].key;
  const legacyKey = `users/${globalThis.assetOwner.uid}/projects/${legacy}/source/legacy.png`;
  globalThis.assetObjects.set(legacyKey, globalThis.assetObjects.get(originalKey));globalThis.assetObjects.delete(originalKey);
  legacyDocument.assets[0].key = legacyKey;legacyDocument.r2.source = [legacyKey];
  await api.deleteAsset(legacy, { name: 'legacy.png', kind: 'Image', key: legacyKey });
  assert.equal(globalThis.assetDocuments.has(legacy), false);assert.equal(globalThis.assetDocuments.has(legacyCopy), false);
  console.log('PASS Legacy un-hashed uploads and matching modern copies are deleted together');
} finally { await unlink(output); win.happyDOM.abort(); }
