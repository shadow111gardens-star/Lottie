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
let entitlement=null,ok=true,responseStatus=200,deferred=null,mounts=0,calls=0,navigate;
globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/entitlement');assert.equal(options.cache,'no-store');assert.match(options.headers.Authorization,/^Bearer /);calls++;if(deferred)return deferred;return {ok,status:responseStatus,json:async()=>({entitlement})};};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 const{Gate}=await import(output.href);
 const Content=()=>{React.useEffect(()=>{mounts++;},[]);return React.createElement('div',{className:'protected-content'},'Workspace');};
 const Harness=()=>{navigate=useNavigate();return React.createElement(Routes,null,...['/','/privacy','/terms'].map(path=>React.createElement(Route,{key:path,path,element:React.createElement('div',{className:'public-content'},'Public page')})),...['/dashboard','/editor','/editor/:id','/projects/:id'].map(path=>React.createElement(Route,{key:path,path,element:React.createElement(Gate,{pricing:React.createElement('section',{id:'pricing'},React.createElement('button',null,'Choose Pro'),React.createElement('button',null,'Choose Lifetime'))},React.createElement(Content))})));};
 let renderCount=0;
 const render=async path=>React.act(async()=>{root.render(React.createElement(MemoryRouter,{key:++renderCount,initialEntries:[path]},React.createElement(Harness)));await pause(10);});
 const gated=()=>{assert.ok(host.querySelector('[role="dialog"]'));assert.equal(host.querySelector('.protected-content'),null);assert.equal(host.querySelector('[aria-label="Close"]'),null);const preview=host.querySelector('.paid-access-preview');assert.ok(preview);assert.ok(preview.hasAttribute('inert'));assert.equal(preview.getAttribute('aria-hidden'),'true');assert.match(preview.textContent,/All projects/);};
 for(const path of ['/','/privacy','/terms']){await render(path);assert.ok(host.querySelector('.public-content'));assert.equal(host.querySelector('[role="dialog"]'),null);assert.equal(calls,0);}
 for(const path of ['/dashboard','/editor','/editor/project-123','/projects/project-123']){await render(path);gated();assert.equal(mounts,0);}
 await React.act(async()=>host.querySelector('[role="dialog"]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));gated();
 await React.act(async()=>host.querySelector('.paid-access-backdrop').click());gated();
 await React.act(async()=>navigate('/editor/bypass-attempt'));gated();assert.equal(mounts,0);
 entitlement={plan:'pro',active:false,lifetime:false};await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});gated();
 for(const invalid of [{plan:'free',active:true},{plan:'pro',active:'true'},{plan:'pro',active:true},{plan:'pro',active:true,subscriptionStatus:'cancelled'},{plan:'pro',active:true,subscriptionStatus:'expired'},{plan:'pro',active:true,subscriptionStatus:'past_due'},{plan:'lifetime',active:true,lifetime:false}]){entitlement=invalid;await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});gated();}
 for (const code of [401,500]) { ok=false;responseStatus=code;await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});gated();assert.match(host.textContent,/Retrying/); }
 responseStatus=200;
 ok=true;entitlement={plan:'pro',active:true,lifetime:false,subscriptionStatus:'active'};await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});assert.ok(host.querySelector('.protected-content'));assert.equal(host.querySelector('[role="dialog"]'),null);
 entitlement=null;await render('/dashboard');gated();const callsBefore=calls;
 entitlement={plan:'lifetime',active:true,lifetime:true};await React.act(async()=>{await pause(2100);});assert.ok(calls>callsBefore,'Poll even without a checkout return query');assert.ok(host.querySelector('.protected-content'));assert.equal(host.querySelector('[role="dialog"]'),null);
 let complete;deferred=new Promise(resolve=>{complete=resolve;});entitlement=null;await render('/editor/slow-account');gated();
 deferred=null;
 await React.act(async()=>{globalThis.gateUser={uid:'different-user',getIdToken:async()=> 'other-token'};for(const listener of globalThis.gateAuthListeners)listener(globalThis.gateUser);await pause(10);});gated();
 await React.act(async()=>{complete({ok:true,json:async()=>({entitlement:{plan:'pro',active:true}})});await pause(10);});gated();

 // Back/Forward/BFCache restores must discard even a previously confirmed paid snapshot.
 entitlement={plan:'pro',active:true,lifetime:false,subscriptionStatus:'active'};
 await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});assert.ok(host.querySelector('.protected-content'));
 await React.act(async()=>window.dispatchEvent(new win.Event('pagehide')));gated();
 entitlement=null;
 await React.act(async()=>{const event=new win.Event('pageshow');Object.defineProperty(event,'persisted',{value:true});window.dispatchEvent(event);await pause(10);});gated();
 for(const plan of ['pro','lifetime'])for(const state of ['back','forward','cancelled','closed','failed','abandoned','processing']){
   window.history.replaceState(null,'',`/dashboard?checkout=${state}&checkout_plan=${plan}&success=true&session_id=tracking-only&plan=lifetime`);
   window.localStorage.setItem('plan','lifetime');window.sessionStorage.setItem('active','true');
   await React.act(async()=>{window.dispatchEvent(new win.Event('popstate'));await pause(5);});gated();
 }
 entitlement={plan:'pro',active:true,subscriptionStatus:'active',lifetime:false};
 await React.act(async()=>{window.dispatchEvent(new win.Event('focus'));await pause(10);});assert.ok(host.querySelector('.protected-content'));
 // A route change must not reuse the previous route's paid confirmation while request is pending.
 let finishRoute;deferred=new Promise(resolve=>{finishRoute=resolve;});await React.act(async()=>navigate('/editor/revalidate-paid'));gated();
 deferred=null;await React.act(async()=>{finishRoute({ok:true,json:async()=>({entitlement:null})});await pause(10);});gated();
 // Logout removes access and stale entitlement, restoring public UI only.
 await React.act(async()=>{globalThis.gateUser=null;for(const listener of globalThis.gateAuthListeners)listener(null);await pause(10);});assert.equal(host.querySelector('[role="dialog"]'),null);
 assert.equal(window.localStorage.getItem('plan'),'lifetime','Storage claims remain irrelevant');
 await React.act(async()=>{globalThis.gateUser={uid:'unpaid-user',getIdToken:async()=> 'test-only-token'};});await render('/dashboard');
 await React.act(async()=>{for(const listener of globalThis.gateAuthErrors)listener(new Error('Auth unavailable'));await pause(10);});assert.ok(host.querySelector('[role="alert"]'));assert.equal(host.querySelector('.protected-content'),null);
 const app=await readFile('src/App.tsx','utf8');assert.match(app,/<GoogleSignInProvider><Routes>/);for(const path of ['/dashboard','/editor','/editor/:projectId'])assert.ok(app.includes(`path="${path}" element={<PaidAccessGate`));assert.match(app,/path="\/" element=\{<LandingPage/);
 console.log('PASS unpaid direct URLs/refresh/navigation, no protected mounts, ESC/backdrop blocking, inactive/malformed/error fail-closed, confirmed Pro/Lifetime unlock, automatic webhook polling, and public landing/legal routes with protected workspace boundaries');
}finally{await React.act(async()=>root.unmount());globalThis.fetch=originalFetch;await unlink(output);await win.happyDOM.abort();delete globalThis.gateUser;delete globalThis.gateAuthListeners;delete globalThis.gateAuthErrors;}
