import type { Project, Sort } from './store';
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
