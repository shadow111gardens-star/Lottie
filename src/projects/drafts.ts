import type { Scene } from '../editor/model';
import { assertOwner } from './storage';
import type { User } from 'firebase/auth';
export type Draft = { scene: Scene; baseRevision: string | null; savedAt: number; dirty: boolean };
const memory = new Map<string, Draft>();
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('svgforge-private-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}
export async function writeDraft(user: User, id: string, draft: Draft) {
  assertOwner(user);
  const key = `${user.uid}:${id}`;
  memory.set(key, draft);
  try {
    const database = await db();
    assertOwner(user);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('drafts', 'readwrite');
      transaction.objectStore('drafts').put(draft, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { /* The in-memory draft remains available if disk storage fails. */ }
}
export async function readDraft(user: User, id: string): Promise<Draft | undefined> {
  assertOwner(user);
  const key = `${user.uid}:${id}`;
  if (memory.has(key)) return memory.get(key);
  try {
    const database = await db();
    const value = await new Promise<Draft | undefined>((resolve, reject) => {
      const request = database.transaction('drafts').objectStore('drafts').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    assertOwner(user);
    return value;
  } catch { return undefined; }
}
export async function removeDraft(user: User, id: string) {
  memory.delete(`${user.uid}:${id}`);
  try {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('drafts', 'readwrite');
      transaction.objectStore('drafts').delete(`${user.uid}:${id}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { /* A deleted project cannot be loaded without its Firestore document. */ }
}
