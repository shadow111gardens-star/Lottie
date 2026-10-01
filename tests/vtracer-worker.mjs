// Execute the shipped browser worker and real WASM, with only transport/file fetch adapted.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../public/vtracer/worker.js', import.meta.url), 'utf8');
const wasm = readFileSync(new URL('../public/vtracer/vtracer_wasm_bg.wasm', import.meta.url));
export class VTracerWorker {
  constructor() {
    this.stopped = false;
    const self = {
      location: { href: 'http://localhost:5173/vtracer/worker.js' },
      postMessage: data => { if (!this.stopped) this.onmessage?.({ data }); },
    };
    this.self = self;
    vm.runInNewContext(code, {
      self, URL, console, WebAssembly, TextEncoder, TextDecoder,
      fetch: async () => ({ ok: true, arrayBuffer: async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }),
    });
  }
  postMessage(data) { void this.self.onmessage({ data }); }
  terminate() { this.stopped = true; }
}
