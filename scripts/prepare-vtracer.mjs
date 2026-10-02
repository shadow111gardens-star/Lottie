import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
await mkdir('public/vtracer', { recursive: true });
const bindings = (await readFile('node_modules/@visioncortex/vtracer/pkg/vtracer_wasm.js', 'utf8'))
  .replace(/^exports\.vectorize_(bytes|rgba) = vectorize_\1;\r?\n/gm, '')
  .split('const wasmPath =')[0];
await writeFile('public/vtracer/worker.js', bindings + `
let wasm;
const ready = fetch(new URL('vtracer_wasm_bg.wasm', self.location.href)).then(response => {
  if (!response.ok) throw new Error('Could not load VTracer.');
  return response.arrayBuffer();
}).then(bytes => WebAssembly.instantiate(bytes, __wbg_get_imports())).then(result => {
  wasm = result.instance.exports; wasm.__wbindgen_start();
});
ready.catch(() => {});
self.onmessage = async ({ data }) => {
  try {
    await ready;
    const svg = vectorize_bytes(new Uint8Array(data.bytes), {
      clustering: 'color-cluster', hierarchical: 'cutout', mode: 'spline',
      filterSpeckle: 0, colorPrecision: 6, pathPrecision: 4,
    });
    self.postMessage({ svg });
  } catch (error) { self.postMessage({ error: error.message || String(error) }); }
};
`);
await copyFile('node_modules/@visioncortex/vtracer/pkg/vtracer_wasm_bg.wasm', 'public/vtracer/vtracer_wasm_bg.wasm');
await writeFile('public/vtracer/NOTICE.txt', '@visioncortex/vtracer, MIT license. https://github.com/visioncortex/vtracer\nOfficial WASM bindings adapted to a browser worker.\n');
