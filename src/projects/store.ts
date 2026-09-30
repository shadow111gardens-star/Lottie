import { initialScene, uid, type Scene } from '../editor/model';
import { validateScene } from '../editor/io';

const SCENE = 'kinetic:';
const META = 'kinetic-project-meta:';
const TRASH = 'kinetic-project-trash:';
export const PROJECTS_CHANGED = 'kinetic-projects-changed';
type Metadata = { createdAt: number | null; editedAt: number | null; openedAt: number | null };
export type Project = Metadata & { id: string; scene: Scene; type: 'Animation' | 'SVG' };
export type Sort = 'activity' | 'edited' | 'created' | 'name-asc' | 'name-desc';
const blankMetadata = (): Metadata => ({ createdAt: null, editedAt: null, openedAt: null });
function metadata(id: string): Metadata {
  try {
    const value = JSON.parse(localStorage.getItem(META + id) || 'null');
    const date = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
    return { createdAt: date(value?.createdAt), editedAt: date(value?.editedAt), openedAt: date(value?.openedAt) };
  } catch { return blankMetadata(); }
}
function notify() { window.dispatchEvent(new Event(PROJECTS_CHANGED)); }

/** Observe existing scene saves without altering the editor or its JSON format.
 * Only changed local scene content affects edit time; opening a project does not.
 */
export function installProjectTracking(): () => void {
  let storage: Storage;
  try { storage = localStorage; } catch { return () => {}; }
  const prototype = Object.getPrototypeOf(storage) as Storage;
  const original = prototype.setItem;
  const tracked: Storage['setItem'] = function(this: Storage, key, value) {
    const isScene = this === storage && String(key).startsWith(SCENE);
    const previous = isScene ? this.getItem(key) : null;
    original.call(this, key, value); // Keep original quota/failure behavior.
    if (!isScene || previous === String(value)) return;
    try {
      validateScene(JSON.parse(String(value)));
      // A normalization-only save of an old project is not a user edit.
      if (previous && JSON.stringify(validateScene(JSON.parse(previous))) === JSON.stringify(validateScene(JSON.parse(String(value))))) return;
      const id = String(key).slice(SCENE.length), meta = metadata(id), now = Date.now();
      original.call(this, META + id, JSON.stringify({ ...meta, createdAt: previous === null ? now : meta.createdAt, editedAt: now }));
    } catch { /* Scene writes must succeed even if optional metadata cannot be saved. */ }
    notify();
  };
  prototype.setItem = tracked;
  return () => { if (prototype.setItem === tracked) prototype.setItem = original; };
}
export function readProjects(): { projects: Project[]; invalid: number } {
  const projects: Project[] = []; let invalid = 0;
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(k => k.startsWith(SCENE));
  for (const key of keys) {
    try {
      const scene = validateScene(JSON.parse(localStorage.getItem(key)!));
      const animated = scene.layers.some(l => Object.values(l.tracks).some(keys => keys && keys.length > 0));
      const id = key.slice(SCENE.length);
      projects.push({ id, scene, type: animated ? 'Animation' : 'SVG', ...metadata(id) });
    } catch { invalid++; }
  }
  return { projects, invalid };
}
function readScene(id: string): Scene {
  const raw = localStorage.getItem(SCENE + id);
  if (!raw) throw new Error('This project is no longer available.');
  return validateScene(JSON.parse(raw));
}
export function createProject(name = 'Untitled scene', scene?: Scene): string {
  const id = `new-${uid()}`;
  const next = scene ? structuredClone(validateScene(scene)) : { ...initialScene(), layers: [] };
  next.name = name.trim() || 'Untitled scene';
  const now = Date.now();
  // Metadata first: rollback if the actual project cannot be persisted.
  localStorage.setItem(META + id, JSON.stringify({ createdAt: now, editedAt: now, openedAt: null }));
  try { localStorage.setItem(SCENE + id, JSON.stringify(next)); }
  catch (error) { localStorage.removeItem(META + id); throw error; }
  notify(); return id;
}
export function renameProject(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a project name.');
  if (trimmed.length > 120) throw new Error('Keep the name under 121 characters.');
  const scene = readScene(id);
  if (scene.name !== trimmed) localStorage.setItem(SCENE + id, JSON.stringify({ ...scene, name: trimmed }));
  notify();
}
export function duplicateProject(id: string): string {
  const scene = readScene(id), names = new Set(readProjects().projects.map(p => p.scene.name));
  const base = `${scene.name} copy`; let name = base, number = 2;
  while (names.has(name)) name = `${base} ${number++}`;
  return createProject(name, scene);
}
export function openProject(id: string) {
  readScene(id);
  localStorage.setItem(META + id, JSON.stringify({ ...metadata(id), openedAt: Date.now() }));
  notify();
}
export function deleteProject(id: string) {
  const scene = readScene(id);
  localStorage.setItem(TRASH + id, JSON.stringify({ scene, metadata: metadata(id) }));
  localStorage.removeItem(SCENE + id);
  localStorage.removeItem(META + id);
  notify();
}
export function restoreProject(id: string) {
  const raw = localStorage.getItem(TRASH + id);
  if (!raw) throw new Error('The deleted project is no longer available.');
  if (localStorage.getItem(SCENE + id)) throw new Error('A project with this ID already exists.');
  const backup = JSON.parse(raw), scene = validateScene(backup.scene);
  localStorage.setItem(SCENE + id, JSON.stringify(scene));
  localStorage.setItem(META + id, JSON.stringify(backup.metadata));
  localStorage.removeItem(TRASH + id);
  notify();
}
export function sortProjects(projects: Project[], sort: Sort): Project[] {
  const activity = (p: Project) => Math.max(p.editedAt || 0, p.openedAt || 0);
  return [...projects].sort((a, b) => {
    if (sort === 'name-asc' || sort === 'name-desc') return a.scene.name.localeCompare(b.scene.name, undefined, { numeric: true, sensitivity: 'base' }) * (sort === 'name-desc' ? -1 : 1) || a.id.localeCompare(b.id);
    const difference = sort === 'edited' ? (b.editedAt || 0) - (a.editedAt || 0) : sort === 'created' ? (b.createdAt || 0) - (a.createdAt || 0) : activity(b) - activity(a);
    return difference || a.scene.name.localeCompare(b.scene.name) || a.id.localeCompare(b.id);
  });
}
export function editedLabel(timestamp: number | null, now = Date.now()): string {
  if (!timestamp) return 'Edit time unavailable';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return 'Edited just now';
  if (minutes < 60) return `Edited ${minutes}m ago`;
  if (minutes < 1440) return `Edited ${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `Edited ${Math.floor(minutes / 1440)}d ago`;
  return `Edited ${new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
