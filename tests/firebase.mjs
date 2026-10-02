import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { loadEnv } from 'vite';
import { Window } from 'happy-dom';

const configuredEnv = loadEnv('development', process.cwd());
for (const [name, env] of [
  ['configured', configuredEnv],
  ['Auth initialization error', configuredEnv],
  ['missing API key', { ...configuredEnv, VITE_FIREBASE_API_KEY: '' }],
  ['missing environment', {}],
]) {
  const window = new Window({
    url: 'http://localhost:5173/',
    settings: { enableJavaScriptEvaluation: true },
  });
  const errors = [];
  const diagnostics = [];
  // React's development build expects the native console APIs.
  window.console = { ...console, error: (...args) => diagnostics.push(args) };
  window.addEventListener('error', event => errors.push(event.message));
  window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  window.document.body.innerHTML = '<div id="root"></div>';
  try {
    const bundle = await build({
      stdin: {
        contents: 'import "./src/main.tsx"; import * as firebase from "./src/lib/firebase"; globalThis.firebaseCheck = firebase;',
        resolveDir: process.cwd(),
      },
      bundle: true, format: 'iife', platform: 'browser', write: false,
      plugins: name === 'Auth initialization error' ? [{
        name: 'simulate-auth-failure',
        setup(build) {
          build.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'auth', namespace: 'auth-failure' }));
          build.onLoad({ filter: /.*/, namespace: 'auth-failure' }, () => ({
            contents: 'export function getAuth() { throw new Error("Firebase: Error (auth/invalid-api-key)."); } export function onAuthStateChanged() { return () => {}; } export class GoogleAuthProvider {} export async function signInWithPopup() { throw new Error("Auth unavailable"); }',
          }));
        },
      }] : [],
      loader: { '.css': 'empty' },
      define: {
        'import.meta.env': JSON.stringify(env),
        'import.meta.hot': 'undefined',
        'process.env.NODE_ENV': '"development"',
      },
    });
    window.eval(bundle.outputFiles[0].text);
    for (let i = 0; i < 40 && !window.document.getElementById('root').children.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(window.document.getElementById('root').children.length, `${name}: app renders`);
    assert.deepEqual(errors, [], `${name}: no uncaught errors`);
    const firebase = window.firebaseCheck;
    if (name === 'configured') {
      assert.ok(firebase.auth);
      assert.ok(firebase.db);
      assert.equal(firebase.firebaseError, null);
      assert.equal(firebase.app.options.projectId, 'svgforge1');
    } else if (name === 'Auth initialization error') {
      assert.equal(firebase.auth, null);
      assert.ok(firebase.db, 'Auth failure does not disable Firestore initialization');
      assert.match(firebase.firebaseError.message, /auth\/invalid-api-key/);
      assert.ok(diagnostics.length);
    } else {
      assert.equal(firebase.auth, null);
      assert.equal(firebase.db, null);
      assert.ok(firebase.firebaseError);
      assert.ok(diagnostics.length, 'configuration failure is reported');
    }
    console.log(`PASS Firebase ${name}: editor renders, service state is explicit, no uncaught errors`);
  } finally {
    await window.happyDOM.abort();
  }
}
