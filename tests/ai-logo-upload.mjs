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
  postMessage() {
    const count=globalThis.mockVectorPathCount??1;
    const paths=Array.from({length:count},(_,index)=>`<path d="M2 2L62 2L62 62L2 62Z" fill="${globalThis.mockAlternatingColors&&index%2?'#6633ff':'#ff0088'}"/>`).join('');
    queueMicrotask(() => this.onmessage?.({ data: { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${paths}</svg>` } }));
  }
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
  stdin: { contents: 'export {prepareAnimatorLogo} from "./src/projects/ai-logo-input";export {animateLogo} from "./src/editor/aiAnimator";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
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
  assert.equal(traced.flattened,false);
  assert.ok(traced.scene.layers.some(layer => layer.type === 'path' && layer.fill === '#ff0088'));
  assert.match(traced.preview, /^data:image\/png;base64,/);

  const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="10" y="10" width="100" height="60" fill="#6633ff"/></svg>'], 'brand.svg', { type: 'image/svg+xml' });
  const editable = await prepareAnimatorLogo(svg, () => {}, signal);
  assert.equal(editable.traced, false, 'Basic SVG logos remain native editable shapes');
  assert.ok(editable.scene.layers.some(layer => layer.type === 'rect' && layer.fill === '#6633ff'));
  assert.match(editable.preview, /^data:image\/png;base64,/);

  globalThis.mockVectorPathCount=601;
  const dense=await prepareAnimatorLogo(png,()=>{},signal);
  assert.ok(dense.scene.layers.length<500,'Adjacent same-paint paths compact below the editor layer limit');
  assert.equal(dense.flattened,false);

  globalThis.mockVectorPathCount=501;globalThis.mockAlternatingColors=true;
  const detailed=await prepareAnimatorLogo(png,()=>{},signal);
  assert.equal(detailed.flattened,true,'A very detailed logo falls back to one image layer');
  assert.equal(detailed.scene.layers.length,1);
  assert.equal(detailed.scene.layers[0].type,'media');
  assert.equal(detailed.scene.layers[0].media.frames.length,1);
  const animated=await import(output.href);
  const animatedScene=animated.animateLogo(detailed.scene,{title:'Dense logo',description:'Subtle logo motion',effect:'fade',direction:'up',duration:3,intensity:0.5,stagger:0,loop:false,background:'transparent'});
  assert.equal(animatedScene.layers.length,1,'The flattened image logo remains animatable');
  assert.ok(animatedScene.layers[0].tracks.opacity?.length);
  console.log('PASS logo upload pipeline: PNG/SVG import, worker tracing, dense path compaction, detailed-image fallback and animation');
} finally {
  await unlink(output);
  await win.happyDOM.abort();
}
