import svgpath from 'svgpath';
import { exportSceneSvg } from './io';
import { makeLayer, mediaFrameAt, type Layer, type MediaFrame, type Scene } from './model';

export type FrameSelection = { layer: string; frame: string; time: number } | null;
export function isEditableVector(layer: Layer): boolean {
  return ['rect', 'ellipse', 'line', 'text'].includes(layer.type) || (layer.type === 'path' && !!layer.path.trim());
}
const ownerIndexes = new WeakMap<Scene, Map<string, Layer>>();

/** Keep each stored frame SVG in sync with its independently edited layers. */
export function syncFrameSvgs(previous: Scene, next: Scene): Scene {
  const previousLayers = new Map(previous.layers.map(layer => [layer.id, layer]));
  const nextLayers = new Map(next.layers.map(layer => [layer.id, layer]));
  const dirty = new Set<string>();
  for (const layer of [...previous.layers, ...next.layers]) {
    if (layer.sourceFrame && previousLayers.get(layer.id) !== nextLayers.get(layer.id)) dirty.add(layer.sourceFrame.frame);
  }
  if (!dirty.size) return next;
  const frameLayers = new Map<string, Layer[]>();
  for (const layer of next.layers) {
    if (!layer.sourceFrame) continue;
    const group = frameLayers.get(layer.sourceFrame.frame) ?? [];
    group.push(layer);
    frameLayers.set(layer.sourceFrame.frame, group);
  }
  return { ...next, layers: next.layers.map(owner => !owner.media ? owner : {
    ...owner,
    media: { ...owner.media, frames: owner.media.frames.map(frame => {
      if (!dirty.has(frame.id) || frame.vector?.status !== 'ready') return frame;
      const vectors = (frameLayers.get(frame.id) ?? [])
        .map(layer => ({ ...layer, startTime: undefined, endTime: undefined }));
      const svg = exportSceneSvg({ ...next, width: owner.media!.width, height: owner.media!.height, background: 'transparent', layers: vectors }, (owner.startTime ?? 0) + frame.timestamp, false);
      return { ...frame, vector: { status: 'ready' as const, svg } };
    }) },
  }) };
}

/** Resolve source identity, including separately selectable zero-duration frames. */
export function frameIsActive(scene: Scene, layer: Layer, time: number, selection: FrameSelection = null): boolean {
  if (!layer.sourceFrame) return true;
  let owners = ownerIndexes.get(scene);
  if (!owners) {
    owners = new Map(scene.layers.filter(item => item.media).map(item => [item.id, item]));
    ownerIndexes.set(scene, owners);
  }
  const owner = owners.get(layer.sourceFrame.layer);
  if (!owner?.media || !owner.visible) return false;
  const id = selection?.layer === owner.id && selection.time === time
    ? selection.frame
    : mediaFrameAt(owner.media, time - (owner.startTime ?? 0))?.id;
  return id === layer.sourceFrame.frame;
}

/** Parse VTracer's path-only output; bake transforms rather than embedding markup. */
export function vectorLayers(svg: string, owner: Layer, frame: MediaFrame): Layer[] {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') throw new Error('VTracer returned invalid SVG.');
  if (document.querySelector('image,script,foreignObject,use')) throw new Error('Vector output must contain paths, not embedded raster data.');
  return [...document.querySelectorAll('path')].map((element, index) => {
    const path = svgpath(element.getAttribute('d') ?? '');
    const error = (path as typeof path & { err: string }).err;
    if (error) throw new Error(`Invalid vector path ${index + 1}: ${error}`);
    let node: Element | null = element;
    while (node && node.localName !== 'svg') {
      const transform = node.getAttribute('transform');
      if (transform) path.transform(transform);
      node = node.parentElement;
    }
    path.abs().unshort().unarc();
    const xs: number[] = [], ys: number[] = [];
    // Control-point hull bounds also contain the entire Bézier curve.
    path.iterate((segment, _index, x, y) => {
      if (segment[0] === 'H') { xs.push(segment[1] as number); ys.push(y); }
      else if (segment[0] === 'V') { xs.push(x); ys.push(segment[1] as number); }
      else for (let i = 1; i + 1 < segment.length; i += 2) {
        xs.push(segment[i] as number); ys.push(segment[i + 1] as number);
      }
    });
    if (!xs.length || [...xs, ...ys].some(value => !Number.isFinite(value))) throw new Error('Vector path has invalid coordinates.');
    const x = Math.min(...xs), y = Math.min(...ys);
    const width = Math.max(1, Math.max(...xs) - x), height = Math.max(1, Math.max(...ys) - y);
    const fill = element.getAttribute('fill') ?? '#000000';
    if (!/^#[\da-f]{3,8}$/i.test(fill) && !/^(black|white|none)$/i.test(fill)) throw new Error('Unsupported vector paint.');
    return makeLayer('path', {
      name: `Frame ${frame.number} · path ${index + 1}`, x, y, width, height,
      path: path.toString(), pathViewBox: `${x} ${y} ${width} ${height}`,
      fill, stroke: 'none', strokeWidth: 0,
      fillRule: element.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero',
      sourceFrame: { layer: owner.id, frame: frame.id },
      startTime: (owner.startTime ?? 0) + frame.timestamp,
      endTime: (owner.startTime ?? 0) + frame.timestamp + frame.duration,
    });
  });
}

/** One sequential request per full-resolution PNG; tracing stays off the UI thread. */
export function createFrameTracer(signal?: AbortSignal) {
  let worker: Worker | undefined;
  const dispose = () => { worker?.terminate(); worker = undefined; };
  const trace = (frame: MediaFrame): Promise<string> => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Import cancelled.', 'AbortError')); return; }
    try {
      worker ??= new Worker(new URL(`${import.meta.env.BASE_URL}vtracer/worker.js`, window.location.href));
      const current = worker;
      const finish = (error?: Error, svg?: string) => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        current.onmessage = null; current.onerror = null;
        if (error) { dispose(); reject(error); } else resolve(svg!);
      };
      const abort = () => finish(new DOMException('Import cancelled.', 'AbortError'));
      const timeout = setTimeout(() => finish(new Error('VTracer timed out for this frame.')), 120000);
      signal?.addEventListener('abort', abort, { once: true });
      current.onmessage = ({ data }: MessageEvent<{ svg?: string; error?: string }>) => {
        if (typeof data.svg === 'string') finish(undefined, data.svg);
        else finish(new Error(data.error ?? 'VTracer returned no SVG.'));
      };
      current.onerror = event => { event.preventDefault(); finish(new Error(event.message || 'VTracer worker failed.')); };
      try {
        const encoded = frame.image.split(',')[1];
        const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
        current.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    } catch (error) { dispose(); reject(error); }
  });
  return { trace, dispose };
}

export async function vectorizeMedia(
  scene: Scene,
  progress: (message: string) => void,
  signal?: AbortSignal,
  traceFrame?: (frame: MediaFrame) => Promise<string>,
  pendingOnly = false,
): Promise<{ scene: Scene; errors: string[] }> {
  const tracer = traceFrame ? null : createFrameTracer(signal);
  const trace = traceFrame ?? tracer!.trace;
  const errors: string[] = [];
  const vectors: Layer[] = [];
  const layers = [...scene.layers];
  const replacedFrames = new Set<string>();
  try {
    for (let index = 0; index < layers.length; index++) {
      const owner = layers[index];
      if (!owner.media) continue;
      const frames: MediaFrame[] = [];
      for (const frame of owner.media.frames) {
        if (pendingOnly && frame.vector) { frames.push(frame); continue; }
        replacedFrames.add(frame.id);
        if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError');
        progress(`Vectorizing frame ${frame.number}/${owner.media.frames.length}`);
        // Give React a chance to paint progress, even with a synchronous test engine.
        await new Promise(resolve => setTimeout(resolve, 0));
        try {
          const svg = await trace(frame);
          const paths = vectorLayers(svg, owner, frame);
          vectors.push(...paths.reverse());
          frames.push({ ...frame, vector: { status: 'ready', svg } });
        } catch (error) {
          if (signal?.aborted) throw error;
          const message = `Frame ${frame.number} (${frame.timestamp}s): ${error instanceof Error ? error.message : String(error)}`;
          errors.push(message);
          frames.push({ ...frame, vector: { status: 'error', error: message } });
          progress(message);
        }
      }
      layers[index] = { ...owner, media: { ...owner.media, frames } };
    }
    return { scene: { ...scene, layers: [...vectors, ...layers.filter(layer => !layer.sourceFrame || !replacedFrames.has(layer.sourceFrame.frame))] }, errors };
  } finally { tracer?.dispose(); }
}
