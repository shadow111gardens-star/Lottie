import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, LayoutGrid, ArrowUpRight, Upload, LogOut, MoreHorizontal, Pencil, Copy, Trash2, X, Film, FileCode2, ArrowDownWideNarrow, FolderOpen, Check, List, Filter, Image, ChevronDown, Crown } from 'lucide-react';
import { exportSceneSvg, validateScene } from './editor/io';
import { importSvg } from './editor/importSvg';
import { exportRenderedLottieSvg } from './editor/lottieRenderer';
import { initialScene } from './editor/model';
import { PROJECTS_CHANGED, cachedProjects, createBlankProject, createProject, deleteProject, duplicateProject, editedLabel, openProject, readProjects, renameProject, restoreProject, sortProjects, type Project, type Sort } from './projects/store';
import { PROJECT_REMOVED, projectStopped } from './projects/lifecycle';
import './projects/dashboard.css';
import './projects/all-projects.css';
import { projectCategory, type ProjectCategory } from './projects/category';
import PngToSvg from './projects/PngToSvg';
import MyAssets from './projects/MyAssets';
import './projects/sidebar.css';
import { getFirebaseAuth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type Action = 'open' | 'rename' | 'duplicate' | 'delete';
function ProjectCard({ project, menuOpen, setMenu, action, now, showCategory, pending }: { pending?: string; showCategory?: boolean; project: Project; menuOpen: boolean; setMenu: (id: string | null) => void; action: (action: Action, project: Project) => void; now: number }) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [thumbnail, setThumbnail] = useState<{ scene: Project['scene']; url: string | null; failed: boolean } | null>(null);
  const hasContent = project.hasContent ?? project.scene.layers.some(l => l.visible);
  const preview = project.preview || (thumbnail?.scene === project.scene ? thumbnail.url : null);
  useEffect(() => {
    let cancelled = false;
    const scene = project.scene;
    if (project.hasContent !== undefined) { setThumbnail({ scene, url: null, failed: hasContent }); return; }
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
  return <article className={`pd-card ${pending ? 'pd-card-pending' : ''}`} aria-busy={!!pending} data-project-id={project.id}>
    <Link to={`/editor/${encodeURIComponent(project.id)}`} className="pd-preview" aria-label={`Open ${project.scene.name}`} onClick={e => { e.preventDefault(); if (!pending) action('open', project); }}>
      {preview ? <img src={preview} alt={`Preview of ${project.scene.name}`} loading="lazy" /> : <div className="pd-empty-preview"><FileCode2 size={28} strokeWidth={1.3} /><span>{!hasContent ? 'Blank canvas' : thumbnail?.scene === project.scene && thumbnail.failed ? 'Preview unavailable' : 'Loading preview…'}</span></div>}
      <span className="pd-preview-open">Open editor <ArrowUpRight size={14} /></span>
      <span className="pd-dimensions">{project.scene.width} × {project.scene.height}</span>
    </Link>
    <div className="pd-card-details"><div className="pd-card-title"><Link to={`/editor/${encodeURIComponent(project.id)}`} title={project.scene.name} onClick={e => { e.preventDefault(); if (!pending) action('open', project); }}>{project.scene.name}</Link>
      <div className="pd-menu-anchor" onPointerDown={e => e.stopPropagation()}><button ref={trigger} className={`pd-icon ${menuOpen ? 'is-active' : ''}`} aria-label={`Actions for ${project.scene.name}`} aria-haspopup="menu" aria-expanded={menuOpen} disabled={!!pending} onClick={() => setMenu(menuOpen ? null : project.id)}><MoreHorizontal size={19} /></button>
        {menuOpen && <div ref={menu} role="menu" aria-label={`${project.scene.name} actions`} className="pd-menu" onKeyDown={e => { const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]; const index = items.indexOf(document.activeElement as HTMLButtonElement); if (e.key === 'Escape') { e.preventDefault(); setMenu(null); trigger.current?.focus(); } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); } if (e.key === 'Tab') setMenu(null); }}>
          <button role="menuitem" onClick={() => action('open', project)}><ArrowUpRight size={15} />Open / Edit</button>
          <button role="menuitem" onClick={() => action('rename', project)}><Pencil size={15} />Rename</button>
          <button role="menuitem" onClick={() => action('duplicate', project)}><Copy size={15} />Duplicate</button>
          <div className="pd-menu-divider" />
          <button role="menuitem" className="pd-danger-text" onClick={() => action('delete', project)}><Trash2 size={15} />Delete</button>
        </div>}
      </div>
    </div><div className="pd-card-meta">{pending && <span className="pd-action-progress" role="status">{pending}</span>}<span className={`pd-type ${project.type === 'Animation' ? 'is-animation' : ''}`}>{project.type === 'Animation' ? <Film size={12} /> : <FileCode2 size={12} />}{showCategory ? projectCategory(project) : project.type}</span><span className="pd-edit-time" title={project.editedAt ? new Date(project.editedAt).toLocaleString() : 'This older save has no timestamp. Future edits will be tracked.'}>{editedLabel(project.editedAt, now)}</span></div></div>
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
  const [activeTab, setActiveTab] = useState<'all' | 'png-svg' | 'assets'>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProjectCategory | 'All'>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [contentOnly, setContentOnly] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); } }; window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut); }, []);
  const [sort, setSort] = useState<Sort>('activity');
  const [projects, setProjects] = useState<Project[]>(() => cachedProjects().projects);
  const pending = useRef(new Map<string, { kind: 'rename' | 'duplicate' | 'delete'; project: Project }>());
  const [working, setWorking] = useState<Record<string, string>>({});
  const mergePending = (items: Project[]) => { let next = items; for (const [id, operation] of pending.current) { if (operation.kind === 'delete') next = next.filter(item => item.id !== id); else if (operation.kind === 'rename') next = next.map(item => item.id === id ? operation.project : item); else if (!next.some(item => item.id === id)) next = [operation.project, ...next]; } return next; };
  const markWorking = (id: string, label?: string) => setWorking(items => { const next = { ...items }; if (label) next[id] = label; else delete next[id]; return next; });
  const [invalid, setInvalid] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo?: string; error?: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [importing, setImporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountName, setAccountName] = useState('shadow');
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void Promise.all([import('./lib/firebase'), import('firebase/auth')]).then(([{ auth }, { onAuthStateChanged }]) => {
      if (!disposed && auth) unsubscribe = onAuthStateChanged(auth, user => setAccountName(user?.displayName || user?.email?.split('@')[0] || 'shadow'));
    }).catch((error: unknown) => console.warn('Could not load account details:', error));
    return () => { disposed = true; unsubscribe?.(); };
  }, []);
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const [{ auth }, { signOut }] = await Promise.all([import('./lib/firebase'), import('firebase/auth')]);
      if (auth) await signOut(auth);
      navigate('/', { replace: true });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Could not log out. Please try again.', error: true });
      setLoggingOut(false);
    }
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const refreshVersion = useRef(0);
  const refresh = async () => {
    const version = ++refreshVersion.current;
    try { const result = await readProjects(project => { if (version === refreshVersion.current) setProjects(items => mergePending(items.map(item => item.id === project.id ? { ...item, preview: project.preview } : item))); }); if (version !== refreshVersion.current) return; setProjects(mergePending(result.projects)); setInvalid(result.invalid); setLoadError(''); }
    catch (error) { if (version === refreshVersion.current) { setLoadError(error instanceof Error ? error.message : 'Could not load projects. Please retry.'); } }
  };
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try { unsubscribe = onAuthStateChanged(getFirebaseAuth(), user => { ++refreshVersion.current; setProjects(cachedProjects().projects); if (user) void refresh(); else navigate('/', { replace: true }); }); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Authentication is unavailable.'); }
    const previousTitle = document.title; document.title = 'Projects — Kinetic';
    const removed = () => { ++refreshVersion.current; setProjects(items => items.filter(project => !projectStopped(getFirebaseAuth().currentUser?.uid ?? '', project.id))); };
    window.addEventListener(PROJECT_REMOVED, removed);
    window.addEventListener(PROJECTS_CHANGED, refresh); window.addEventListener('focus', refresh);
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { ++refreshVersion.current; unsubscribe?.(); document.title = previousTitle; window.removeEventListener(PROJECT_REMOVED, removed); window.removeEventListener(PROJECTS_CHANGED, refresh); window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, []);
  useEffect(() => { if (!menu) return; const dismiss = () => setMenu(null); document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss); }, [menu]);
  const fail = (error: unknown) => setNotice({ text: error instanceof Error && error.name !== 'QuotaExceededError' ? error.message : 'Could not save this change. Your browser storage may be full.', error: true });
  const open = async (id: string) => { const user = getFirebaseAuth().currentUser; if (user && !projectStopped(user.uid, id)) { const activity = openProject(id, true); navigate(`/editor/${encodeURIComponent(id)}`); void activity.catch(error => console.warn('Could not record project activity:', error)); } };
  const creating = useRef(false);
  const create = () => {
    if (creating.current) return;
    creating.current = true;
    try { const project = createBlankProject(); navigate(`/editor/${encodeURIComponent(project.id)}`); }
    catch (error) { creating.current = false; fail(error); }
  };
  const action = async (type: Action, project: Project) => {
    if (pending.current.has(project.id) || working[project.id]) return;
    setMenu(null);
    if (type === 'open') { await open(project.id); return; }
    if (type === 'rename' || type === 'delete') { setDialog({ type, project }); return; }
    const temporaryId = `pending-copy-${project.id}`;
    if (pending.current.has(temporaryId)) return;
    const names = new Set(projects.map(item => item.scene.name));
    const base = `${project.scene.name} copy`; let name = base, number = 2;
    while (names.has(name)) name = `${base} ${number++}`;
    const copy = { ...project, id: temporaryId, scene: { ...project.scene, name }, createdAt: Date.now(), editedAt: Date.now(), openedAt: null };
    pending.current.set(temporaryId, { kind: 'duplicate', project: copy });
    markWorking(project.id, 'Duplicating?'); markWorking(temporaryId, 'Saving copy?');
    ++refreshVersion.current; setProjects(items => [copy, ...items]);
    setActiveTab('all'); setSearch(''); setCategory('All'); setContentOnly(false); setSort('activity');
    try {
      const id = await duplicateProject(project.id);
      if (!id) throw new Error('Could not duplicate the project.');
      setProjects(items => items.map(item => item.id === temporaryId ? { ...copy, id } : item));
      setNotice({ text: `Created a copy of "${project.scene.name}".` });
    } catch (error) { setProjects(items => items.filter(item => item.id !== temporaryId)); fail(error); }
    finally { pending.current.delete(temporaryId); markWorking(project.id); markWorking(temporaryId); void refresh(); }
  };
  const submit = async (name: string) => {
    if (!dialog || pending.current.has(dialog.project.id)) return;
    const { project, type } = dialog;
    const trimmed = name.trim();
    if (type === 'rename' && (!trimmed || trimmed.length > 120)) { fail(new Error('Enter a project name of up to 120 characters.')); return; }
    const updated = { ...project, scene: { ...project.scene, name: trimmed }, editedAt: Date.now() };
    pending.current.set(project.id, { kind: type, project: type === 'rename' ? updated : project });
    ++refreshVersion.current; setDialog(null); setMenu(null);
    if (type === 'rename') { markWorking(project.id, 'Saving name?'); setProjects(items => items.map(item => item.id === project.id ? updated : item)); }
    else { setProjects(items => items.filter(item => item.id !== project.id)); setNotice({ text: `Deleting "${project.scene.name}"?` }); }
    try {
      if (type === 'rename') { await renameProject(project.id, trimmed); setNotice({ text: 'Project renamed.' }); }
      else { await deleteProject(project.id); setNotice({ text: `Deleted "${project.scene.name}".`, undo: project.id }); }
    } catch (error) {
      if (type === 'rename') setProjects(items => items.map(item => item.id === project.id ? project : item));
      else if (!projectStopped(getFirebaseAuth().currentUser?.uid || '', project.id)) setProjects(items => items.some(item => item.id === project.id) ? items : [project, ...items]);
      fail(error);
    } finally { pending.current.delete(project.id); markWorking(project.id); void refresh(); }
  };
  const source = projects.filter(project => !project.libraryOnly);
  const filtered = sortProjects(source.filter(p => `${p.scene.name} ${p.type}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (activeTab !== 'all' || ((category === 'All' || projectCategory(p) === category) && (!contentOnly || (p.hasContent ?? p.scene.layers.some(layer => layer.visible)))))), sort);
  return <div className={`pd-dashboard ${activeTab !== 'png-svg' ? 'pd-all-projects' : ''}`}>
    <aside className="pd-sidebar"><div className="pd-account"><div className="pd-avatar">{accountName.charAt(0).toUpperCase()}</div><div><strong>{accountName}</strong><span>Personal workspace</span></div></div><div className="pd-nav-label">WORKSPACE</div>
      <nav aria-label="Project navigation"><button className={activeTab === 'all' ? 'is-selected' : ''} onClick={() => { setActiveTab('all'); setMenu(null); }}><LayoutGrid size={18} />All projects<span>{source.length}</span></button><button className={activeTab === 'png-svg' ? 'is-selected' : ''} onClick={() => { setActiveTab('png-svg'); setMenu(null); }}><Image size={18} />PNG → SVG<span className="pd-nav-new">New</span></button></nav><div className="pd-nav-label pd-library-label">LIBRARY</div><nav aria-label="Library navigation"><button aria-current={activeTab === 'assets' ? 'page' : undefined} className={activeTab === 'assets' ? 'is-selected' : ''} onClick={() => { setActiveTab('assets'); setMenu(null); }}><FolderOpen size={18} />My assets</button></nav><div className="pd-sidebar-bottom"><section className="pd-upgrade"><h2><Crown size={17} />Upgrade for more</h2><p>Explore plans for more storage and creative possibilities.</p><a href="/#pricing">Upgrade plan<ArrowUpRight size={14} /></a></section>
      <button type="button" className="pd-logout" onClick={() => void logout()} disabled={loggingOut} aria-busy={loggingOut}><LogOut size={20} strokeWidth={2.2} /><span>{loggingOut ? 'Logging out…' : 'Log out'}</span></button>
      </div>
    </aside>
    <main className="pd-main"><div className="pd-content">{activeTab === 'png-svg' ? <PngToSvg /> : activeTab === 'assets' ? <MyAssets projects={projects} open={id => void open(id)} error={loadError} /> : <>{activeTab === 'all' && <div className="ap-topbar"><div className="pd-search"><Search size={16} /><input ref={searchInput} aria-label="Search projects" placeholder="Search projects?" value={search} onChange={e => setSearch(e.target.value)} />{search ? <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button> : <kbd>Ctrl K</kbd>}</div><div className="ap-account"><span className="pd-avatar">{accountName.charAt(0).toUpperCase()}</span><strong>{accountName}</strong></div></div>}<header className="pd-header"><div>{activeTab === 'all' && <div className="ap-eyebrow">PROJECTS</div>}<h1>All projects</h1><p>{projects.length ? 'Pick up where you left off, or start something new.' : 'A home for your ideas in motion.'}</p></div><div className="pd-header-actions">{activeTab !== 'all' && <div className="pd-search"><Search size={17} /><input ref={searchInput} aria-label="Search projects" placeholder="Search projects" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</div>}<button className="pd-button" onClick={() => fileInput.current?.click()} disabled={importing}><Upload size={16} />{importing ? 'Importing…' : 'Import'}</button><button className="pd-button pd-primary" onClick={create}><Plus size={18} />New project</button></div>{activeTab === 'all' && <div className="ap-hero-art" aria-hidden="true"><div className="ap-folder ap-folder-back"/><div className="ap-folder ap-folder-front"><div className="ap-picture"><svg viewBox="0 0 100 90"><circle cx="75" cy="23" r="10"/><path d="M7 77L33 40Q36 35 40 40L52 56L67 38Q70 34 74 39L95 77Z"/></svg></div></div><svg className="ap-orbit" viewBox="0 0 300 160"><path d="M15 110C-20 50 300 15 275 100S40 155 15 110"/><circle cx="275" cy="95" r="5"/></svg></div>}</header>
      <div className="pd-list-toolbar">{activeTab === 'all' ? <div className="ap-types" role="group" aria-label="Project type">{(['All','SVG','Lottie','Video','Images'] as const).map(type => <button key={type} aria-pressed={category === type} onClick={() => { setCategory(type); setMenu(null); }} className={category === type ? 'is-active' : ''}>{type === 'All' ? <LayoutGrid size={14} /> : type === 'Video' ? <Film size={14} /> : type === 'Images' ? <Image size={14} /> : <FileCode2 size={14} />}{type}</button>)}</div> : <div><strong>{filtered.length}</strong> {filtered.length === 1 ? 'project' : 'projects'}{search.trim() && <span> matching “{search.trim()}”</span>}</div>}<div className="ap-toolbar-actions">{activeTab === 'all' && <div className="ap-views" role="group" aria-label="Project view"><button aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} /></button><button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} /></button></div>}<label className="pd-sort"><ArrowDownWideNarrow size={15} /><select aria-label="Sort projects" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="activity">Recently active</option><option value="edited">Last edited</option><option value="created">Newest created</option><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option></select></label>{activeTab === 'all' && <button className={`ap-filter ${contentOnly ? 'is-active' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}><Filter size={14} />Filter<ChevronDown size={12} /></button>}</div></div>
      {activeTab === 'all' && showFilters && <div className="ap-filter-panel"><label><input type="checkbox" checked={contentOnly} onChange={e => setContentOnly(e.target.checked)} />Only projects with content</label><button onClick={() => { setCategory('All'); setContentOnly(false); setSearch(''); }}>Reset filters</button></div>}
      {(loadError || invalid > 0) && <div className="pd-warning" role="alert">{loadError || `${invalid} unreadable ${invalid === 1 ? 'save was' : 'saves were'} skipped. Those files have not been changed.`}</div>}
      {filtered.length > 0 ? <div className={`pd-grid ${activeTab === 'all' && view === 'list' ? 'ap-list' : ''}`}>{filtered.map(project => <ProjectCard key={project.id} project={project} menuOpen={menu === project.id} setMenu={setMenu} action={action} now={now} showCategory={activeTab === 'all'} pending={working[project.id]} />)}{activeTab === 'all' && <button className="ap-new-card" onClick={create}><span><Plus size={28} /></span><strong>New project</strong><small>Create something amazing.</small></button>}</div> : !loadError && <div className="pd-empty"><div>{search ? <Search size={28} /> : <FolderOpen size={30} />}</div><h2>{search || category !== 'All' || contentOnly ? 'No matching projects' : 'Your first idea starts here'}</h2><p>{search || category !== 'All' || contentOnly ? 'Try another search or reset your filters.' : 'Create a project or import an SVG to start building.'}</p><button className="pd-button pd-primary" onClick={search || category !== 'All' || contentOnly ? () => { setSearch(''); setCategory('All'); setContentOnly(false); } : create}>{search || category !== 'All' || contentOnly ? 'Clear search' : <><Plus size={16} />Create your first project</>}</button></div>}
    </>}</div></main>
    <input ref={fileInput} hidden type="file" accept=".svg,.json" aria-label="Import project file" onChange={async e => { const input = e.currentTarget, file = input.files?.[0]; if (!file) return; setImporting(true); try { const text = await file.text(); let id: string; if (/\.json$/i.test(file.name)) { const scene = validateScene(JSON.parse(text)); scene.files = { ...scene.files, source: [...(scene.files?.source ?? []), { name: file.name, data: await (await import('./projects/storage')).dataUrl(file) }] }; id = await createProject(scene.name, scene); } else { const scene = initialScene(file.name.replace(/\.svg$/i, '')); scene.layers = importSvg(text, file.name).reverse(); scene.files = { svg: text, source: [{ name: file.name, data: await (await import('./projects/storage')).dataUrl(file) }] }; const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement; const viewBox = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number); const width = parseFloat(root.getAttribute('width') || '') || viewBox[2]; const height = parseFloat(root.getAttribute('height') || '') || viewBox[3]; if (width >= 100 && width <= 4096) scene.width = width; if (height >= 100 && height <= 4096) scene.height = height; id = await createProject(scene.name, scene); } setSearch(''); setActiveTab('all'); setSort('activity'); refresh(); setNotice({ text: /\.svg$/i.test(file.name) ? 'SVG imported. Basic vector shapes are editable; transforms, gradients and CSS styles are not imported.' : 'Project imported. Open its card to keep editing.' }); setMenu(null); if (!id) throw new Error('Import failed.'); } catch (error) { fail(error); } finally { input.value = ''; setImporting(false); } }} />
    {dialog && <ProjectDialog key={`${dialog.type}-${dialog.project.id}`} dialog={dialog} close={() => setDialog(null)} submit={submit} />}
    {notice && <div className={`pd-toast ${notice.error ? 'pd-toast-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{!notice.error && <Check size={16} />}<span>{notice.text}</span>{notice.undo && <button onClick={async () => { try { await restoreProject(notice.undo!); refresh(); setNotice({ text: 'Project restored.' }); } catch (error) { fail(error); } }}>Undo</button>}<button className="pd-toast-close" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button></div>}
  </div>;
}
