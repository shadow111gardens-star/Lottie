import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/dashboard' });
for (const key of ['document','navigator','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent']) Object.defineProperty(globalThis,key,{value:win[key],configurable:true});
globalThis.window=win;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.gateUser={uid:'unpaid-user',getIdToken:async()=> 'test-only-token'};
globalThis.gateAuthListeners=new Set();
const output=new URL(`./.paid-access-${process.pid}.mjs`,import.meta.url);
const bundle=await build({stdin:{contents:'export {default as Gate} from "./src/auth/PaidAccessGate";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},write:false,plugins:[{name:'auth-boundary',setup(build){
 build.onResolve({filter:/lib\/firebase$/},()=>({path:'firebase',namespace:'gate-test'}));
 build.onResolve({filter:/^firebase\/auth$/},()=>({path:'auth',namespace:'gate-test'}));
 build.onLoad({filter:/.*/,namespace:'gate-test'},args=>({contents:args.path==='firebase'?'export function getFirebaseAuth(){return {currentUser:globalThis.gateUser};}':'export function onAuthStateChanged(auth,callback){globalThis.gateAuthListeners.add(callback);queueMicrotask(()=>callback(globalThis.gateUser));return ()=>globalThis.gateAuthListeners.delete(callback);}' }));
}}]});await writeFile(output,bundle.outputFiles[0].text);
const React=await import('react');const{createRoot}=await import('react-dom/client');const{MemoryRouter,Routes,Route,useNavigate}=await import('react-router-dom');
const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
const originalFetch=globalThis.fetch;
let entitlement=null,ok=true,deferred=null,mounts=0,calls=0,navigate;
globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/entitlement');assert.equal(options.cache,'no-store');assert.match(options.headers.Authorization,/^Bearer /);calls++;if(deferred)return deferred;return {ok,json:async()=>({entitlement})};};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 const{Gate}=await import(output.href);
 const Content=()=>{React.useEffect(()=>{mounts++;},[]);return React.createElement('div',{className:'protected-content'},'Workspace');};
 const Harness=()=>{navigate=useNavigate();return React.createElement(Gate,{pricing:React.createElement('section',{id:'pricing'},React.createElement('button',null,'Choose Pro'),React.createElement('button',null,'Choose Lifetime'))},React.createElement(Routes,null,...['/','/dashboard','/editor','/editor/:id','/projects/:id'].map(path=>React.createElement(Route,{key:path,path,element:React.createElement(Content)}))));};
 let renderCount=0;
 const render=async path=>React.act(async()=>{root.render(React.createElement(MemoryRouter,{key:++renderCount,initialEntries:[path]},React.createElement(Harness)));await pause(10);});
 const gated=()=>{assert.ok(host.querySelector('[role="dialog"]'));assert.equal(host.querySelector('.protected-content'),null);assert.equal(host.querySelector('[aria-label="Close"]'),null);};
 for(const path of ['/dashboard','/editor','/editor/project-123','/projects/project-123','/']){await render(path);gated();assert.equal(mounts,0);}
 await React.act(async()=>host.querySelector('[role="dialog"]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));gated();
 await React.act(async()=>host.querySelector('.paid-access-backdrop').click());gated();
 await React.act(async()=>navigate('/editor/bypass-attempt'));gated();assert.equal(mounts,0);
 entitlement={plan:'pro',active:false,lifetime:false};await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});gated();
 for(const invalid of [{plan:'free',active:true},{plan:'pro',active:'true'}]){entitlement=invalid;await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});gated();}
 ok=false;await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});gated();assert.match(host.textContent,/Retrying/);
 ok=true;entitlement={plan:'pro',active:true,lifetime:false};await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});assert.ok(host.querySelector('.protected-content'));assert.equal(host.querySelector('[role="dialog"]'),null);
 entitlement=null;await render('/dashboard');gated();const callsBefore=calls;
 entitlement={plan:'lifetime',active:true,lifetime:true};await React.act(async()=>{await pause(2100);});assert.ok(calls>callsBefore,'Poll even without a checkout return query');assert.ok(host.querySelector('.protected-content'));assert.equal(host.querySelector('[role="dialog"]'),null);
 let complete;deferred=new Promise(resolve=>{complete=resolve;});entitlement=null;await render('/editor/slow-account');gated();
 deferred=null;
 await React.act(async()=>{globalThis.gateUser={uid:'different-user',getIdToken:async()=> 'other-token'};for(const listener of globalThis.gateAuthListeners)listener(globalThis.gateUser);await pause(10);});gated();
 await React.act(async()=>{complete({ok:true,json:async()=>({entitlement:{plan:'pro',active:true}})});await pause(10);});gated();
 const app=await readFile('src/App.tsx','utf8');assert.match(app,/<PaidAccessGate pricing=\{<Pricing \/>\}><Routes>/);assert.match(app,/<\/Routes><\/PaidAccessGate>/);
 console.log('PASS unpaid direct URLs/refresh/navigation, no protected mounts, ESC/backdrop blocking, inactive/malformed/error fail-closed, confirmed Pro/Lifetime unlock, automatic webhook polling, and global route boundary');
}finally{await React.act(async()=>root.unmount());globalThis.fetch=originalFetch;await unlink(output);await win.happyDOM.abort();delete globalThis.gateUser;delete globalThis.gateAuthListeners;}
