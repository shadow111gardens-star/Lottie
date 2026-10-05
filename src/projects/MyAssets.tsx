import { useState } from 'react';
import { Download, FolderOpen, Search, FileCode2, Film, Image, ArrowUpRight } from 'lucide-react';
import { exportSceneSvg } from '../editor/io';
import { loadProject, type Project } from '../projects/store';
import { assetBlob, currentOwner, assertOwner } from './storage';

export default function MyAssets({ projects, open, error }: { projects: Project[]; open: (id: string) => void; error: string }) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const assets = projects.flatMap(project => {
    const files = [...(project.assets ?? [])];
    if ((project.hasContent ?? project.scene.layers.length > 0) && project.type === 'SVG' && !files.some(file => file.kind === 'SVG')) files.push({ name: `${project.scene.name}.svg`, kind: 'SVG' as const });
    return files.map(file => ({ ...file, project, id: `${project.id}:${file.key ?? file.name}` }));
  });
  const filtered = assets.filter(asset => `${asset.name} ${asset.project.scene.name} ${asset.kind}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const download = async (asset: typeof assets[number]) => {
    if (busy) return;
    setBusy(asset.id); setDownloadError('');
    try {
      const user = await currentOwner();
      const blob = asset.key ? await assetBlob(user, asset.project.id, asset.key) : new Blob([exportSceneSvg(await loadProject(asset.project.id), 0, false)], { type: 'image/svg+xml' });
      assertOwner(user);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = asset.name;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : 'Could not download this asset. Please retry.'); }
    finally { setBusy(null); }
  };
  return <section className="ma-page">
    <header className="pd-header"><div><div className="ap-eyebrow">LIBRARY</div><h1>My assets</h1><p>Your saved images, videos, SVGs and Lottie files, all in one place.</p></div></header>
    <div className="ma-toolbar"><div className="pd-search"><Search size={16} /><input aria-label="Search assets" placeholder="Search your assets" value={search} onChange={event => setSearch(event.target.value)} /></div><span>{filtered.length} {filtered.length === 1 ? 'asset' : 'assets'}</span></div>
    {(error || downloadError) && <div className="pd-warning" role="alert">{downloadError || error}</div>}
    {filtered.length ? <div className="pd-grid">{filtered.map(asset => <article className="pd-card ma-card" key={asset.id}>
      <button className="pd-preview" aria-label={`Open project for ${asset.name}`} onClick={() => open(asset.project.id)}>{asset.project.preview ? <img loading="lazy" src={asset.project.preview} alt={`Project preview for ${asset.name}`} /> : asset.kind === 'Video' ? <Film size={36} /> : asset.kind === 'Image' ? <Image size={36} /> : <FileCode2 size={36} />}</button>
      <div className="pd-card-details"><strong title={asset.name}>{asset.name}</strong><p>{asset.kind} · {asset.project.scene.name}</p><div className="ma-actions"><button className="pd-button" disabled={busy !== null} aria-label={`Download ${asset.name}`} onClick={() => void download(asset)}><Download size={14} />{busy === asset.id ? 'Downloading…' : 'Download'}</button><button className="pd-icon" aria-label={`Edit project for ${asset.name}`} onClick={() => open(asset.project.id)}><ArrowUpRight size={16} /></button></div></div>
    </article>)}</div> : !error && <div className="pd-empty"><div><FolderOpen size={30} /></div><h2>{search ? 'No matching assets' : 'Your asset library starts here'}</h2><p>{search ? 'Try a different file or project name.' : 'Import files or save a project to see its assets here.'}</p>{search && <button className="pd-button" onClick={() => setSearch('')}>Clear search</button>}</div>}
  </section>;
}
