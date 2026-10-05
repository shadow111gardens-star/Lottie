import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { createContext, SourceTextModule } from 'node:vm';
const url = process.argv[2] || 'http://localhost:4173/';
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const spa = new RegExp(`^${config.routes.at(-1).src}`);
for (const path of ['/', '/privacy', '/terms', '/dashboard', '/editor', '/editor/new-project']) assert.ok(spa.test(path), `${path} keeps its SPA fallback`);
for (const path of ['/lander', '/api/unknown', '/unknown']) assert.ok(!spa.test(path), `${path} is not an application route`);
const response = await fetch(url, { redirect: 'manual', headers: { 'Cache-Control': 'no-cache' } });
assert.equal(response.status, 200, 'Root serves HTML directly, without redirecting to /lander');
const html = await response.text();
assert.doesNotMatch(html, /window\.LANDER_SYSTEM|parking-lander|window\.location\.href\s*=\s*["']\/lander/);
const win = new Window({ url });
// The DOM harness has no graphics device; the check concerns rendered routes,
// not canvas pixels. Provide the canvas API used by the existing animation code.
win.HTMLCanvasElement.prototype.getContext = () => new Proxy({
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  measureText: () => ({ width: 0 }),
}, { get: (target, key) => target[key] ?? (() => {}) });
try {
  win.document.write(html);
  // Evaluate the unmodified, built ES module with Node's module parser.
  // happy-dom's own module compiler cannot parse this minified Vite bundle.
  const context = createContext(win);
  for (const script of win.document.querySelectorAll('script[type="module"]')) {
    const module = new SourceTextModule(script.textContent, { context, initializeImportMeta(meta) { meta.url = url; } });
    await module.link(() => { throw new Error('Unexpected external module in single-file production build'); });
    await module.evaluate();
  }
  for (let attempt = 0; attempt < 100 && win.document.querySelectorAll('.hero-line').length !== 3; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
  const headings = [...win.document.querySelectorAll('.hero-line')].map(element => element.textContent.trim());
  assert.deepEqual(headings, ['Motion', 'that moves', 'people'], `Production bundle renders the existing landing page: ${win.happyDOM.virtualConsolePrinter.readAsString()}`);
  assert.equal(win.location.pathname, '/', 'React remains at the root URL');
  assert.ok(win.document.querySelector('#pricing'));
  console.log(`PASS ${url}: HTTP 200, no /lander redirect, existing landing page renders at /, and legitimate SPA routes remain configured`);
} catch (error) {
  console.error(error.stack?.split('\n').slice(0, 8).join('\n'));
  process.exitCode = 1;
} finally { await win.happyDOM.abort(); }
