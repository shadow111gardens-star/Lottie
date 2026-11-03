import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/dashboard' });
for (const key of ['document','navigator','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent']) Object.defineProperty(globalThis,key,{value:win[key],configurable:true});
globalThis.window=win;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.gateUser={uid:'unpaid-user',getIdToken:async()=> 'test-only-token'};
globalThis.gateAuthListeners=new Set();globalThis.gateAuthErrors=new Set();
const output=new URL(`./.paid-access-${process.pid}.mjs`,import.meta.url);
const bundle=await build({stdin:{contents:'export {default as Gate} from "./src/auth/PaidAccessGate";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},write:false,plugins:[{name:'auth-boundary',setup(build){
 build.onResolve({filter:/lib\/firebase$/},()=>({path:'firebase',namespace:'gate-test'}));
 build.onResolve({filter:/^firebase\/auth$/},()=>({path:'auth',namespace:'gate-test'}));
 build.onLoad({filter:/.*/,namespace:'gate-test'},args=>({contents:args.path==='firebase'?'export function getFirebaseAuth(){return {currentUser:globalThis.gateUser};}':'export function onAuthStateChanged(auth,callback,onError){globalThis.gateAuthListeners.add(callback);globalThis.gateAuthErrors.add(onError);queueMicrotask(()=>callback(globalThis.gateUser));return ()=>{globalThis.gateAuthListeners.delete(callback);globalThis.gateAuthErrors.delete(onError);};}' }));
}}]});await writeFile(output,bundle.outputFiles[0].text);
const React=await import('react');const{createRoot}=await import('react-dom/client');const{MemoryRouter,Routes,Route,useNavigate}=await import('react-router-dom');
const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
const originalFetch=globalThis.fetch;
let trial=null,entitlement=null,ok=true,responseStatus=200,deferred=null,mounts=0,calls=0,navigate,starts=0,startFails=false;
globalThis.fetch=async(url,options)=>{
 assert.match(options.headers.Authorization,/^Bearer /);
 if(url==='/api/trial'){
   starts++;assert.deepEqual(JSON.parse(options.body),{action:'start'});
   if(startFails)return {ok:false,status:503,json:async()=>({error:'Free enrollment unavailable'})};
   trial={enabled:true,used:0,remaining:3,limit:3};
   return {ok:true,json:async()=>({trial})};
 }
 assert.equal(url,'/api/entitlement');assert.equal(options.cache,'no-store');calls++;
 if(deferred)return deferred;
 return {ok,status:responseStatus,json:async()=>({entitlement,trial})};
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 const{Gate}=await import(output.href);
 const Content=()=>{React.useEffect(()=>{mounts++;},[]);return React.createElement('div',{className:'protected-content'},'Workspace');};
 const Harness=()=>{navigate=useNavigate();return React.createElement(Routes,null,...['/','/privacy','/terms'].map(path=>React.createElement(Route,{key:path,path,element:React.createElement('div',{className:'public-content'},'Public page')})),...['/dashboard','/editor','/editor/:id','/projects/:id'].map(path=>React.createElement(Route,{key:path,path,element:React.createElement(Gate,{pricing:React.createElement('section',{id:'pricing'},React.createElement('button',null,'Choose Pro'),React.createElement('button',null,'Choose Lifetime'))},React.createElement(Content))})));};
 let renderCount=0;
 const render=async path=>React.act(async()=>{root.render(React.createElement(MemoryRouter,{key:++renderCount,initialEntries:[path]},React.createElement(Harness)));await pause(10);});
 const noPopup=()=>assert.equal(host.querySelector('[role="dialog"]'),null,'No automatic pricing popup');
 const workspace=()=>{assert.ok(host.querySelector('.protected-content'));noPopup();};
 const upgrade=async()=>React.act(async()=>window.dispatchEvent(new win.Event('vekto-upgrade-open')));
 const wait=async(ms=30)=>React.act(async()=>{await pause(ms);});
 for(const path of ['/','/privacy','/terms']){await render(path);assert.ok(host.querySelector('.public-content'));noPopup();assert.equal(calls,0);}
 // Initial server validation and enrollment never show pricing or mount an unverified workspace.
 let finish;deferred=new Promise(resolve=>{finish=resolve;});await render('/dashboard');
 noPopup();assert.equal(host.querySelector('.protected-content'),null);assert.equal(mounts,0);
 deferred=null;await React.act(async()=>{finish({ok:true,json:async()=>({entitlement:null,trial:null})});await pause(40);});
 await wait();workspace();assert.equal(starts,1,'New account enrolls in Free once');
 for(const path of ['/dashboard','/editor','/editor/project-123','/projects/project-123']){await render(path);await wait();workspace();}
 // Upgrade is explicit, traps interaction behind it, and is dismissible.
 await upgrade();assert.ok(host.querySelector('[role="dialog"]'));
 assert.ok(host.querySelector('.paid-access-workspace').hasAttribute('inert'));
 await React.act(async()=>host.querySelector('[role="dialog"]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));workspace();
 await upgrade();await React.act(async()=>host.querySelector('.paid-access-backdrop').dispatchEvent(new win.MouseEvent('pointerdown',{bubbles:true})));workspace();
 await upgrade();await React.act(async()=>host.querySelector('[aria-label="Close upgrade plans"]').click());workspace();
 // Choosing Free in the popup closes it without checkout or another forced modal.
 await upgrade();await React.act(async()=>window.dispatchEvent(new win.Event('vekto-upgrade-close')));workspace();
 // Three used trials do not block existing projects or automatically open an upsell.
 trial={enabled:true,used:3,remaining:0,limit:3};
 await React.act(async()=>{window.dispatchEvent(new win.Event('vekto-access-changed'));await pause(20);});workspace();
 await React.act(async()=>navigate('/editor/existing-trial'));await wait();workspace();
 // An actual server-confirmed payment closes an explicitly opened upgrade automatically.
 for(const paid of [{plan:'pro',active:true,lifetime:false,subscriptionStatus:'active'},{plan:'lifetime',active:true,lifetime:true}]){
   entitlement=null;await React.act(async()=>{window.dispatchEvent(new win.Event('vekto-access-changed'));await pause(20);});
   await upgrade();assert.ok(host.querySelector('[role="dialog"]'));
   entitlement=paid;await wait(2100);workspace();assert.notEqual(document.body.style.overflow,'hidden');
 }
 // A transient refresh error keeps the last same-account server confirmation visible.
 ok=false;responseStatus=500;
 await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(20);});
 workspace();
 ok=true;responseStatus=200;
 await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(20);});workspace();
 // Failed new-account enrollment is recoverable and cannot unlock access.
 entitlement=null;trial=null;startFails=true;
 await React.act(async()=>{globalThis.gateUser={uid:'new-account',getIdToken:async()=> 'other-token'};for(const listener of globalThis.gateAuthListeners)listener(globalThis.gateUser);await pause(30);});
 noPopup();assert.equal(host.querySelector('.protected-content'),null);assert.match(host.textContent,/Free enrollment unavailable/);
 startFails=false;await React.act(async()=>{host.querySelector('button').click();await pause(30);});await wait();workspace();
 // A changed account cannot use a previous account's pending paid response.
 let complete;deferred=new Promise(resolve=>{complete=resolve;});
 await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});
 await React.act(async()=>{globalThis.gateUser=null;for(const listener of globalThis.gateAuthListeners)listener(null);await pause(10);});
 deferred=null;await React.act(async()=>{complete({ok:true,json:async()=>({entitlement:{plan:'pro',active:true,subscriptionStatus:'active'}})});await pause(10);});
 assert.equal(host.querySelector('.protected-content'),null);noPopup();assert.ok(host.querySelector('.public-content'));
 await render('/dashboard');noPopup();assert.equal(host.querySelector('.protected-content'),null);
 const app=await readFile('src/App.tsx','utf8');assert.match(app,/<GoogleSignInProvider><Routes>/);
 for(const path of ['/dashboard','/editor','/editor/:projectId'])assert.ok(app.includes(`path="${path}" element={<PaidAccessGate`));
 console.log('PASS Free dashboard without automatic plans, explicit Upgrade modal/open/close, server payment auto-close, account changes, initial verification, enrollment retry, used quota access and public routes');
}finally{await React.act(async()=>root.unmount());globalThis.fetch=originalFetch;await unlink(output);await win.happyDOM.abort();delete globalThis.gateUser;delete globalThis.gateAuthListeners;delete globalThis.gateAuthErrors;}
