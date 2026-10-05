import { initialScene, makeLayer, type MediaFrame } from './model';
import { createFrameTracer, vectorLayers } from './vectorize';

/** Use the same worker and path parser as animated raster imports. */
export async function vectorizePng(image: string, name: string, width: number, height: number, progress: (message: string) => void, signal?: AbortSignal) {
  const tracer = createFrameTracer(signal);
  try {
    progress('Tracing PNG to SVG…');
    const frame: MediaFrame = { id: 'png', number: 1, timestamp: 0, duration: 1, pts: '0', durationTicks: '1', image };
    const svg = await tracer.trace(frame);
    progress('Finalizing SVG…');
    await new Promise(resolve => setTimeout(resolve, 0));
    if (signal?.aborted) throw new DOMException('Conversion cancelled.', 'AbortError');
    const layers = vectorLayers(svg, makeLayer('path'), frame);
    if (!layers.length) throw new Error('VTracer returned no editable paths. The PNG may be fully transparent.');
    const scene = { ...initialScene(name), width, height, background: 'transparent', layers: layers.reverse().map((layer, index) => ({ ...layer, name: `Path ${index + 1}`, sourceFrame: undefined, startTime: undefined, endTime: undefined })), files: { svg } };
    return { svg, scene };
  } finally { tracer.dispose(); }
}
