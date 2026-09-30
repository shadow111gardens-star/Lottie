import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Clock, LayoutGrid, ArrowUpRight, Upload, Sparkles, MoreHorizontal, Pencil, Copy, Trash2, X, Film, FileCode2, ArrowDownWideNarrow, FolderOpen, Check, HardDrive } from 'lucide-react';
import { exportSceneSvg, validateScene } from './editor/io';
import { importSvg } from './editor/importSvg';
import { exportRenderedLottieSvg } from './editor/lottieRenderer';
import { initialScene } from './editor/model';
import { PROJECTS_CHANGED, createProject, deleteProject, duplicateProject, editedLabel, openProject, readProjects, renameProject, restoreProject, sortProjects, type Project, type Sort } from './projects/store';
import './projects/dashboard.css';

type Action = 'open' | 'rename' | 'duplicate' | 'delete';
function ProjectCard({ project, menuOpen, setMenu, action, now }: { project: Project; menuOpen: boolean; setMenu: (id: string | null) => void; action: (action: Action, project: Project) => void; now: number }) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [thumbnail, setThumbnail] = useState<{ scene: Project['scene']; url: string | null; failed: boolean } | null>(null);
  const hasContent = project.scene.layers.some(l => l.visible);
  const preview = thumbnail?.scene === project.scene ? thumbnail.url : null;
  useEffect(() => {
    let cancelled = false;
    const scene = project.scene;
    async function renderPreview() {
      try {
        const time = Math.min(1.5, scene.duration / 2);
        const svg = !hasContent ? null : scene.lottie
          ? await exportRenderedLottieSvg(scene, time, false)
          : exportSceneSvg(scene, time, false);
        if (!cancelled) setThumbnail({ scene, url: svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null, failed: false });
      } catch (error) {
        console.warn(`[Dashboard preview] ${scene.name}`, error);
        if (!cancelled) setThumbnail({ scene, url: null, failed: true });
      }
    }
    void renderPreview();
    return () => { cancelled = true; };
  }, [project.scene, hasContent]);
  useEffect(() => { if (menuOpen) menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(); }, [menuOpen]);
  return <article className="pd-card" data-project-id={project.id}>
    <Link to={`/editor/${encodeURIComponent(project.id)}`} className="pd-preview" aria-label={`Open ${project.scene.name}`} onClick={e => { e.preventDefault(); action('open', project); }}>
      {preview ? <img src={preview} alt={`Preview of ${project.scene.name}`} loading="lazy" /> : <div className="pd-empty-preview"><FileCode2 size={28} strokeWidth={1.3} /><span>{!hasContent ? 'Blank canvas' : thumbnail?.scene === project.scene && thumbnail.failed ? 'Preview unavailable' : 'Loading preview…'}</span></div>}
      <span className="pd-preview-open">Open editor <ArrowUpRight size={14} /></span>
      <span className="pd-dimensions">{project.scene.width} × {project.scene.height}</span>
    </Link>
    <div className="pd-card-details"><div className="pd-card-title"><Link to={`/editor/${encodeURIComponent(project.id)}`} title={project.scene.name} onClick={e => { e.preventDefault(); action('open', project); }}>{project.scene.name}</Link>
      <div className="pd-menu-anchor" onPointerDown={e => e.stopPropagation()}><button ref={trigger} className={`pd-icon ${menuOpen ? 'is-active' : ''}`} aria-label={`Actions for ${project.scene.name}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenu(menuOpen ? null : project.id)}><MoreHorizontal size={19} /></button>
        {menuOpen && <div ref={menu} role="menu" aria-label={`${project.scene.name} actions`} className="pd-menu" onKeyDown={e => { const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]; const index = items.indexOf(document.activeElement as HTMLButtonElement); if (e.key === 'Escape') { e.preventDefault(); setMenu(null); trigger.current?.focus(); } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); } if (e.key === 'Tab') setMenu(null); }}>
          <button role="menuitem" onClick={() => action('open', project)}><ArrowUpRight size={15} />Open / Edit</button>
          <button role="menuitem" onClick={() => action('rename', project)}><Pencil size={15} />Rename</button>
          <button role="menuitem" onClick={() => action('duplicate', project)}><Copy size={15} />Duplicate</button>
          <div className="pd-menu-divider" />
          <button role="menuitem" className="pd-danger-text" onClick={() => action('delete', project)}><Trash2 size={15} />Delete</button>
        </div>}
      </div>
    </div><div className="pd-card-meta"><span className={`pd-type ${project.type === 'Animation' ? 'is-animation' : ''}`}>{project.type === 'Animation' ? <Film size={12} /> : <FileCode2 size={12} />}{project.type}</span><span className="pd-edit-time" title={project.editedAt ? new Date(project.editedAt).toLocaleString() : 'This older save has no timestamp. Future edits will be tracked.'}>{editedLabel(project.editedAt, now)}</span></div></div>
  </article>;
}

type DialogState = { type: 'rename' | 'delete'; project: Project };
function ProjectDialog({ dialog, close, submit }: { dialog: DialogState; close: () => void; submit: (name: string) => void }) {
  const [name, setName] = useState(dialog.project.scene.name);
  const box = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { const before = document.activeElement as HTMLElement | null; if (dialog.type === 'rename') { nameInput.current?.focus(); nameInput.current?.select(); } else box.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus(); return () => { if (before?.isConnected) before.focus(); }; }, [dialog.type]);
  return <div className="pd-modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}><div className="pd-modal" role="dialog" aria-modal="true" aria-labelledby="pd-dialog-title" aria-describedby="pd-dialog-description" ref={box} onKeyDown={e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const items = [...box.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input')]; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }}>
    <div className="pd-modal-heading"><h2 id="pd-dialog-title">{dialog.type === 'rename' ? 'Rename project' : 'Delete project?'}</h2><button className="pd-icon" aria-label="Close dialog" onClick={close}><X size={18} /></button></div>
    <p id="pd-dialog-description">{dialog.type === 'rename' ? 'Give your project a name that’s easy to find.' : <>“{dialog.project.scene.name}” will be removed from your projects. You can undo this from the confirmation message.</>}</p>
    <form onSubmit={e => { e.preventDefault(); submit(name); }}>
      {dialog.type === 'rename' && <label className="pd-name-label">Project name<input ref={nameInput} aria-label="Project name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>}
      <div className="pd-modal-actions"><button type="button" className="pd-button" data-cancel onClick={close}>Cancel</button><button type="submit" className={`pd-button ${dialog.type === 'delete' ? 'pd-delete-button' : 'pd-primary'}`} disabled={dialog.type === 'rename' && !name.trim()}>{dialog.type === 'rename' ? 'Save name' : 'Delete project'}</button></div>
    </form>
  </div></div>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'recents' | 'all'>('recents');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('activity');
  const [projects, setProjects] = useState<Project[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo?: string; error?: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => { try { const result = readProjects(); setProjects(result.projects); setInvalid(result.invalid); setLoadError(''); } catch { setLoadError('Browser storage is unavailable. Allow local storage to access your projects.'); } };
  useEffect(() => {
    refresh();
    const previousTitle = document.title; document.title = 'Projects — Kinetic';
    const storage = (e: StorageEvent) => { if (!e.key || e.key.startsWith('kinetic:') || e.key.startsWith('kinetic-project-meta:')) refresh(); };
    window.addEventListener(PROJECTS_CHANGED, refresh); window.addEventListener('storage', storage); window.addEventListener('focus', refresh);
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { document.title = previousTitle; window.removeEventListener(PROJECTS_CHANGED, refresh); window.removeEventListener('storage', storage); window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, []);
  useEffect(() => { if (!menu) return; const dismiss = () => setMenu(null); document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss); }, [menu]);
  const fail = (error: unknown) => setNotice({ text: error instanceof Error && error.name !== 'QuotaExceededError' ? error.message : 'Could not save this change. Your browser storage may be full.', error: true });
  const open = (id: string) => { openProject(id); navigate(`/editor/${encodeURIComponent(id)}`); };
  const create = () => { try { const id = createProject(); open(id); } catch (error) { fail(error); } };
  const action = (type: Action, project: Project) => {
    setMenu(null);
    try {
      if (type === 'open') open(project.id);
      else if (type === 'rename' || type === 'delete') setDialog({ type, project });
      else { const id = duplicateProject(project.id); setActiveTab('all'); setSearch(''); setSort('activity'); refresh(); setNotice({ text: `Created a copy of “${project.scene.name}”.` }); setMenu(null); if (!id) throw new Error('Could not duplicate the project.'); }
    } catch (error) { fail(error); refresh(); }
  };
  const submit = (name: string) => {
    if (!dialog) return;
    try {
      if (dialog.type === 'rename') { renameProject(dialog.project.id, name); setNotice({ text: 'Project renamed.' }); }
      else { deleteProject(dialog.project.id); setNotice({ text: `Deleted “${dialog.project.scene.name}”.`, undo: dialog.project.id }); }
      setDialog(null); refresh();
    } catch (error) { fail(error); }
  };
  const recent = sortProjects(projects, 'activity').slice(0, 12);
  const source = search.trim() || activeTab === 'all' ? projects : recent;
  const filtered = sortProjects(source.filter(p => `${p.scene.name} ${p.type}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), sort);
  return <div className="pd-dashboard">
    <aside className="pd-sidebar"><div className="pd-account"><div className="pd-avatar">S</div><div><strong>shadow</strong><span>Personal workspace</span></div></div><div className="pd-nav-label">WORKSPACE</div>
      <nav aria-label="Project navigation"><button className={activeTab === 'recents' ? 'is-selected' : ''} onClick={() => { setActiveTab('recents'); setMenu(null); }}><Clock size={18} />Recents<span>{recent.length}</span></button><button className={activeTab === 'all' ? 'is-selected' : ''} onClick={() => { setActiveTab('all'); setMenu(null); }}><LayoutGrid size={18} />All projects<span>{projects.length}</span></button></nav>
      <div className="pd-sidebar-note"><Sparkles size={19} /><h3>Your next idea<br />should move.</h3><p>Start with a blank canvas.<br />Make something worth watching.</p><button onClick={create}>Create an animation <ArrowUpRight size={15} /></button></div><div className="pd-local"><HardDrive size={13} /><span>Saved on this device</span><i /></div>
    </aside>
    <main className="pd-main"><div className="pd-content"><header className="pd-header"><div><h1>{activeTab === 'recents' ? 'Recents' : 'All projects'}</h1><p>{projects.length ? 'Pick up where you left off, or start something new.' : 'A home for your ideas in motion.'}</p></div><div className="pd-header-actions"><div className="pd-search"><Search size={17} /><input aria-label="Search projects" placeholder="Search projects" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</div><button className="pd-button" onClick={() => fileInput.current?.click()} disabled={importing}><Upload size={16} />{importing ? 'Importing…' : 'Import'}</button><button className="pd-button pd-primary" onClick={create}><Plus size={18} />New project</button></div></header>
      <div className="pd-list-toolbar"><div><strong>{filtered.length}</strong> {filtered.length === 1 ? 'project' : 'projects'}{search.trim() && <span> matching “{search.trim()}”</span>}{!search.trim() && activeTab === 'recents' && projects.length > 12 && <span> · most recently opened or edited</span>}</div><label className="pd-sort"><ArrowDownWideNarrow size={15} /><select aria-label="Sort projects" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="activity">Recently active</option><option value="edited">Last edited</option><option value="created">Newest created</option><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option></select></label></div>
      {(loadError || invalid > 0) && <div className="pd-warning" role="alert">{loadError || `${invalid} unreadable ${invalid === 1 ? 'save was' : 'saves were'} skipped. Those files have not been changed.`}</div>}
      {filtered.length > 0 ? <div className="pd-grid">{filtered.map(project => <ProjectCard key={project.id} project={project} menuOpen={menu === project.id} setMenu={setMenu} action={action} now={now} />)}</div> : !loadError && <div className="pd-empty"><div>{search ? <Search size={28} /> : <FolderOpen size={30} />}</div><h2>{search ? 'No matching projects' : 'Your first idea starts here'}</h2><p>{search ? 'Try another name or search for SVG or Animation.' : 'Create a project or import an SVG to start building.'}</p><button className="pd-button pd-primary" onClick={search ? () => setSearch('') : create}>{search ? 'Clear search' : <><Plus size={16} />Create your first project</>}</button></div>}
    </div></main>
    <input ref={fileInput} hidden type="file" accept=".svg,.json" aria-label="Import project file" onChange={async e => { const input = e.currentTarget, file = input.files?.[0]; if (!file) return; setImporting(true); try { const text = await file.text(); let id: string; if (/\.json$/i.test(file.name)) { const scene = validateScene(JSON.parse(text)); id = createProject(scene.name, scene); } else { const scene = initialScene(file.name.replace(/\.svg$/i, '')); scene.layers = importSvg(text, file.name).reverse(); const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement; const viewBox = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number); const width = parseFloat(root.getAttribute('width') || '') || viewBox[2]; const height = parseFloat(root.getAttribute('height') || '') || viewBox[3]; if (width >= 100 && width <= 4096) scene.width = width; if (height >= 100 && height <= 4096) scene.height = height; id = createProject(scene.name, scene); } setSearch(''); setActiveTab('all'); setSort('activity'); refresh(); setNotice({ text: /\.svg$/i.test(file.name) ? 'SVG imported. Basic vector shapes are editable; transforms, gradients and CSS styles are not imported.' : 'Project imported. Open its card to keep editing.' }); setMenu(null); if (!id) throw new Error('Import failed.'); } catch (error) { fail(error); } finally { input.value = ''; setImporting(false); } }} />
    {dialog && <ProjectDialog key={`${dialog.type}-${dialog.project.id}`} dialog={dialog} close={() => setDialog(null)} submit={submit} />}
    {notice && <div className={`pd-toast ${notice.error ? 'pd-toast-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{!notice.error && <Check size={16} />}<span>{notice.text}</span>{notice.undo && <button onClick={() => { try { restoreProject(notice.undo!); refresh(); setNotice({ text: 'Project restored.' }); } catch (error) { fail(error); } }}>Undo</button>}<button className="pd-toast-close" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button></div>}
  </div>;
}
