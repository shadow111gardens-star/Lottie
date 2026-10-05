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
export function updateDoc(){}export function deleteDoc(){}`,
  storage: `export async function currentOwner(){return globalThis.assetOwner;}export function assertOwner(user){if(user.uid!==globalThis.assetOwner?.uid)throw Error('Account changed');}
export function prefix(user,id){return 'users/'+user.uid+'/projects/'+id+'/';}export async function digest(blob){return globalThis.assetDigest(blob);}
export async function dataUrl(blob){return 'data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');}
export async function upload(user,id,path,blob){const key=prefix(user,id)+path;globalThis.assetObjects.set(key,blob);return key;}
export async function assetBlob(user,id,key){assertOwner(user);return globalThis.assetObjects.get(key);}
export async function storageRequest(user,id){return {json:async()=>({keys:[...globalThis.assetObjects.keys()].filter(key=>key.startsWith(prefix(user,id)+'source/'))})};}`,
};
const bundle = await build({ stdin: { contents: 'export {uploadLibraryFile,createProject,saveProject,readProjects,readUploadedAssets} from "./src/projects/store";export {initialScene} from "./src/editor/model";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false, plugins: [{ name: 'upload-boundary', setup(build) {
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
} finally { await unlink(output); win.happyDOM.abort(); }
