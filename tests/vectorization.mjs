import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { PNG } from 'pngjs';
import { VTracerWorker } from './vtracer-worker.mjs';
const window = new Window({ url: 'http://localhost:5173/' });
globalThis.window = window;
globalThis.DOMParser = window.DOMParser;
globalThis.Worker = VTracerWorker;
const file = new URL('./.vectorization.mjs', import.meta.url);
const bundle = await build({
  stdin: { contents: 'export * from "./src/editor/vectorize"; export * from "./src/editor/model"; export * from "./src/editor/io";', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  define: { 'import.meta.env.BASE_URL': '"/"' },
});
await writeFile(file, bundle.outputFiles[0].text);
try {
  const api = await import(file.href);
  const rgba = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < 256; i++) rgba.set(i % 16 < 8 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
  const image = 'data:image/png;base64,' + PNG.sync.write({ width: 16, height: 16, data: rgba }).toString('base64');
  const frames = [
    { timestamp: 0, duration: .07, pts: '0', durationTicks: '7' },
    { timestamp: .07, duration: 0, pts: '7', durationTicks: '0' },
    { timestamp: .07, duration: .13, pts: '7', durationTicks: '13' },
    { timestamp: .2, duration: .1, pts: '20', durationTicks: '10' },
  ].map((timing, index) => ({ ...timing, id: `frame-${index}`, number: index + 1, image }));
  const owner = api.makeLayer('media', { x: 0, y: 0, width: 16, height: 16, media: {
    sourceName: 'source.gif', kind: 'gif', width: 16, height: 16, duration: .3, timeBase: '1/100', frames,
  } });
  const input = { ...api.initialScene(), width: 16, height: 16, duration: .3, layers: [owner] };
  const progress = [];
  const result = await api.vectorizeMedia(input, message => progress.push(message));
  assert.deepEqual(result.errors, []);
  const outputFrames = result.scene.layers.find(layer => layer.media).media.frames;
  assert.equal(outputFrames.length, frames.length);
  outputFrames.forEach((frame, index) => {
    assert.deepEqual({ ...frame, vector: undefined }, { ...frames[index], vector: undefined });
    assert.equal(frame.vector.status, 'ready');
    assert.match(frame.vector.svg, /<path/);
    assert.doesNotMatch(frame.vector.svg, /<image|data:image/);
    const shapes = result.scene.layers.filter(layer => layer.sourceFrame?.frame === frame.id);
    assert.equal(shapes.length, 2, 'two color regions survive tracing independently');
    assert.deepEqual(new Set(shapes.map(layer => layer.fill.toUpperCase())), new Set(['#FF0000', '#0000FF']));
  });
  assert.deepEqual(progress, [1, 2, 3, 4].map(number => `Vectorizing frame ${number}/4`));
  const zero = result.scene.layers.find(layer => layer.sourceFrame?.frame === frames[1].id);
  assert.equal(api.frameIsActive(result.scene, zero, .07), false);
  assert.equal(api.frameIsActive(result.scene, zero, .07, { layer: owner.id, frame: frames[1].id, time: .07 }), true);
  assert.equal(api.validateScene(JSON.parse(JSON.stringify(result.scene))).layers.length, 9);
  const edited = { ...result.scene, layers: result.scene.layers.map(layer => layer.id === zero.id ? { ...layer, x: 12, width: 20, rotation: 45, fill: '#00ff00' } : layer) };
  const saved = api.syncFrameSvgs(result.scene, edited);
  const savedSvg = saved.layers.find(layer => layer.media).media.frames[1].vector.svg;
  assert.match(savedSvg, /#00ff00/);
  assert.match(savedSvg, /rotate\(45\)/);
  assert.notEqual(savedSvg, outputFrames[1].vector.svg);
  const deleted = api.syncFrameSvgs(saved, { ...saved, layers: saved.layers.filter(layer => layer.sourceFrame?.frame !== frames[1].id) });
  assert.doesNotMatch(deleted.layers.find(layer => layer.media).media.frames[1].vector.svg, /<path/);
  console.log('PASS Real VTracer worker: every frame, color regions, exact PTS/timing, zero-duration identity, saved editable SVGs, delete and reload');

  const damaged = { ...input, layers: [{ ...owner, media: { ...owner.media, frames: frames.map((frame, index) => index === 1 ? { ...frame, image: 'data:image/png;base64,AAAA' } : frame) } }] };
  const failed = await api.vectorizeMedia(damaged, () => {});
  const outcomes = failed.scene.layers.find(layer => layer.media).media.frames;
  assert.deepEqual(outcomes.map(frame => frame.vector.status), ['ready', 'error', 'ready', 'ready']);
  assert.equal(failed.errors.length, 1);
  assert.match(failed.errors[0], /Frame 2 \(0.07s\)/);
  assert.deepEqual(outcomes.map(frame => frame.id), frames.map(frame => frame.id));
  console.log('PASS Failed PNG reports its frame error; all remaining frames are traced and retained');
  const partial = { ...saved, layers: saved.layers.map(layer => layer.media ? { ...layer, media: { ...layer.media, frames: layer.media.frames.map((frame, index) => index === 3 ? { ...frame, vector: undefined } : frame) } } : layer).filter(layer => layer.sourceFrame?.frame !== frames[3].id) };
  const attempted = [];
  const tracer = api.createFrameTracer();
  try {
    const resumed = await api.vectorizeMedia(partial, () => {}, undefined, async frame => { attempted.push(frame.number); return tracer.trace(frame); }, true);
    assert.deepEqual(attempted, [4]);
    assert.equal(resumed.scene.layers.find(layer => layer.id === zero.id).fill, '#00ff00');
    assert.ok(resumed.scene.layers.find(layer => layer.media).media.frames.every(frame => frame.vector?.status === 'ready'));
    assert.equal(api.isEditableVector(owner), false);
    assert.equal(api.isEditableVector(zero), true);
    console.log('PASS Resume saved extracted frames without overwriting existing vector edits or claiming media is editable');
  } finally { tracer.dispose(); }
} finally { await unlink(file); await window.happyDOM.abort(); }
