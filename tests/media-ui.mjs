import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {PNG} from 'pngjs';
import {GifWriter} from 'omggif';
import {editorStorageMock} from './editor-storage-mock.mjs';
import {VTracerWorker} from './vtracer-worker.mjs';
const win=new Window({url:'http://localhost:5173/editor/new-media',width:1440,height:900});
for(const key of ['document','navigator','HTMLElement','HTMLInputElement','SVGElement','Element','Node','Event','localStorage','File']) Object.defineProperty(globalThis,key,{value:win[key],configurable:true});
globalThis.window=win;globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.DOMParser=win.DOMParser;globalThis.FileReader=win.FileReader;globalThis.Worker=VTracerWorker;
let now=0,id=0;const callbacks=new Map();
globalThis.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
win.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{canvas.pixels=image.data.slice();}};};
win.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,'+PNG.sync.write({width:this.width,height:this.height,data:Buffer.from(this.pixels)}).toString('base64');};
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');const {MemoryRouter,Routes,Route}=await import('react-router-dom');
const out=new URL('./.media-ui.mjs',import.meta.url);
const bundle=await build({entryPoints:['src/Editor.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},write:false,plugins:[editorStorageMock],define:{'import.meta.env.BASE_URL':'"/"'}});await writeFile(out,bundle.outputFiles[0].text);
const Editor=(await import(out.href)).Workspace;
const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
const gif=delays=>{const b=Buffer.alloc(1000),w=new GifWriter(b,1,1,{palette:[0xff0000,0x00ff00,0x0000ff,0xffffff]});delays.forEach((delay,i)=>w.addFrame(0,0,1,1,[i],{delay}));return b.subarray(0,w.end());};
const click=el=>act(async()=>el.dispatchEvent(new win.MouseEvent('click',{bubbles:true,button:0})));
try {
 await act(async()=>root.render(React.createElement(MemoryRouter,{initialEntries:['/editor/new-media']},React.createElement(Routes,null,React.createElement(Route,{path:'/editor/:projectId',element:React.createElement(Editor,{projectId:'new-media',initial:{version:1,name:'Untitled scene',width:1000,height:700,duration:6,background:'#ffffff',clip:true,layers:[]}})})))));
 await click(document.querySelector('[aria-label="Import"]'));
 await click([...document.querySelectorAll('[role="menuitem"]')].find(el=>el.textContent.includes('Import video')));
 const input=document.querySelector('input[type="file"]');assert.ok(input.accept.includes('image/gif'));
 const upload=async bytes=>{Object.defineProperty(input,'files',{value:[new win.File([bytes],'source.gif',{type:'image/gif'})],configurable:true});await act(async()=>{input.dispatchEvent(new win.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,250));});};
 await upload(gif([7,0,13]));
 const buttons=[...document.querySelectorAll('.ke-media-frames button')];assert.equal(buttons.length,3);
 for(let i=0;i<buttons.length;i++) {await click(buttons[i]);assert.equal(document.querySelector('[aria-label="Animation canvas"] image'),null);assert.ok(document.querySelector('[aria-label="Animation canvas"] path'));assert.equal(buttons[i].getAttribute('aria-pressed'),'true');}
 await click(buttons[0]);await click(document.querySelector('[aria-label="Start playback"]'));
 await act(async()=>{now=90;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(cb=>cb(now));});
 assert.equal(document.querySelector('[aria-label="Animation canvas"] image'),null);assert.ok(document.querySelector('[aria-label="Animation canvas"] path'));
 await click(document.querySelector('[aria-label="Pause playback"]'));
 await upload(gif([1001]));assert.ok(document.body.textContent.includes('10 seconds or shorter'));assert.equal(document.querySelectorAll('.ke-media-frames button').length,3);
 console.log('PASS Media upload UI, all thumbnails, exact zero-delay frame selection, variable timing playback, rejected import preserves project');
} finally {await act(async()=>root.unmount());await unlink(out);win.happyDOM.abort();}
