import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, ArrowUpRight, FileCode2, ImagePlus, ArrowRight, Sparkles, X, Minus, Plus, Maximize, Minimize, Zap, Pencil, Layers, LoaderCircle } from 'lucide-react';
import './png-to-svg.css';
import { vectorizePng } from '../editor/pngToSvg';
import { createProject } from '../projects/store';
import { dataUrl } from './storage';

type Input = { file: File; image: string; width: number; height: number };
export default function PngToSvg() {
  const navigate = useNavigate();
  const picker = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const preview = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === preview.current); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await preview.current?.requestFullscreen(); } catch { setError('Fullscreen is unavailable in this browser.'); } };
  const remove = () => { generation.current++; setInput(null); setResult(null); setProgress(''); setError(''); setZoom(100); };
  const [input, setInput] = useState<Input | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof vectorizePng>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  const select = async (file?: File) => {
    if (!file || busy || opening) return;
    const version = ++generation.current;
    setError('');
    try {
      const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)) throw new Error('Please select a valid PNG image.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Please choose a PNG smaller than 10 MB.');
      const image = await dataUrl(file);
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('This PNG could not be decoded.'));
        img.src = image;
      });
      if (dimensions.width > 8192 || dimensions.height > 8192 || dimensions.width * dimensions.height > 32 * 1024 * 1024) throw new Error('Choose an image up to 8192 pixels per side and 32 megapixels.');
      if (version !== generation.current) return;
      setInput({ file, image, ...dimensions }); setResult(null); setProgress(''); setZoom(100);
    } catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : 'Could not read PNG.'); }
  };
  const convert = async () => {
    if (!input || busy || opening) return;
    generation.current++;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setResult(null); setError('');
    try {
      const output = await vectorizePng(input.image, input.file.name.replace(/\.png$/i, ''), input.width, input.height, setProgress, abort.signal);
      if (!abort.signal.aborted) { setResult(output); setProgress('Conversion complete.'); }
    } catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Conversion failed. Please try again.'); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  };
  const download = () => {
    if (!result || !input) return;
    const url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = input.file.name.replace(/\.png$/i, '') + '.svg';
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const open = async () => {
    if (!result || opening) return;
    setOpening(true); setError('');
    try { const id = await createProject(result.scene.name, { ...result.scene, files: { ...result.scene.files, source: input ? [{ name: input.file.name, data: input.image }] : undefined } }); navigate(`/editor/${encodeURIComponent(id)}`); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not create project.'); setOpening(false); }
  };
  return <div className="png-tool">
    <header className="png-hero">
      <div><div className="png-eyebrow">TOOLS ? PNG ? SVG</div><h1>PNG ? <span>SVG</span></h1><p>Convert your PNG images into clean, editable SVG vectors.</p></div>
      <div className="png-hero-art" aria-hidden="true"><div className="png-art-raster"><ImagePlus /></div><span className="png-art-arrow"><ArrowRight /></span><div className="png-art-vector"><svg viewBox="0 0 120 85"><path d="M15 60C15 8 76 13 77 68M39 23Q73 47 106 21"/><g><circle cx="15" cy="60" r="5"/><circle cx="39" cy="23" r="5"/><circle cx="77" cy="68" r="5"/><circle cx="106" cy="21" r="5"/></g></svg></div></div>
    </header>
    <div className="png-panels">
      <section className="png-panel" aria-labelledby="png-input-title">
        <div className="png-panel-heading"><span className="png-step">1</span><div><h2 id="png-input-title">Upload PNG</h2><p>Select or drag and drop a PNG image to convert into SVG.</p></div></div>
        <input ref={picker} hidden type="file" accept="image/png,.png" aria-label="Upload PNG" disabled={busy || opening} onChange={e => { void select(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
        <button className={`png-dropzone ${dragging ? 'is-dragging' : ''}`} disabled={busy || opening} onClick={() => picker.current?.click()} onDragOver={e => { e.preventDefault(); if (!busy && !opening) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void select(e.dataTransfer.files[0]); }} aria-label={input ? 'Replace PNG' : 'Select or drop PNG'}>
          <span className="png-upload-icon"><ImagePlus size={30} /></span><strong>Drag and drop a PNG image here</strong><span className="png-muted">or click to select a file</span><span className="png-select"><Upload size={16} />Select PNG</span><small>Supports PNG files up to 10 MB</small>
        </button>
        <div className={`png-file ${input ? '' : 'is-empty'}`}>
          {input ? <><img src={input.image} alt="Uploaded PNG" /><div><strong title={input.file.name}>{input.file.name}</strong><span>{(input.file.size / 1024 / 1024).toFixed(2)} MB ? {input.width} ? {input.height}</span></div><button aria-label="Remove PNG" disabled={busy || opening} onClick={remove}><X size={16} /></button></> : <span>Select a PNG to get started. Your image is converted on this device.</span>}
        </div>
        <button className="png-button png-convert" disabled={!input || busy || opening} onClick={() => void convert()} aria-busy={busy}>{busy ? <LoaderCircle className="png-spin" size={17} /> : <Sparkles size={17} />}{busy ? 'Converting PNG to SVG?' : 'Convert to SVG'}</button>
        <p className="png-status" role="status" aria-live="polite">{progress}</p>
      </section>
      <section className="png-panel" aria-labelledby="svg-output-title">
        <div className="png-panel-heading"><span className="png-step">2</span><div><h2 id="svg-output-title">SVG Result</h2><p>{result ? `${result.scene.layers.length} editable vector paths ? Ready to download.` : 'Your converted SVG will appear here.'}</p></div></div>
        <div className="png-preview" ref={preview}>
          <div className="png-preview-toolbar"><div><button aria-label="Zoom out" disabled={!result || zoom <= 25} onClick={() => setZoom(z => Math.max(25, z - 25))}><Minus size={15} /></button><button aria-label="Reset zoom" disabled={!result} onClick={() => setZoom(100)}>{zoom}%</button><button aria-label="Zoom in" disabled={!result || zoom >= 400} onClick={() => setZoom(z => Math.min(400, z + 25))}><Plus size={15} /></button></div><button aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen preview'} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button></div>
          <div className="png-preview-scroll"><div className="png-preview-canvas" style={{ width: `${zoom}%`, height: `${zoom}%` }}>{result ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`} alt="Generated SVG" /> : <div className="png-preview-empty">{busy ? <LoaderCircle className="png-spin" size={34} /> : <FileCode2 size={34} />}<strong>{busy ? 'Creating your vector?' : 'Your SVG will appear here'}</strong><span>{busy ? progress : 'Upload a PNG and click Convert to SVG.'}</span></div>}</div></div>
        </div>
        <div className="png-actions"><button className="png-button png-download" disabled={!result || busy} onClick={download}><Download size={16} />Download SVG</button><button className="png-button png-editor" disabled={!result || opening || busy} aria-busy={opening} onClick={() => void open()}><ArrowUpRight size={16} />{opening ? 'Creating project?' : 'Open in Editor'}</button></div>
      </section>
    </div>
    {error && <div className="png-error" role="alert">{error}</div>}
    <footer className="png-features"><div><span><Zap /></span><div><strong>Real vector conversion</strong><p>PNG pixels traced into SVG paths</p></div></div><div><span><Pencil /></span><div><strong>Fully Editable</strong><p>Ready for animations and design</p></div></div><div><span><Layers /></span><div><strong>Transparent Background</strong><p>Preview vectors on a checkerboard</p></div></div></footer>
  </div>;
}
