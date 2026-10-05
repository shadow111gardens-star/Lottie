import { sceneCategory, type ProjectCategory } from './category';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, firebaseError, getFirebaseAuth } from '../lib/firebase';
import { initialScene, uid, type Scene } from '../editor/model';
import { exportSceneSvg, validateScene } from '../editor/io';
import { exportLottie } from '../editor/lottie';
import { exportRenderedLottieSvg } from '../editor/lottieRenderer';
import { currentOwner, assertOwner, upload, assetBlob, prefix, digest, dataUrl, storageRequest } from './storage';
import { readDraft, writeDraft, removeDraft } from './drafts';
import { assertProjectActive, projectStopped, stopProject, resumeProject } from './lifecycle';
export { sortProjects, editedLabel } from './project-order';
export type Sort = 'activity' | 'edited' | 'created' | 'name-asc' | 'name-desc';
export const PROJECTS_CHANGED = 'kinetic-projects-changed';
export type ProjectAsset = { name: string; key?: string; kind: 'Image' | 'Video' | 'SVG' | 'Lottie' | 'File' };
export type Project = { assets?: ProjectAsset[]; id: string; scene: Scene; type: 'Animation' | 'SVG'; category?: ProjectCategory; createdAt: number | null; editedAt: number | null; openedAt: number | null; preview?: string; hasContent?: boolean; status?: string };
type Reference = { $r2: string; format: 'text' | 'dataUrl' };
const loaded = new Map<string, { scene: Scene; revision: string | null }>();
const queues = new Map<string, Promise<void>>();
const uploaded = new Set<string>();
const deleted = new Map<string, { scene: Scene; files: Map<string, Blob>; document: DocumentData }>();
const cleanupRetries = new Map<string, ReturnType<typeof setTimeout>>();
const creations = new Map<string, { scene: Scene; pending?: Promise<void>; timer?: ReturnType<typeof setTimeout>; attempts: number }>();
const cacheKey = (user: User, id: string) => `${user.uid}:${id}`;
let draftClock = Date.now();
const nextDraftTime = () => draftClock = Math.max(draftClock + 1, Date.now());
function firestore() { if (!db) throw firebaseError || new Error('Firestore is unavailable.'); return db; }
function reference(user: User, id: string) { return doc(firestore(), 'users', user.uid, 'projects', id); }
function notify() { window.dispatchEvent(new Event(PROJECTS_CHANGED)); }
function typeOf(scene: Scene): Project['type'] { return scene.lottie || scene.layers.some(layer => layer.media || Object.values(layer.tracks).some(keys => keys?.length)) ? 'Animation' : 'SVG'; }
function timestamp(value: any): number | null { return typeof value?.toMillis === 'function' ? value.toMillis() : null; }
function isReference(value: any): value is Reference { return !!value && typeof value === 'object' && typeof value.$r2 === 'string'; }

// Immutable content-addressed assets keep the last committed snapshot intact on failure.
async function putAsset(user: User, id: string, folder: string, name: string, blob: Blob): Promise<Reference> {
  assertProjectActive(user.uid, id);
  const path = `${folder}/${await digest(blob)}/${name}`, key = prefix(user, id) + path;
  if (!uploaded.has(key)) { await upload(user, id, path, blob); uploaded.add(key); }
  return { $r2: key, format: 'text' };
}
function collectReferences(value: any, keys = new Set<string>()): Set<string> {
  if (isReference(value)) keys.add(value.$r2);
  else if (Array.isArray(value)) value.forEach(item => collectReferences(item, keys));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectReferences(item, keys));
  return keys;
}
async function encodeScene(user: User, id: string, source: Scene) {
  // Regenerate SVGs from the editable layers, including recolors and deletions.
  const scene = source;
  const result: any = structuredClone(source);
  const framePaths = new Map<string, Scene['layers']>();
  for (const layer of source.layers) if (layer.sourceFrame) {
    const key = `${layer.sourceFrame.layer}:${layer.sourceFrame.frame}`;
    const list = framePaths.get(key) ?? [];
    list.push({ ...layer, startTime: undefined, endTime: undefined });
    framePaths.set(key, list);
  }
  if (result.files?.source) for (const file of result.files.source) file.data = { ...await putAsset(user, id, 'source', file.name.replace(/[^A-Za-z0-9_.-]/g, '_'), await (await fetch(file.data)).blob()), format: 'dataUrl' };
  const failures: string[] = [];
  for (const owner of result.layers) if (owner.media) for (const frame of owner.media.frames) {
    try {
    const name = String(frame.number).padStart(3, '0');
    frame.image = { ...await putAsset(user, id, `frames/${owner.id}`, `${name}.png`, await (await fetch(frame.image)).blob()), format: 'dataUrl' };
    if (frame.vector?.status === 'ready') {
      const paths = framePaths.get(`${owner.id}:${frame.id}`) ?? [];
      const svg = exportSceneSvg({ ...source, width: owner.media.width, height: owner.media.height, background: 'transparent', layers: paths }, frame.timestamp + (owner.startTime ?? 0), false);
      frame.vector.svg = await putAsset(user, id, `frames/${owner.id}`, `${name}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
    }
    } catch (error) { failures.push(`Frame ${frame.number} (${frame.timestamp}s): ${error instanceof Error ? error.message : 'Could not upload frame.'}`); }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  if (scene.files?.lottie || scene.lottie) {
    result.files ??= {};
    result.files.lottie = await putAsset(user, id, 'lottie', 'animation.json', new Blob([scene.files?.lottie || JSON.stringify(exportLottie(scene))], { type: 'application/json' }));
  }
  if (scene.files?.svg) result.files.svg = await putAsset(user, id, 'project', 'export.svg', new Blob([scene.files.svg], { type: 'image/svg+xml' }));
  if (!scene.lottie) {
    const svg = exportSceneSvg(scene, scene.editorView?.time ?? 0, false);
    result.files ??= {}; result.files.canvas = await putAsset(user, id, 'project', 'scene.svg', new Blob([svg], { type: 'image/svg+xml' }));
  }
  async function encode(value: any): Promise<any> {
    if (isReference(value)) return value;
    if (typeof value === 'string' && /^data:[^,]*;base64,/.test(value)) return { ...await putAsset(user, id, 'project', 'asset', await (await fetch(value)).blob()), format: 'dataUrl' };
    if (Array.isArray(value)) { const list = []; for (const item of value) list.push(await encode(item)); return list; }
    if (value && typeof value === 'object') { const object: Record<string, any> = {}; for (const [key, item] of Object.entries(value)) if (item !== undefined) object[key] = await encode(item); return object; }
    return value;
  }
  return encode(result);
}
async function hydrate(user: User, id: string, value: any): Promise<any> {
  const cache = new Map<string, Promise<string>>();
  async function decode(value: any): Promise<any> {
    if (isReference(value)) {
      let pending = cache.get(value.$r2);
      if (!pending) {
        const ref = value;
        pending = (async () => { const blob = await assetBlob(user, id, ref.$r2); uploaded.add(ref.$r2); return ref.format === 'dataUrl' ? dataUrl(blob) : blob.text(); })();
        cache.set(value.$r2, pending);
      }
      return pending;
    }
    if (Array.isArray(value)) return Promise.all(value.map(decode));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await decode(item)])));
    return value;
  }
  return decode(value);
}
type ProjectListing = { projects: Project[]; invalid: number };
const listings = new Map<string, ProjectListing>();
const thumbnailCache = new Map<string, Promise<string>>();
export function cachedProjects(): ProjectListing {
  const user = getFirebaseAuth().currentUser;
  const listing = user ? listings.get(user.uid) : undefined;
  return { projects: user ? (listing?.projects ?? []).filter(project => !projectStopped(user.uid, project.id)) : [], invalid: listing?.invalid ?? 0 };
}
export async function readProjects(onPreview?: (project: Project) => void): Promise<ProjectListing> {
  const user = await currentOwner();
  const snapshot = await getDocs(collection(firestore(), 'users', user.uid, 'projects'));
  assertOwner(user); let invalid = 0;
  const previous = listings.get(user.uid);
  const thumbnails: { project: Project; key: string }[] = [];
  const projects: Project[] = [];
  for (const item of snapshot.docs) {
    const data = item.data();
    if (projectStopped(user.uid, item.id) || ['creating', 'deleting'].includes(data.status)) continue;
    if (data.ownerId !== user.uid || data.projectId !== item.id || typeof data.name !== 'string') { invalid++; continue; }
    const scene = { ...initialScene(data.name), ...data.settings, name: data.name, layers: [] } as Scene;
    const old = previous?.projects.find(project => project.id === item.id);
    const project: Project = { id: item.id, scene, type: data.type, category: data.category ?? (data.r2?.lottie ? 'Lottie' : data.type === 'Animation' ? 'Lottie' : 'SVG'), hasContent: data.layerCount > 0, preview: data.r2?.thumbnail ? old?.preview : undefined, status: data.status, createdAt: timestamp(data.createdAt), editedAt: timestamp(data.updatedAt), openedAt: timestamp(data.openedAt) };
    const sourceKeys: string[] = Array.isArray(data.r2?.source) ? data.r2.source : [];
    project.assets = sourceKeys.filter(key => typeof key === 'string').map(key => {
      const name = key.split('/').pop() || 'Source file';
      const kind: ProjectAsset['kind'] = /\.(png|jpe?g|webp|gif)$/i.test(name) ? 'Image' : /\.(mp4|webm|mov)$/i.test(name) ? 'Video' : /\.svg$/i.test(name) ? 'SVG' : 'File';
      return { name, key, kind };
    });
    if (typeof data.r2?.lottie === 'string') project.assets.push({ name: `${data.name}.json`, key: data.r2.lottie, kind: 'Lottie' });
    if (typeof data.r2?.svg === 'string') project.assets.push({ name: `${data.name}.svg`, key: data.r2.svg, kind: 'SVG' });
    projects.push(project);
    if (data.r2?.thumbnail) thumbnails.push({ project, key: data.r2.thumbnail });
  }
  const listing = { projects, invalid };
  listings.set(user.uid, listing);
  // Metadata is ready immediately; each preview updates its card independently.
  for (const { project, key } of thumbnails) {
    const thumbnailKey = `${user.uid}:${project.id}:${key}`;
    let request = thumbnailCache.get(thumbnailKey);
    if (!request) {
      request = assetBlob(user, project.id, key).then(dataUrl);
      thumbnailCache.set(thumbnailKey, request);
      void request.catch(() => { thumbnailCache.delete(thumbnailKey); });
    }
    void request.then(preview => {
      if (getFirebaseAuth().currentUser?.uid !== user.uid || projectStopped(user.uid, project.id) || listings.get(user.uid) !== listing) return;
      project.preview = preview;
      onPreview?.({ ...project, preview });
    }).catch(() => { /* Cards still open when a thumbnail is unavailable. */ });
  }
  return listing;
}

function blankDocument(user: User, id: string, scene: Scene) {
  return { projectId: id, ownerId: user.uid, name: scene.name, type: typeOf(scene), category: sceneCategory(scene), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), frameCount: 0, duration: scene.duration, settings: { width: scene.width, height: scene.height, background: scene.background, clip: scene.clip, duration: scene.duration }, editorState: null, r2: {}, status: 'active', layerCount: 0 };
}
async function ensureCreated(user: User, id: string): Promise<void> {
  const key = cacheKey(user, id), creation = creations.get(key);
  assertOwner(user); assertProjectActive(user.uid, id);
  if (!creation) return;
  if (creation.pending) return creation.pending;
  clearTimeout(creation.timer);
  const pending = (async () => {
    // A transaction cannot overwrite edits or recreate a deleted project from
    // a delayed creation retry after another client changed the document.
    await runTransaction(firestore(), async transaction => {
      const existing = await transaction.get(reference(user, id));
      assertOwner(user); assertProjectActive(user.uid, id);
      if (!existing.exists()) transaction.set(reference(user, id), blankDocument(user, id, creation.scene));
    });
    assertProjectActive(user.uid, id);
    creations.delete(key); notify();
  })();
  creation.pending = pending;
  try { await pending; }
  catch (error) {
    creation.pending = undefined;
    if (!projectStopped(user.uid, id) && getFirebaseAuth().currentUser?.uid === user.uid) {
      creation.timer = setTimeout(() => { void ensureCreated(user, id).catch(() => {}); }, Math.min(30000, 1000 * 2 ** Math.min(creation.attempts++, 5)));
    }
    throw error;
  }
}
export function localProject(id: string) {
  let user: User | null;
  try { user = getFirebaseAuth().currentUser; } catch { return null; }
  if (!user || projectStopped(user.uid, id)) return null;
  const scene = loaded.get(cacheKey(user, id))?.scene;
  return scene ? { id, owner: user.uid, scene } : null;
}
export function createBlankProject(name = 'Untitled scene') {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Sign in to create projects.');
  const id = `new-${uid()}`, scene = { ...initialScene(), name: name.trim() || 'Untitled scene', layers: [] } as Scene;
  const key = cacheKey(user, id);
  loaded.set(key, { scene, revision: null });
  creations.set(key, { scene, attempts: 0 });
  // Only scheduling happens on the click path; render/navigation runs first.
  creations.get(key)!.timer = setTimeout(() => { void ensureCreated(user, id).catch(() => {}); }, 0);
  return { id, owner: user.uid, scene };
}
export async function createProject(name = 'Untitled scene', source?: Scene): Promise<string> {
  const user = await currentOwner();
  if (!source) {
    const project = createBlankProject(name);
    await ensureCreated(user, project.id); return project.id;
  }
  const id = `new-${uid()}`, scene = structuredClone(validateScene(source));
  scene.name = name.trim() || 'Untitled scene';
  await setDoc(reference(user, id), blankDocument(user, id, scene));
  assertOwner(user); loaded.set(cacheKey(user, id), { scene, revision: null });
  await saveProject(id, scene, user.uid); notify(); return id;
}
export async function loadProject(id: string): Promise<Scene> {
  const user = await currentOwner(), key = cacheKey(user, id);
  assertProjectActive(user.uid, id);
  if (creations.has(key)) return loaded.get(key)!.scene;
  const document = await getDoc(reference(user, id)); assertOwner(user); assertProjectActive(user.uid, id);
  if (!document.exists()) throw new Error('This project is no longer available.');
  const data = document.data();
  if (data.ownerId !== user.uid || data.status === 'deleting') throw new Error('This project is unavailable or awaiting deletion.');
  const revision = data.editorState?.revision ?? null, draft = await readDraft(user, id);
  if (draft?.dirty) {
    const scene = validateScene(draft.scene);
    assertProjectActive(user.uid, id);
    loaded.set(key, { scene, revision: draft.baseRevision }); return scene;
  }
  const cached = loaded.get(key); let scene: Scene;
  if (cached && cached.revision === revision) scene = cached.scene;
  else if (data.editorState?.key) scene = validateScene(await hydrate(user, id, JSON.parse(await (await assetBlob(user, id, data.editorState.key)).text())));
  else scene = data.editorState?.inline ? validateScene(data.editorState.inline) : { ...initialScene(data.name), ...data.settings, layers: [] };
  scene = { ...scene, name: data.name }; assertOwner(user); assertProjectActive(user.uid, id);
  loaded.set(key, { scene, revision }); return scene;
}
export async function preserveDraft(id: string, scene: Scene, ownerId?: string) {
  const user = await currentOwner();
  if (ownerId && user.uid !== ownerId) throw new Error('Your account changed. Local changes remain with their original owner.');
  assertProjectActive(user.uid, id);
  await writeDraft(user, id, { scene, baseRevision: loaded.get(cacheKey(user, id))?.revision ?? null, savedAt: nextDraftTime(), dirty: true });
}
export async function saveProject(id: string, source: Scene, ownerId?: string): Promise<void> {
  const user = await currentOwner(), key = cacheKey(user, id), previous = queues.get(key) || Promise.resolve();
  if (ownerId && user.uid !== ownerId) throw new Error('Your account changed. Local changes remain with their original owner.');
  const requestedAt = nextDraftTime();
  const pending = previous.catch(() => {}).then(async () => {
    assertOwner(user); assertProjectActive(user.uid, id);
    await ensureCreated(user, id);
    assertProjectActive(user.uid, id);
    const base = loaded.get(key)?.revision ?? null, savedAt = requestedAt;
    const draft = await readDraft(user, id);
    if (!draft || draft.savedAt <= requestedAt) await writeDraft(user, id, { scene: source, baseRevision: base, savedAt, dirty: true });
    const empty = !source.layers.length && !source.lottie && !source.files;
    const data = empty ? source : await encodeScene(user, id, source), revision = uid();
    const state = empty ? null : await upload(user, id, `project/${revision}/editor.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
    let thumbnail: string | null = null;
    if (source.layers.length) try {
      const time = Math.min(1.5, source.duration / 2);
      const svg = source.lottie ? await exportRenderedLottieSvg(source, time, false) : exportSceneSvg(source, time, false);
      thumbnail = (await putAsset(user, id, 'thumbnails', 'preview.svg', new Blob([svg], { type: 'image/svg+xml' }))).$r2;
    } catch { /* A preview failure cannot discard an otherwise valid editor snapshot. */ }
    const manifest = [...collectReferences(data)];
    await runTransaction(firestore(), async transaction => {
      const document = await transaction.get(reference(user, id)); assertOwner(user); assertProjectActive(user.uid, id);
      if (!document.exists() || document.data().status !== 'active') throw new Error('This project is unavailable. Your local changes are preserved.');
      if ((document.data().editorState?.revision ?? null) !== base) throw new Error('This project changed in another session. Your unsaved draft is preserved; export it before reloading.');
      transaction.update(reference(user, id), { name: source.name, type: typeOf(source), category: sceneCategory(source), updatedAt: serverTimestamp(), duration: source.duration,
        frameCount: source.layers.reduce((count, layer) => count + (layer.media?.frames.length || 0), 0), layerCount: source.layers.filter(layer => !layer.sourceFrame).length,
        settings: { width: source.width, height: source.height, background: source.background, clip: source.clip, duration: source.duration }, editorState: empty ? { inline: JSON.parse(JSON.stringify(source)), revision } : { key: state, revision },
        r2: { project: state, thumbnail, svg: manifest.find(key => key.endsWith('/export.svg')) ?? null, source: manifest.filter(key => key.includes('/source/')), lottie: manifest.find(key => key.includes('/lottie/')) ?? null } });
    });
    assertProjectActive(user.uid, id);
    loaded.set(key, { scene: source, revision });
    const latest = await readDraft(user, id);
    if (!latest || latest.savedAt <= savedAt) await writeDraft(user, id, { scene: source, baseRevision: revision, savedAt, dirty: false });
    else await writeDraft(user, id, { ...latest, baseRevision: revision });
    notify();
  });
  queues.set(key, pending);
  try { await pending; } finally { if (queues.get(key) === pending) queues.delete(key); }
}
export async function openProject(id: string, metadataOnly = false) {
  if (metadataOnly) {
    const owner = getFirebaseAuth().currentUser;
    if (owner) { const key = cacheKey(owner, id); if (!creations.has(key)) loaded.delete(key); }
  }
  const user = await currentOwner();
  const scene = metadataOnly ? undefined : await loadProject(id);
  assertProjectActive(user.uid, id);
  await updateDoc(reference(user, id), { openedAt: serverTimestamp() }); notify(); return scene;
}
export async function renameProject(id: string, name: string) {
  const user = await currentOwner(), trimmed = name.trim();
  assertProjectActive(user.uid, id);
  if (!trimmed || trimmed.length > 120) throw new Error('Enter a project name of up to 120 characters.');
  await updateDoc(reference(user, id), { name: trimmed, updatedAt: serverTimestamp() });
  assertProjectActive(user.uid, id);
  loaded.delete(cacheKey(user, id));
  const draft = await readDraft(user, id);
  if (draft) await writeDraft(user, id, { ...draft, scene: { ...draft.scene, name: trimmed } });
  notify();
}
export async function duplicateProject(id: string) {
  const user = await currentOwner(), scene = await loadProject(id), nextId = `new-${uid()}`;
  const listing = await getDocs(collection(firestore(), 'users', user.uid, 'projects'));
  assertOwner(user);
  const names = new Set(listing.docs.map(project => project.data().name));
  const base = `${scene.name} copy`; let name = base, number = 2;
  while (names.has(name)) name = `${base} ${number++}`;
  await setDoc(reference(user, nextId), { projectId: nextId, ownerId: user.uid, name, type: typeOf(scene), category: sceneCategory(scene), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), frameCount: 0, duration: scene.duration, editorState: null, r2: {}, status: 'creating', layerCount: 0 });
  try {
    await storageRequest(user, id, 'POST', undefined, JSON.stringify({ projectId: nextId }), '/copy');
    await updateDoc(reference(user, nextId), { status: 'active' });
    loaded.set(cacheKey(user, nextId), { scene: { ...scene, name }, revision: null });
    await saveProject(nextId, { ...scene, name }, user.uid);
  } catch (error) {
    try { await storageRequest(user, nextId, 'DELETE'); await deleteDoc(reference(user, nextId)); }
    catch { await updateDoc(reference(user, nextId), { status: 'deleting' }).catch(() => {}); }
    throw error;
  }
  notify(); return nextId;
}
export async function deleteProject(id: string) {
  const user = await currentOwner(), key = cacheKey(user, id);
  clearTimeout(cleanupRetries.get(key)); cleanupRetries.delete(key);
  const cached = loaded.get(key)?.scene;
  stopProject(user.uid, id);
  const creation = creations.get(key); clearTimeout(creation?.timer);
  // Let already-issued Firestore writes settle; all queued/new saves are stopped.
  await Promise.allSettled([queues.get(key), creation?.pending]);
  creations.delete(key); loaded.delete(key); queues.delete(key);
  for (const asset of uploaded) if (asset.startsWith(prefix(user, id))) uploaded.delete(asset);
  await removeDraft(user, id);
  try { for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index--) {
      const entry = storage.key(index);
      if (entry && (entry === id || entry.includes(key) || entry.includes(`/${id}`) || entry.includes(`:${id}`))) storage.removeItem(entry);
    }
  } } catch { /* Browser storage restrictions cannot prevent cloud cleanup. */ }
  let document: DocumentData | undefined;
  try { document = (await getDoc(reference(user, id))).data(); }
  catch { /* R2 cleanup and Firestore deletion still run independently. */ }
  if (document && document.status !== 'deleting') {
    // Reject any upload still running on another API instance before listing
    // assets for deletion. Its post-upload ownership check removes late writes.
    try { await updateDoc(reference(user, id), { status: 'deleting' }); }
    catch {
      // If marking fails but removal succeeds, the API's post-upload check also
      // rejects the missing document; storage cleanup remains independently safe.
      await deleteDoc(reference(user, id)).catch(() => {});
    }
  }
  if (document) {
    // Preserve the existing Undo using private cleanup reads only; regular reads,
    // loaders and autosaves were cancelled before any destructive operation.
    const files = new Map<string, Blob>();
    const read = async (asset: string) => (await storageRequest(user, id, 'GET', asset.slice(prefix(user, id).length), undefined, '', true)).blob();
    try {
      if (document.editorState?.key) {
        const blob = await read(document.editorState.key); files.set(document.editorState.key, blob);
        for (const asset of collectReferences(JSON.parse(await blob.text()))) files.set(asset, await read(asset));
      }
      if (document.r2?.thumbnail) files.set(document.r2.thumbnail, await read(document.r2.thumbnail));
      const scene = cached || (document.editorState?.inline ? validateScene(document.editorState.inline) : document.editorState?.key ? validateScene(await hydrateForUndo()) : { ...initialScene(document.name), ...document.settings, layers: [] });
      deleted.set(key, { scene, files, document });
      async function hydrateForUndo() {
        const decode = async (value: any): Promise<any> => isReference(value) ? value.format === 'dataUrl' ? dataUrl(files.get(value.$r2)!) : files.get(value.$r2)!.text() : Array.isArray(value) ? Promise.all(value.map(decode)) : value && typeof value === 'object' ? Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await decode(v)]))) : value;
        return decode(JSON.parse(await files.get(document!.editorState.key)!.text()));
      }
    } catch { deleted.delete(key); /* An unavailable backup must not prevent deletion. */ }
  }
  const failures: string[] = [];
  try { await storageRequest(user, id, 'DELETE', undefined, undefined, '', true); }
  catch { failures.push('R2 asset cleanup failed. Retry Delete to remove remaining files.'); }
  try { await deleteDoc(reference(user, id)); }
  catch { failures.push('Firestore project cleanup failed. Retry Delete.'); }
  notify();
  if (failures.length) {
    cleanupRetries.set(key, setTimeout(() => {
      cleanupRetries.delete(key);
      if (getFirebaseAuth().currentUser?.uid === user.uid) void deleteProject(id).catch(() => {});
    }, 5000));
    throw new Error(`${failures.join(' ')} Cleanup will retry in the background.`);
  }
}
export async function restoreProject(id: string) {
  const user = await currentOwner(), key = cacheKey(user, id), backup = deleted.get(key);
  if (cleanupRetries.has(key)) throw new Error('Project cleanup is still retrying. Wait before undoing deletion.');
  if (!backup) throw new Error('The deleted project is no longer available to undo.');
  if ((await getDoc(reference(user, id))).exists()) throw new Error('A project with this ID already exists.');
  resumeProject(user.uid, id);
  await setDoc(reference(user, id), { ...backup.document, status: 'creating' });
  try {
    for (const [asset, blob] of backup.files) await upload(user, id, asset.slice(prefix(user, id).length), blob);
    assertProjectActive(user.uid, id);
    await updateDoc(reference(user, id), { status: 'active' });
    assertProjectActive(user.uid, id);
    loaded.set(key, { scene: backup.scene, revision: backup.document.editorState?.revision ?? null });
    await saveProject(id, backup.scene, user.uid); deleted.delete(key);
  } catch (error) { if (!projectStopped(user.uid, id)) await updateDoc(reference(user, id), { status: 'deleting' }).catch(() => {}); throw error; }
  notify();
}
export async function frameSvg(id: string, layerId: string, frameId: string): Promise<string | undefined> {
  const user = await currentOwner(); assertProjectActive(user.uid, id);
  const data = (await getDoc(reference(user, id))).data(); assertProjectActive(user.uid, id);
  if (!data?.editorState?.key) return undefined;
  const encoded = JSON.parse(await (await assetBlob(user, id, data.editorState.key)).text());
  const vector = encoded.layers.find((layer: any) => layer.id === layerId)?.media?.frames.find((frame: any) => frame.id === frameId)?.vector;
  return isReference(vector?.svg) ? (await assetBlob(user, id, vector.svg.$r2)).text() : undefined;
}
