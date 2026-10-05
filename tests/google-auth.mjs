import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost:5173/' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event']) Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const calls = [];
let settle;
globalThis.authPopupTest = (auth, provider) => { calls.push({ auth, provider }); return new Promise((resolve, reject) => { settle = { resolve, reject }; }); };
const file = new URL('./.google-auth.mjs', import.meta.url);
const bundle = await build({
  stdin: { contents: 'export * from "./src/auth/GoogleSignIn"; export { setAuth } from "./src/lib/firebase";', resolveDir: process.cwd() },
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
  await render('failure'); await click(host.querySelector('button'));
  await React.act(async () => settle.reject({ code: 'auth/invalid-api-key' }));
  assert.match(host.querySelector('[role="alert"]').textContent, /API key is invalid/);
  assert.equal(host.querySelector('button').disabled, false);
  await render('cancel'); await click(host.querySelector('button'));
  await React.act(async () => settle.reject({ code: 'auth/popup-closed-by-user' }));
  assert.equal(host.querySelector('[role="alert"]'), null);
  await render('missing'); api.setAuth(null); await click(host.querySelector('button'));
  assert.match(host.querySelector('[role="alert"]').textContent, /configuration is missing/);
  const source = await readFile('src/App.tsx', 'utf8');
  assert.equal((source.match(/<GoogleSignInButton className=/g) ?? []).length, 4);
  console.log('PASS Google provider, pending state, duplicate-click protection, success navigation, invalid config and popup cancellation; desktop/mobile sign-in entry points');
} finally { await React.act(async () => root.unmount()); await unlink(file); await win.happyDOM.abort(); delete globalThis.authPopupTest; }
