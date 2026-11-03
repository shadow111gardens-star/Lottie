import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost:5173/' });
globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(Date.now()),16);globalThis.cancelAnimationFrame=clearTimeout;
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'Event']) Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const calls = [];
let settle;
globalThis.authPopupTest = (auth, provider) => { calls.push({ auth, provider }); return new Promise((resolve, reject) => { settle = { resolve, reject }; }); };
const file = new URL('./.google-auth.mjs', import.meta.url);
const bundle = await build({
  stdin: { contents: 'export * from "./src/auth/GoogleSignIn"; export { setAuth } from "./src/lib/firebase"; export { Navbar } from "./src/SiteChrome";', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  plugins: [{ name: 'firebase-popup-test', setup(build) {
    build.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: 'config', namespace: 'auth-test' }));
    build.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'sdk', namespace: 'auth-test' }));
    build.onLoad({ filter: /.*/, namespace: 'auth-test' }, args => ({ contents: args.path === 'config'
      ? 'export let auth = { name: "test-auth" }; export function setAuth(value) { auth = value; } export function getFirebaseAuth() { if (!auth) throw new Error("Firebase app configuration is missing."); return auth; }'
      : 'export class GoogleAuthProvider { providerId = "google.com"; setCustomParameters(params) { this.params = params; } } export const signInWithPopup = (...args) => globalThis.authPopupTest(...args);' }));
  } }],
});
await writeFile(file, bundle.outputFiles[0].text);
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const host = document.createElement('div'); document.body.append(host);
const root = createRoot(host);
try {
  const api = await import(file.href);
  const labels = ['Start creating', 'Get access', 'Continue with Google'];
  const render = async key => React.act(async () => root.render(React.createElement(MemoryRouter, { key, initialEntries: ['/'] }, React.createElement(api.GoogleSignInProvider, null, React.createElement(Routes, null,
    React.createElement(Route, { path: '/', element: React.createElement('div', null, ...labels.map(label => React.createElement(api.GoogleSignInButton, { key: label, className: 'existing-design' }, label))) }),
    React.createElement(Route, { path: '/dashboard', element: React.createElement('div', null, 'Signed-in dashboard') })) ))));
  const click = async button => React.act(async () => button.dispatchEvent(new win.MouseEvent('click', { bubbles: true })));
  for (const label of labels) {
    await render(label);
    await click([...host.querySelectorAll('button')].find(button => button.textContent === label));
    assert.equal(calls.at(-1).provider.providerId, 'google.com');
    assert.equal(calls.at(-1).provider.params.prompt, 'select_account');
    assert.ok([...host.querySelectorAll('button')].every(button => button.disabled));
    const count = calls.length;
    await click(host.querySelector('button')); assert.equal(calls.length, count);
    await React.act(async () => settle.resolve({ user: { uid: 'test-user' } }));
    assert.equal(host.textContent, 'Signed-in dashboard');
  }
  // Exercise the real shared desktop/mobile header rather than only a test button.
  for(const mobile of [false,true]){
    await React.act(async()=>root.render(React.createElement(MemoryRouter,{key:`header-${mobile}`,initialEntries:['/']},React.createElement(api.GoogleSignInProvider,null,React.createElement(Routes,null,
      React.createElement(Route,{path:'/',element:React.createElement(api.Navbar,{about:true})}),
      React.createElement(Route,{path:'/dashboard',element:React.createElement('div',null,'Header reached Dashboard')}))))));
    if(mobile)await click(host.querySelector('[aria-label="Open navigation"]'));
    const area=host.querySelector(mobile?'#site-mobile-navigation':'nav');
    const button=[...area.querySelectorAll('button')].find(button=>button.textContent.trim()==='Get access');
    const before=calls.length;await click(button);
    assert.equal(calls.length,before+1,'Header click calls Firebase popup immediately');
    assert.match(host.textContent,/Opening Google/);
    await React.act(async()=>settle.resolve({user:{uid:'header-user'}}));
    assert.equal(host.textContent,'Header reached Dashboard');
  }
  // A slow post-login Free/checkout request must not disable Get access indefinitely.
  let releaseAfter;
  const waitingAfter=new Promise(resolve=>{releaseAfter=resolve;});
  const AfterLogin=()=>{const login=api.useGoogleSignIn();return React.createElement(React.Fragment,null,
    React.createElement('button',{id:'after-login',onClick:()=>login.signIn(()=>waitingAfter)},'Choose Free'),
    React.createElement(api.GoogleSignInButton,{className:'header-access'},'Get access'));};
  await React.act(async()=>root.render(React.createElement(MemoryRouter,{key:'after-login'},React.createElement(api.GoogleSignInProvider,null,React.createElement(AfterLogin)))));
  await click(host.querySelector('#after-login'));
  await React.act(async()=>settle.resolve({user:{uid:'enrolling-user'}}));
  assert.equal(host.querySelector('.header-access').disabled,false,'Auth button recovers before downstream enrollment finishes');
  await click(host.querySelector('.header-access'));
  assert.equal(host.querySelector('.header-access').disabled,true);
  await React.act(async()=>releaseAfter());
  assert.equal(host.querySelector('.header-access').disabled,true,'An old callback cannot clear a newer sign-in attempt');
  await React.act(async()=>settle.resolve({user:{uid:'next-account'}}));
  assert.equal(host.querySelector('.header-access').disabled,false);
  await render('failure'); await click(host.querySelector('button'));
  await React.act(async () => settle.reject({ code: 'auth/invalid-api-key' }));
  assert.match(host.querySelector('[role="alert"]').textContent, /API key is invalid/);
  assert.equal(host.querySelector('button').disabled, false);
  await render('cancel'); await click(host.querySelector('button'));
  await React.act(async () => settle.reject({ code: 'auth/popup-closed-by-user' }));
  assert.equal(host.querySelector('[role="alert"]'), null);
  await render('missing'); api.setAuth(null); await click(host.querySelector('button'));
  assert.match(host.querySelector('[role="alert"]').textContent, /configuration is missing/);
  const source = (await readFile('src/App.tsx', 'utf8')) + (await readFile('src/SiteChrome.tsx', 'utf8'));
  assert.equal((source.match(/<GoogleSignInButton className=/g) ?? []).length, 4);
  api.setAuth({currentUser:{uid:'account-one'}});
  await React.act(async()=>root.render(React.createElement(MemoryRouter,{key:'switch-accounts'},React.createElement(api.GoogleSignInProvider,null,React.createElement(api.GoogleAccountSwitchButton)))));
  const beforeSwitch=calls.length;
  for(const uid of ['account-two','account-one']){
    await click(host.querySelector('button'));
    assert.equal(calls.at(-1).provider.params.prompt,'select_account');
    assert.equal(calls.at(-1).provider.params.login_hint,undefined,'No account hint suppresses the chooser');
    await React.act(async()=>settle.resolve({user:{uid}}));
  }
  assert.equal(calls.length,beforeSwitch+2,'Each Switch account action opens a fresh Google chooser');
  console.log('PASS Google provider, pending state, duplicate-click protection, success navigation, invalid config and popup cancellation; desktop/mobile sign-in entry points');
} finally { await React.act(async () => root.unmount()); await unlink(file); await win.happyDOM.abort(); delete globalThis.authPopupTest; }
