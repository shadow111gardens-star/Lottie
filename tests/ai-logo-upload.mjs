import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';

const win = new Window({ url: 'https://vekto.test/dashboard' });
for (const key of ['window', 'document', 'DOMParser', 'FileReader', 'File', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true });
}
globalThis.atob = value => Buffer.from(value, 'base64').toString('binary');
globalThis.Worker = class {
  constructor(url) { this.url = String(url); }
  postMessage() { queueMicrotask(() => this.onmessage?.({ data: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path d="M2 2L62 2L62 62L2 62Z" fill="#ff0088"/></svg>' } })); }
  terminate() {}
};
globalThis.Image = class {
  naturalWidth = 64;
  naturalHeight = 48;
  set src(_value) { queueMicrotask(() => this.onload?.()); }
};
const createElement = win.document.createElement.bind(win.document);
win.document.createElement = tag => {
  const element = createElement(tag);
  if (tag.toLowerCase() === 'canvas') {
    element.getContext = () => ({ drawImage() {} });
    element.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/0L8AAAAASUVORK5CYII=';
  }
  return element;
};

const output = new URL(`./.ai-logo-upload-${process.pid}.mjs`, import.meta.url);
const bundle = await build({
  entryPoints: ['src/projects/ai-logo-input.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
  plugins: [{ name: 'upload-test-storage', setup(builder) {
    builder.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: 'storage', namespace: 'upload-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'upload-test' }, () => ({ contents: 'export async function dataUrl(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});}' }));
  } }],
});
await writeFile(output, bundle.outputFiles[0].text);
try {
  const { prepareAnimatorLogo } = await import(output.href);
  const signal = new AbortController().signal;
  const png = new File([Uint8Array.from([137,80,78,71,13,10,26,10,0])], 'brand.png', { type: 'image/png' });
  const traced = await prepareAnimatorLogo(png, () => {}, signal);
  assert.equal(traced.name, 'brand.png');
  assert.equal(traced.traced, true, 'Raster logos go through the VTracer worker');
  assert.ok(traced.scene.layers.some(layer => layer.type === 'path' && layer.fill === '#ff0088'));
  assert.match(traced.preview, /^data:image\/png;base64,/);

  const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="10" y="10" width="100" height="60" fill="#6633ff"/></svg>'], 'brand.svg', { type: 'image/svg+xml' });
  const editable = await prepareAnimatorLogo(svg, () => {}, signal);
  assert.equal(editable.traced, false, 'Basic SVG logos remain native editable shapes');
  assert.ok(editable.scene.layers.some(layer => layer.type === 'rect' && layer.fill === '#6633ff'));
  assert.match(editable.preview, /^data:image\/png;base64,/);
  console.log('PASS logo upload pipeline: PNG validation, raster decode, worker vectorization, SVG parsing and preview generation');
} finally {
  await unlink(output);
  await win.happyDOM.abort();
}
