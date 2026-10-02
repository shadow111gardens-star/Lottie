import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win = new Window({url:'http://localhost:5173/dashboard'});
for (const key of ['document','navigator','HTMLElement','SVGElement','Element','Node','Event','localStorage']) Object.defineProperty(globalThis,key,{value:win[key],configurable:true});
globalThis.window=win;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
win.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},getImageData(){return {data:new Uint8ClampedArray(4)};}});
const file=new URL('./.dashboard-preview.mjs',import.meta.url);
const bundle=await build({stdin:{contents:'export {default as Dashboard} from "./src/Dashboard"; export {importLottie} from "./src/editor/lottie"; export {initialScene} from "./src/editor/model";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},write:false,plugins:[{
 name:'cloud-dashboard-boundary',setup(build){
  build.onResolve({filter:/projects\/store$/},()=>({path:'store',namespace:'dashboard-test'}));
  build.onResolve({filter:/lib\/firebase$/},()=>({path:'firebase',namespace:'dashboard-test'}));
  build.onResolve({filter:/^firebase\/auth$/},()=>({path:'auth',namespace:'dashboard-test'}));
  build.onLoad({filter:/.*/,namespace:'dashboard-test'},args=>({contents:args.path==='firebase'?'export const auth={currentUser:{uid:"preview-user"}};export function getFirebaseAuth(){return auth;}':args.path==='auth'?'export function onAuthStateChanged(auth, callback){queueMicrotask(()=>callback({uid:"preview-user"}));return ()=>{};}export async function signOut(){}':`export const PROJECTS_CHANGED='kinetic-projects-changed';export async function readProjects(){return {projects:globalThis.previewProjects,invalid:0};}export function sortProjects(projects){return projects;}export function editedLabel(){return 'Edited just now';}export function createBlankProject(){globalThis.blankCreates=(globalThis.blankCreates||0)+1;return {id:"instant-blank"};}export async function createProject(){}export async function deleteProject(){}export async function duplicateProject(){}export async function openProject(){}export async function renameProject(){}export async function restoreProject(){}`}));
 }
}]});
await writeFile(file,bundle.outputFiles[0].text);
const React=await import('react');
const {createRoot}=await import('react-dom/client');
const {MemoryRouter}=await import('react-router-dom');
let root;
try {
 const api=await import(file.href);
 const {scene}=api.importLottie({v:'5.12.2',fr:30,ip:0,op:90,w:200,h:200,nm:'Lottie preview',assets:[],layers:[{ty:1,ind:1,nm:'Red solid',ip:0,op:90,st:0,sr:1,sw:100,sh:100,sc:'#ff0000',ks:{p:{k:[20,20]},a:{k:[0,0]},s:{k:[100,100]},r:{k:0},o:{k:100}}}]},'preview.json',{diagnostics:false});
 globalThis.previewProjects=[{id:'lottie',scene,type:'Animation',createdAt:Date.now(),editedAt:Date.now(),openedAt:null},{id:'native',scene:api.initialScene('Native preview'),type:'SVG',createdAt:Date.now(),editedAt:Date.now(),openedAt:null}];
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await React.act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement(api.Dashboard))));await new Promise(r=>setTimeout(r,30));});
 for(let i=0;i<30 && host.querySelectorAll('.pd-preview img').length<2;i++)await React.act(async()=>new Promise(r=>setTimeout(r,30)));
 assert.equal(host.querySelectorAll('.pd-card').length,2);
 assert.equal(host.querySelectorAll('.pd-preview img').length,2);
 const image=host.querySelector('[data-project-id="lottie"] img');
 assert.match(decodeURIComponent(image.src),/rgb\(255,0,0\)|#ff0000/i);
 assert.equal(document.querySelectorAll('body > div').length,1,'Offscreen renderers cleaned up');
 await React.act(async()=>{ const button=[...host.querySelectorAll('button')].find(button=>button.textContent.includes('New project')); button.click(); button.click(); button.click(); });
 assert.equal(globalThis.blankCreates,1,'Rapid clicks create only one project');
 console.log('PASS Instant local New Project handler rejects rapid duplicate clicks');
 console.log('PASS Dashboard renders Lottie and native thumbnails without crashing under StrictMode');
} finally {if(root)await React.act(async()=>root.unmount());await unlink(file);win.happyDOM.abort();}
