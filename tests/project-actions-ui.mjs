import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/dashboard' });
for (const key of ['document', 'navigator', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'Event', 'localStorage']) Object.defineProperty(globalThis, key, { value: win[key], configurable: true });
globalThis.window = win; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const output = new URL('./.project-actions-ui.mjs', import.meta.url);
const bundle = await build({ stdin: { contents: 'export { default as Dashboard } from "./src/Dashboard"; export { default as Editor } from "./src/Editor"; export { initialScene } from "./src/editor/model"; export { stopProject } from "./src/projects/lifecycle";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, write: false, plugins: [{
  name: 'project-actions-network-boundary', setup(build) {
    build.onResolve({ filter: /projects\/store$/ }, () => ({ path: 'store', namespace: 'actions-test' }));
    build.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'actions-test' }));
    build.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'auth', namespace: 'actions-test' }));
    build.onLoad({ filter: /.*/, namespace: 'actions-test' }, args => ({ contents: args.path === 'firebase'
      ? 'export const auth={currentUser:{uid:"action-owner"}}; export function getFirebaseAuth(){return auth;}'
      : args.path === 'auth' ? 'export function onAuthStateChanged(auth,callback){queueMicrotask(()=>callback(auth.currentUser)); return ()=>{};} export async function signOut(){}'
        : `export const PROJECTS_CHANGED='kinetic-projects-changed';
export function createBlankProject(){globalThis.actionCreates++; return globalThis.actionProject;}
export function localProject(id){return globalThis.actionProject?.id===id?globalThis.actionProject:null;}
export async function loadProject(){throw new Error('New Project must never wait for a loader');}
export async function saveProject(){globalThis.actionSaves++; return new Promise(()=>{});} export async function preserveDraft(){}
export async function readProjects(){return {projects:globalThis.actionShowExisting?[{...globalThis.actionProject,type:"SVG",createdAt:null,editedAt:null,openedAt:null}]:[],invalid:0};} export function sortProjects(items){return items;}
export function editedLabel(){return '';} export async function createProject(){} export async function deleteProject(){}
export async function duplicateProject(){} export async function openProject(id,metadataOnly){globalThis.actionOpenMetadata=metadataOnly;return new Promise(()=>{});} export async function renameProject(){}
export async function restoreProject(){} export async function frameSvg(){}` }));
  },
}] });
await writeFile(output, bundle.outputFiles[0].text);
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
let root;
try {
  const api = await import(output.href);
  globalThis.actionCreates = 0;
  globalThis.actionSaves = 0;
  globalThis.actionProject = { id: 'new-instant-action', owner: 'action-owner', scene: { ...api.initialScene(), layers: [] } };
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await React.act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/dashboard'] }, React.createElement(Routes, null,
    React.createElement(Route, { path: '/dashboard', element: React.createElement(api.Dashboard) }),
    React.createElement(Route, { path: '/editor/:projectId', element: React.createElement(api.Editor) })))));
  globalThis.actionShowExisting=true;
  await React.act(async()=>{window.dispatchEvent(new win.Event('kinetic-projects-changed'));await new Promise(resolve=>setTimeout(resolve,10));});
  await React.act(async()=>host.querySelector('.pd-preview').click());
  assert.ok(host.querySelector('.ke-canvas-area'),'Open navigates before unresolved activity write');assert.equal(globalThis.actionOpenMetadata,true);
  globalThis.actionShowExisting=false;
  await React.act(async()=>[...host.querySelectorAll('a')].find(link=>link.textContent.trim()==='Workspace').click());
  console.log('PASS Existing project opens immediately while cloud activity write remains pending');
  await React.act(async () => {
    const button = [...host.querySelectorAll('button')].find(button => button.textContent.includes('New project'));
    button.click(); button.click(); button.click();
  });
  assert.equal(globalThis.actionCreates, 1);
  assert.ok(host.querySelector('.ke-canvas-area'), 'Blank editor renders while save promise is unresolved');
  assert.ok(!host.textContent.includes('Loading project'));
  await React.act(async () => api.stopProject('action-owner', 'new-instant-action'));
  assert.ok(host.querySelector('.pd-dashboard'), 'Deleting the open project immediately returns to dashboard');
  assert.ok(!host.querySelector('.ke-canvas-area'));
  assert.ok(!host.textContent.includes('Project access denied'));
  await React.act(async () => new Promise(resolve => setTimeout(resolve, 1300)));
  assert.equal(globalThis.actionSaves, 0, 'Deleting the open workspace cancels its pending autosave');
  console.log('PASS Actual New Project navigation, blank canvas without loader/network, rapid-click guard and open-project deletion navigation');
} finally {
  if (root) await React.act(async () => root.unmount());
  await unlink(output); await win.happyDOM.abort();
}
