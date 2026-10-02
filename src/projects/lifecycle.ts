export const PROJECT_REMOVED = 'svgforge-project-removed';
const tombstonesKey = 'svgforge-deleted-projects';
const stopped = new Set<string>();
try { for (const entry of JSON.parse(window.localStorage.getItem(tombstonesKey) || '[]')) if (typeof entry === 'string') stopped.add(entry); } catch { /* Memory cancellation also works without local storage. */ }
function persist() { try { window.localStorage.setItem(tombstonesKey, JSON.stringify([...stopped])); } catch { /* Optional cross-refresh protection. */ } }
const requests = new Map<string, AbortController>();
const key = (owner: string, id: string) => `${owner}:${id}`;
export function projectStopped(owner: string, id: string) { return stopped.has(key(owner, id)); }
export function assertProjectActive(owner: string, id: string) {
  if (projectStopped(owner, id)) throw new DOMException('Project was deleted.', 'AbortError');
}
export function projectSignal(owner: string, id: string) {
  assertProjectActive(owner, id);
  const k = key(owner, id);
  if (!requests.has(k)) requests.set(k, new AbortController());
  return requests.get(k)!.signal;
}
export function stopProject(owner: string, id: string) {
  stopped.add(key(owner, id)); requests.get(key(owner, id))?.abort();
  persist();
  requests.delete(key(owner, id));
  window.dispatchEvent(new window.CustomEvent(PROJECT_REMOVED, { detail: { owner, id } }));
}
export function resumeProject(owner: string, id: string) { stopped.delete(key(owner, id)); persist(); }
