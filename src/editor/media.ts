import { makeLayer, type MediaFrame, type MediaSequence, type Scene } from './model';
import { parseGIF, decompressFrame } from 'gifuct-js';

const MAX_PIXELS = 128 * 1024 * 1024; // Reject complete imports rather than sampling to fit memory.
export type PngEncoder = (rgba: Uint8ClampedArray, width: number, height: number) => Promise<string>;
export const encodePng: PngEncoder = async (rgba, width, height) => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot prepare source frames: Canvas 2D is unavailable.');
  const image = ctx.createImageData(width, height); image.data.set(rgba); ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};
function dimensions(width: number, height: number, count: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height * count > MAX_PIXELS)
    throw new Error('This media exceeds the full-frame memory limit (128 million decoded pixels). No frames were imported or skipped.');
}
function limit(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Source duration is invalid.');
  if (seconds > 10) throw new Error('Video and GIF imports must be 10 seconds or shorter. No frames were imported.');
}
export async function extractGif(data: ArrayBuffer, name: string, encode: PngEncoder = encodePng): Promise<MediaSequence> {
  const gif = parseGIF(data);
  if (gif.header.signature !== 'GIF') throw new Error('Invalid GIF header.');
  // Plain-text blocks have visual semantics; do not silently discard them.
  if (gif.frames.some(f => 'text' in f)) throw new Error('GIF plain-text rendering is unsupported; the complete import was rejected.');
  const source = gif.frames.filter((f): f is Extract<typeof f, { image: unknown }> => 'image' in f);
  if (!source.length) throw new Error('GIF contains no image frames.');
  const { width, height } = gif.lsd;
  dimensions(width, height, source.length);
  const ticks = source.map(f => f.gce?.delay ?? 0); // gifuct's default delay substitutes 100 ms; never use it.
  const duration = ticks.reduce((a,b) => a+b, 0) / 100; limit(duration);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const background = gif.gct?.[gif.lsd.backgroundColorIndex];
  const clear = (left: number, top: number, w: number, h: number, transparent: boolean) => {
    for(let y=top;y<top+h;y++) for(let x=left;x<left+w;x++) {
      const offset=(y*width+x)*4;
      pixels.set(!transparent && background ? [...background,255] : [0,0,0,0],offset);
    }
  };
  clear(0,0,width,height,!!source[0].gce?.extras.transparentColorGiven);
  let pts = 0;
  const frames: MediaFrame[] = [];
  for(let i=0;i<source.length;i++) {
    const raw=source[i], disposal=raw.gce?.extras.disposal ?? 0;
    if(disposal > 3 || raw.gce?.extras.userInput) throw new Error(`GIF frame ${i+1}: unsupported disposal ${disposal} or user-input timing. No partial import was retained.`);
    const frame=decompressFrame(raw,gif.gct,true);
    const {left,top,width:w,height:h}=frame.dims;
    if(left+w>width || top+h>height || w<1 || h<1 || frame.pixels.some(p => !frame.colorTable[p])) throw new Error(`Invalid GIF image data at frame ${i+1}.`);
    const before=disposal===3 ? pixels.slice() : null;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const src=(y*w+x)*4, dst=((top+y)*width+left+x)*4;
      if(frame.patch[src+3]) pixels.set(frame.patch.subarray(src,src+4),dst);
    }
    frames.push({id:crypto.randomUUID(),number:i+1,timestamp:pts/100,duration:ticks[i]/100,pts:String(pts),durationTicks:String(ticks[i]),image:await encode(pixels,width,height)});
    pts += ticks[i];
    if(disposal===2) clear(left,top,w,h,!!raw.gce?.extras.transparentColorGiven);
    if(before) pixels.set(before);
    // Allow progress messages and cancellation/navigation to paint during large GIF decoding.
    if(i%20===19) await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {sourceName:name,kind:'gif',width,height,timeBase:'1/100',duration,frames};
}
export type Probe = { streams: Array<Record<string, any>>; frames?: Array<Record<string, any>>; format?: {duration?:string} };
export function videoTiming(probe: Probe) {
  const videos=probe.streams.filter(s=>s.codec_type==='video' && !s.disposition?.attached_pic);
  if(videos.length!==1) throw new Error('Import requires exactly one video stream; multiple streams are not silently discarded.');
  const stream=videos[0];
  for(const value of [probe.format?.duration,...probe.streams.map(s=>s.duration)]) if(value!==undefined && value!=='N/A') limit(Number(value));
  const match=/^(\d+)\/(\d+)$/.exec(stream.time_base ?? '');
  if(!match || +match[1]===0 || +match[2]===0) throw new Error('Video has no reliable source time base.');
  const numerator=BigInt(match[1]), denominator=BigInt(match[2]);
  const seconds=(ticks:bigint)=>Number(ticks*numerator)/Number(denominator);
  const source=(probe.frames ?? []).filter(f=>f.stream_index===stream.index && f.media_type==='video');
  if(!source.length) throw new Error('Video contains no decodable frames.');
  if (/^\d+$/.test(String(stream.nb_frames)) && Number(stream.nb_frames) !== source.length) throw new Error('Video frame count does not match its source metadata. No partial import was retained.');
  dimensions(stream.width,stream.height,source.length);
  const integer=(v:unknown)=>typeof v==='number' && Number.isSafeInteger(v) || typeof v==='string' && /^-?\d+$/.test(v);
  if(source.some(f=>!integer(f.pts))) throw new Error('Video frame timestamps are missing or exceed exact integer precision. Import was rejected rather than inventing timestamps.');
  const first=BigInt(source[0].pts);
  const timing=source.map((f,i)=>{
    const pts=BigInt(f.pts),next=source[i+1];
    if(i && pts<BigInt(source[i-1].pts)) throw new Error(`Video frame ${i+1} has out-of-order presentation timestamps.`);
    const packetDuration=f.duration ?? f.pkt_duration;
    // Display lasts until the next presentation timestamp. Packet duration can describe
    // decode order (B-frames) or a nominal frame period, not the actual VFR display interval.
    let duration=next ? String(BigInt(next.pts)-pts) : packetDuration;
    // A following presentation timestamp determines the display interval if no duration was encoded.
    if(!integer(duration) || BigInt(duration)<=0) {
      if(next) duration=String(BigInt(next.pts)-pts);
      else if(integer(stream.duration_ts) && integer(stream.start_pts)) duration=String(BigInt(stream.start_pts)+BigInt(stream.duration_ts)-pts);
      else throw new Error(`Video frame ${i+1} has no exact duration. Import was rejected rather than assuming an FPS.`);
    }
    const ticks=BigInt(duration);
    if(ticks<0n) throw new Error(`Invalid duration for frame ${i+1}.`);
    if((pts-first+ticks)*numerator>10n*denominator) limit(11);
    return {number:i+1,timestamp:seconds(pts-first),duration:seconds(ticks),pts:String(pts),durationTicks:String(ticks),...(integer(packetDuration) ? {packetDurationTicks:String(packetDuration)} : {})};
  });
  const duration=Math.max(...timing.map(f=>f.timestamp+f.duration)); limit(duration);
  return {stream,timing,duration,timeBase:stream.time_base as string};
}
export interface MediaDecoder {
  writeFile(path:string,data:Uint8Array):Promise<unknown>;
  readFile(path:string):Promise<Uint8Array|string>;
  ffprobe(args:string[]):Promise<number>;
  exec(args:string[]):Promise<number>;
  listDir(path:string):Promise<Array<{name:string}>>;
  deleteFile(path:string):Promise<unknown>;
}
export const videoDecodeArgs=(index:number)=>['-v','error','-xerror','-err_detect','explode','-copyts','-i','source','-map',`0:${index}`,'-an','-sn','-dn','-vsync','0','-c:v','png','-threads','1','-start_number','1','frame-%08d.png'];
export async function extractVideo(decoder:MediaDecoder,data:Uint8Array,name:string):Promise<MediaSequence> {
  await decoder.writeFile('source',data);
  const probeArgs=['-v','error','-show_error','-show_streams','-show_format','-of','json','source','-o','probe.json'];
  if(await decoder.ffprobe(probeArgs) > 0) throw new Error('Cannot read video metadata. The format may be unsupported or damaged.');
  // Core 0.12.10 returns -1 for successful ffprobe runs (upstream #817).
  // Require fresh complete JSON without an error section, not just an exit code.
  const readProbe=async()=>{
    const report=JSON.parse(new TextDecoder().decode(await decoder.readFile('probe.json') as Uint8Array));
    if(report.error || !Array.isArray(report.streams) || !report.streams.length) throw new Error('Invalid video probe report.');
    return report as Probe;
  };
  const metadata=await readProbe();
  for(const value of [metadata.format?.duration,...metadata.streams.map(s=>s.duration)]) if(value!==undefined && value!=='N/A') limit(Number(value));
  await decoder.deleteFile('probe.json');
  if(await decoder.ffprobe([...probeArgs.slice(0,2),'-show_frames',...probeArgs.slice(2)]) > 0) throw new Error('Could not decode every video frame for timing.');
  const {stream,timing,duration,timeBase}=videoTiming(await readProbe());
  if(await decoder.exec(videoDecodeArgs(stream.index))) throw new Error('Video decoding failed. No partial or sampled sequence was imported.');
  const files=(await decoder.listDir('/')).filter(f=>/^frame-\d{8}\.png$/.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name));
  if(files.length!==timing.length) throw new Error(`Frame-count mismatch: source has ${timing.length}, decoder produced ${files.length}. Import rejected.`);
  const frames:MediaFrame[]=[];
  let width=0,height=0;
  for(let i=0;i<files.length;i++) {
    const png=await decoder.readFile(files[i].name) as Uint8Array;
    const view=new DataView(png.buffer,png.byteOffset,png.byteLength);
    const w=view.getUint32(16), h=view.getUint32(20);
    if(i && (w!==width || h!==height)) throw new Error('Changing video dimensions are unsupported; no frames were imported.');
    width=w;height=h;
    let binary=''; for(let n=0;n<png.length;n+=32768) binary+=String.fromCharCode(...png.subarray(n,n+32768));
    frames.push({...timing[i],id:crypto.randomUUID(),image:`data:image/png;base64,${btoa(binary)}`});
    await decoder.deleteFile(files[i].name);
  }
  return {sourceName:name,kind:'video',width,height,timeBase,duration,frames};
}
export async function importMedia(file:File, progress:(message:string)=>void, signal?:AbortSignal):Promise<Scene> {
  signal?.throwIfAborted();
  if(file.size>128*1024*1024) throw new Error('Media imports support files up to 128 MB. No frames were imported.');
  progress('Reading source frames and exact timing…');
  const data=await file.arrayBuffer();
  signal?.throwIfAborted();
  let media:MediaSequence;
  if(new TextDecoder().decode(data.slice(0,3))==='GIF') media=await extractGif(data,file.name,async (...args)=>{signal?.throwIfAborted();return encodePng(...args);});
  else {
    const {FFmpeg}=await import('@ffmpeg/ffmpeg');
    const decoder=new FFmpeg();
    const cancel=()=>decoder.terminate();
    signal?.addEventListener('abort',cancel,{once:true});
    try {
      progress('Loading local video decoder…');
      const base=new URL(`${import.meta.env.BASE_URL}ffmpeg/`,location.href);
      await decoder.load({classWorkerURL:new URL('worker/worker.js',base).href,coreURL:new URL('ffmpeg-core.js',base).href,wasmURL:new URL('ffmpeg-core.wasm',base).href});
      progress('Extracting every source frame. This can take a moment…');
      media=await extractVideo(decoder,new Uint8Array(data),file.name);
    } finally {signal?.removeEventListener('abort',cancel);decoder.terminate();}
  }
  signal?.throwIfAborted();
  return mediaScene(media);
}
export function mediaScene(media:MediaSequence):Scene {
  return {version:1,name:media.sourceName,width:media.width,height:media.height,background:'transparent',clip:true,duration:Math.max(media.duration,0.01),layers:[makeLayer('media',{name:media.sourceName,media,x:0,y:0,width:media.width,height:media.height,startTime:0,endTime:media.duration})]};
}
/** Full-resolution, independently composited PNG inputs; vectorization never receives thumbnails. */
export function* vectorizationFrames(media:MediaSequence) {
  for(const frame of media.frames) yield {...frame,width:media.width,height:media.height,mimeType:'image/png' as const};
}
