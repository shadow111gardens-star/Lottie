import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { PNG } from 'pngjs';
import { VTracerWorker } from './vtracer-worker.mjs';
const win = new Window({ url: 'http://localhost/dashboard' });
for (const key of ['document','navigator','HTMLElement','SVGElement','Element','Node','Event','localStorage','DOMParser','FileReader']) Object.defineProperty(globalThis,key,{value:win[key],configurable:true});
globalThis.window=win; globalThis.IS_REACT_ACT_ENVIRONMENT=true; globalThis.Worker=VTracerWorker;
// Decode dimensions from the actual PNG; happy-dom does not decode image pixels.
globalThis.Image=class { set src(value) { const png=PNG.sync.read(Buffer.from(value.split(',')[1],'base64')); this.naturalWidth=png.width; this.naturalHeight=png.height; queueMicrotask(()=>this.onload()); } };
let downloaded;
const originalCreate=URL.createObjectURL; const originalRevoke=URL.revokeObjectURL;
URL.createObjectURL=blob=>{downloaded=blob;return 'blob:png-test';}; URL.revokeObjectURL=()=>{};
const output=new URL('./.png-svg-ui.mjs',import.meta.url);
const bundle=await build({stdin:{contents:'export { default as Workspace } from "./src/projects/PngToSvg"; export { default as Editor } from "./src/Editor";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},write:false,define:{'import.meta.env.BASE_URL':'"/"'},plugins:[{name:'project-boundary',setup(build){
 build.onResolve({filter:/projects\/store$/},()=>({path:'store',namespace:'test'}));
 build.onResolve({filter:/^firebase\/auth$/},()=>({path:'firebase-auth',namespace:'test'}));
 build.onResolve({filter:/lib\/firebase$/},()=>({path:'auth',namespace:'test'}));
 build.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='firebase-auth'?'export function onAuthStateChanged(auth,callback){queueMicrotask(()=>callback(auth.currentUser));return ()=>{}}':args.path==='auth'?'export function getFirebaseAuth(){return {currentUser:{uid:"test-user"}}}':'export async function uploadLibraryFile(file){globalThis.libraryUploads=(globalThis.libraryUploads||[]).concat(file.name);return "uploaded-file";}export async function createProject(name,scene){globalThis.createdScene=scene; return "new-png-test";} export function localProject(id){return {id,owner:"test-user",scene:globalThis.createdScene};} export async function loadProject(){return globalThis.createdScene;} export async function saveProject(id,scene){globalThis.savedScene=scene;} export async function preserveDraft(){} export async function frameSvg(){}'}));
}}]});
await writeFile(output,bundle.outputFiles[0].text);
const React=await import('react');const {createRoot}=await import('react-dom/client');const {MemoryRouter,Routes,Route}=await import('react-router-dom');
let root;
try {
 const {Workspace,Editor}=await import(output.href);const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await React.act(async()=>root.render(React.createElement(MemoryRouter,{initialEntries:['/dashboard']},React.createElement(Routes,null,React.createElement(Route,{path:'/dashboard',element:React.createElement(Workspace)}),React.createElement(Route,{path:'/editor/:projectId',element:React.createElement(Editor)})))));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 assert.equal(button('Convert to SVG').disabled,true);
 const pixels=Buffer.alloc(24*24*4);for(let i=0;i<576;i++)pixels.set(i%24<12?[255,0,0,255]:[0,0,255,255],i*4);
 const file=new win.File([PNG.sync.write({width:24,height:24,data:pixels})],'colors.png',{type:'image/png'});
 const input=host.querySelector('input');Object.defineProperty(input,'files',{value:[file],configurable:true});
 await React.act(async()=>{input.dispatchEvent(new win.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,60));});
 assert.deepEqual(globalThis.libraryUploads,['colors.png'],'PNG is saved to library before conversion or editor navigation');
 assert.ok(host.querySelector('img[alt="Uploaded PNG"]'));assert.equal(button('Convert to SVG').disabled,false);
 await React.act(async()=>button('Convert to SVG').click());
 for(let attempt=0;attempt<100&&!host.querySelector('img[alt="Generated SVG"]');attempt++)await React.act(async()=>{await new Promise(r=>setTimeout(r,30));});
 const svg=decodeURIComponent(host.querySelector('img[alt="Generated SVG"]').src.split(',')[1]);
 assert.match(svg,/<path/);assert.doesNotMatch(svg,/<image|data:image/);assert.equal(new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('parsererror'),null);
 await React.act(async()=>host.querySelector('button[aria-label="Zoom in"]').click());assert.equal(host.querySelector('.png-preview-canvas').style.width,'125%');
 await React.act(async()=>host.querySelector('button[aria-label="Reset zoom"]').click());assert.equal(host.querySelector('.png-preview-canvas').style.width,'100%');
 await React.act(async()=>button('Download SVG').click());assert.equal(await downloaded.text(),svg);
 await React.act(async()=>button('Open in Editor').click());assert.ok(host.querySelector('.ke-canvas-area'),'The existing editor opens');assert.ok(host.querySelector('.ke-canvas-area path'),'The editor renders vector paths');
 assert.equal(globalThis.createdScene.layers.length,2);assert.ok(globalThis.createdScene.layers.every(layer=>layer.type==='path'&&!layer.sourceFrame));
 assert.equal(globalThis.createdScene.files.source.length,1,'Converted PNG retains original image in user assets');
 console.log('PASS PNG upload, real shipped VTracer/WASM, actual SVG preview markup, valid SVG download, new-project scene and existing editor route');
}finally{if(root)await React.act(async()=>root.unmount());await unlink(output);await win.happyDOM.abort();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
