import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Search, FileCode2, Film, Image, ArrowUpRight, Upload, Trash2, X } from 'lucide-react';
import { exportSceneSvg } from '../editor/io';
import { loadProject, uploadLibraryFile, readUploadedAssets, deleteAsset, type Project, type ProjectAsset } from '../projects/store';
import { assetBlob, currentOwner, assertOwner } from './storage';

function AssetPreview({ asset, project }: { asset: ProjectAsset; project: Project }) {
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    let cancelled = false, url: string | undefined;
    setPreview(undefined);
    if (!asset.key || !['Image', 'SVG'].includes(asset.kind)) return;
    void (async () => {
      const user = await currentOwner();
      const blob = await assetBlob(user, project.id, asset.key!);
      assertOwner(user);
      if (cancelled) return;
      url = URL.createObjectURL(blob); setPreview(url);
    })().catch(() => { /* Download remains available when preview decoding fails. */ });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [asset.key, asset.kind, project.id]);
  return preview ? <img loading="lazy" src={preview} alt={asset.name} /> : !asset.key && project.preview ? <img loading="lazy" src={project.preview} alt={asset.name} /> : asset.kind === 'Video' ? <Film size={36} /> : asset.kind === 'Image' ? <Image size={36} /> : <FileCode2 size={36} />;
}

export default function MyAssets({ projects, open, error }: { projects: Project[]; open: (id: string) => void; error: string }) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [storedAssets, setStoredAssets] = useState<Record<string, ProjectAsset[]>>({});
  const [listError, setListError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<(ProjectAsset & { project: Project; id: string }) | null>(null);
  const deletingRef = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deleteTarget) return;
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, [deleteTarget]);
  const projectIds = JSON.stringify(projects.map(project => project.id).sort());
  useEffect(() => {
    let cancelled = false;
    setListError(''); setStoredAssets({});
    const ids: string[] = JSON.parse(projectIds);
    for (const id of ids) void readUploadedAssets(id).then(files => {
      if (!cancelled) setStoredAssets(items => ({ ...items, [id]: files }));
    }).catch(() => { if (!cancelled) setListError('Some older uploads could not be loaded. Reopen My assets to retry.'); });
    return () => { cancelled = true; };
  }, [projectIds]);
  const upload = async (files: File[]) => {
    if (uploading.current || !files.length) return;
    uploading.current = true; setUploadingFiles(true); setDownloadError(''); setUploadStatus('');
    const failures: string[] = []; let saved = 0;
    try {
      for (const file of files) {
        try { await uploadLibraryFile(file); saved++; }
        catch (cause) { failures.push(`${file.name}: ${cause instanceof Error ? cause.message : 'Upload failed.'}`); }
      }
      setUploadStatus(`${saved} ${saved === 1 ? 'file' : 'files'} saved to My assets.`);
      setDownloadError(failures.join(' '));
    } finally { uploading.current = false; setUploadingFiles(false); }
  };
  const assets = projects.flatMap(project => {
    const files = [...new Map([...(storedAssets[project.id] ?? []), ...(project.assets ?? [])].map(file => [file.key ?? file.name, file])).values()];
    if ((project.hasContent ?? project.scene.layers.length > 0) && project.type === 'SVG' && !files.some(file => file.kind === 'SVG')) files.push({ name: `${project.scene.name}.svg`, kind: 'SVG' as const });
    return files.map(file => ({ ...file, project, id: `${project.id}:${file.key ?? file.name}` }));
  });
  const unique = new Map<string, typeof assets[number]>();
  for (const asset of assets) {
    const identity = asset.key ? `${asset.kind}:${asset.name}:${asset.key.split('/').at(-2)}` : asset.id;
    const previous = unique.get(identity);
    if (!previous || (previous.project.libraryOnly && !asset.project.libraryOnly)) unique.set(identity, asset);
  }
  const filtered = [...unique.values()].filter(asset => `${asset.name} ${asset.project.scene.name} ${asset.kind}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const download = async (asset: typeof assets[number]) => {
    if (busy || deletingRef.current) return;
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
  const remove = async () => {
    if (!deleteTarget || deletingRef.current || busy) return;
    deletingRef.current = true; setDeleting(true); setDownloadError('');
    try {
      await deleteAsset(deleteTarget.project.id, deleteTarget);
      setUploadStatus('Asset, linked projects and all their files deleted.');
      setDeleteTarget(null);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : 'Could not delete this asset. Please retry.'); }
    finally { deletingRef.current = false; setDeleting(false); }
  };
  return <section className="ma-page">
    <header className="pd-header"><div><div className="ap-eyebrow">LIBRARY</div><h1>My assets</h1><p>All your uploaded photos, SVGs, videos and files.</p></div><button className="pd-button pd-primary" disabled={uploadingFiles} onClick={() => picker.current?.click()}><Upload size={16} />{uploadingFiles ? 'Uploading…' : 'Upload files'}</button></header>
    <input ref={picker} hidden multiple type="file" aria-label="Upload asset files" disabled={uploadingFiles} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void upload(files); }} />
    {uploadStatus && <p className="ma-upload-status" role="status">{uploadStatus}</p>}
    <div className="ma-toolbar"><div className="pd-search"><Search size={16} /><input aria-label="Search assets" placeholder="Search your assets" value={search} onChange={event => setSearch(event.target.value)} /></div><span>{filtered.length} {filtered.length === 1 ? 'asset' : 'assets'}</span></div>
    {(error || downloadError || listError) && <div className="pd-warning" role="alert">{downloadError || error || listError}</div>}
    {filtered.length ? <div className="pd-grid">{filtered.map(asset => <article className="pd-card ma-card" key={asset.id}>
      {asset.project.libraryOnly ? <div className="pd-preview"><AssetPreview asset={asset} project={asset.project} /></div> : <button className="pd-preview" aria-label={`Open project for ${asset.name}`} onClick={() => open(asset.project.id)}><AssetPreview asset={asset} project={asset.project} /></button>}
      <div className="pd-card-details"><strong title={asset.name}>{asset.name}</strong><p>{asset.kind}{!asset.project.libraryOnly && ` · ${asset.project.scene.name}`}</p><div className="ma-actions"><button className="pd-button" disabled={busy !== null || deleting} aria-label={`Download ${asset.name}`} onClick={() => void download(asset)}><Download size={14} />{busy === asset.id ? 'Downloading…' : 'Download'}</button><button className="pd-button ma-delete" disabled={busy !== null || deleting || uploadingFiles} aria-label={`Delete ${asset.name}`} onClick={() => { setDownloadError(''); setDeleteTarget(asset); }}><Trash2 size={14} />Delete</button>{!asset.project.libraryOnly && <button className="pd-icon" aria-label={`Edit project for ${asset.name}`} onClick={() => open(asset.project.id)}><ArrowUpRight size={16} /></button>}</div></div>
    </article>)}</div> : !error && <div className="pd-empty"><div><FolderOpen size={30} /></div><h2>{search ? 'No matching assets' : 'Your asset library starts here'}</h2><p>{search ? 'Try a different file or project name.' : 'Import files or save a project to see its assets here.'}</p>{search && <button className="pd-button" onClick={() => setSearch('')}>Clear search</button>}</div>}
    {deleteTarget && <div className="pd-modal-backdrop" onPointerDown={event => { if (!deleting && event.target === event.currentTarget) setDeleteTarget(null); }}><div className="pd-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ma-delete-title" aria-describedby="ma-delete-description" onKeyDown={event => {
      if (event.key === 'Escape' && !deleting) setDeleteTarget(null);
      if (event.key === 'Tab') {
        const buttons = [...dialog.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}><div className="pd-modal-heading"><h2 id="ma-delete-title">Delete asset everywhere?</h2><button className="pd-icon" aria-label="Close delete dialog" disabled={deleting} onClick={() => setDeleteTarget(null)}><X size={18} /></button></div><p id="ma-delete-description">“{deleteTarget.name}” and matching uploaded copies will be removed. This also permanently deletes their linked projects and all files, previews and saved drafts. This cannot be undone.</p>{downloadError && <div className="pd-warning" role="alert">{downloadError}</div>}<div className="pd-modal-actions"><button className="pd-button" data-cancel disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="pd-button pd-delete-button" disabled={deleting} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Delete everywhere'}</button></div></div></div>}
  </section>;
}
