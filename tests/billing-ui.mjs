import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';

const win = new Window({ url: 'http://localhost/dashboard?checkout=processing&checkout_plan=lifetime' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event']) Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.billingUser = { uid: 'billing-user', getIdToken: async () => 'verified-client-token' };
const output = new URL('./.billing-ui.mjs', import.meta.url);
const bundle = await build({ stdin: { contents: 'export * from "./src/lib/billing";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false, plugins: [{ name: 'billing-auth-boundary', setup(build) {
  build.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'billing-test' }));
  build.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'auth', namespace: 'billing-test' }));
  build.onLoad({ filter: /.*/, namespace: 'billing-test' }, args => ({ contents: args.path === 'firebase' ? 'export function getFirebaseAuth(){ return { currentUser: globalThis.billingUser }; }' : 'export function onAuthStateChanged(auth,callback){queueMicrotask(()=>callback(auth.currentUser));return ()=>{};}' }));
} }] });
await writeFile(output, bundle.outputFiles[0].text);
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const host = document.createElement('div'); document.body.append(host);
const root = createRoot(host);
const nativeFetch = globalThis.fetch;
let response = { entitlement: null };
const calls = [];
globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => response }; };
try {
  const api = await import(output.href);
  const View = () => { const billing = api.useEntitlement(); return React.createElement('span', null, billing.status); };
  await React.act(async () => { root.render(React.createElement(View)); await new Promise(resolve => setTimeout(resolve, 5)); });
  assert.match(host.textContent, /Payment processing/);
  assert.equal(calls.at(-1).url, '/api/entitlement');
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer verified-client-token');
  response = { entitlement: { plan: 'pro', active: true, lifetime: false, subscriptionStatus: 'active' } };
  await React.act(async () => { window.dispatchEvent(new win.Event('focus')); await new Promise(resolve => setTimeout(resolve, 5)); });
  assert.match(host.textContent, /Payment processing/, 'Existing Pro access does not confirm a pending Lifetime upgrade');
  response = { entitlement: { plan: 'lifetime', active: true, lifetime: true } };
  await React.act(async () => { window.dispatchEvent(new win.Event('focus')); await new Promise(resolve => setTimeout(resolve, 5)); });
  assert.equal(host.textContent, 'Lifetime \u00b7 Active');
  response = { entitlement: { plan: 'pro', active: false, lifetime: false } };
  window.history.replaceState(null, '', '/dashboard');
  await React.act(async () => { root.render(React.createElement(View, { key: 'normal-dashboard' })); await new Promise(resolve => setTimeout(resolve, 5)); });
  assert.equal(host.textContent, 'Pro \u00b7 Inactive');
  response = { checkoutUrl: 'https://checkout.dodopayments.com/test-only' };
  for (const plan of ['pro', 'lifetime']) {
    await React.act(async () => api.createCheckout(plan));
    assert.equal(calls.at(-1).url, '/api/checkout');
    assert.equal(calls.at(-1).options.method, 'POST');
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), { plan });
    assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer verified-client-token');
    assert.equal(window.location.href, response.checkoutUrl);
  }
  response = { checkoutUrl: 'http://unsafe.example.com' };
  await assert.rejects(api.createCheckout('pro'), /invalid URL/);
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'Please try again.' }) });
  await assert.rejects(api.createCheckout('lifetime'), /Please try again/);
  globalThis.billingUser = null;
  await assert.rejects(api.createCheckout('pro'), /Sign in/);
  console.log('PASS frontend checkout body/auth/redirect/errors, dashboard processing without optimistic activation, server entitlement refresh and inactive Pro display');
} finally {
  await React.act(async () => root.unmount()); globalThis.fetch = nativeFetch;
  await unlink(output); await win.happyDOM.abort(); delete globalThis.billingUser;
}
