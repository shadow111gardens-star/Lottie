import { getFirebaseAuth } from '../lib/firebase';
import type { User } from 'firebase/auth';

export async function currentOwner(): Promise<User> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Sign in to load or save projects.');
  return auth.currentUser;
}
export function assertOwner(user: User) {
  if (getFirebaseAuth().currentUser?.uid !== user.uid) throw new Error('Your account changed. Sign in again before saving.');
}
export function prefix(user: User, id: string) { return `users/${user.uid}/projects/${id}/`; }
export async function storageRequest(user: User, id: string, method: string, path?: string, body?: BodyInit, suffix = '') {
  assertOwner(user);
  const token = await user.getIdToken();
  assertOwner(user);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body instanceof Blob && body.type) headers['Content-Type'] = body.type;
  if (suffix) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/storage/${encodeURIComponent(id)}${suffix}${path ? `?path=${encodeURIComponent(path)}` : ''}`, { method, headers, body });
  assertOwner(user);
  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(message?.error || (response.status === 404
      ? 'The project storage API is missing from this deployment. Deploy the Vercel storage function and routing configuration.'
      : `Project storage request failed (${response.status}). Your local changes are preserved.`));
  }
  return response;
}
export async function upload(user: User, id: string, path: string, blob: Blob) {
  const response = await storageRequest(user, id, 'PUT', path, blob);
  const result = await response.json();
  if (result.key !== prefix(user, id) + path) throw new Error('Storage returned an invalid asset reference.');
  return result.key as string;
}
export async function assetBlob(user: User, id: string, key: string) {
  const root = prefix(user, id);
  if (!key.startsWith(root)) throw new Error('This asset does not belong to the current project.');
  return (await storageRequest(user, id, 'GET', key.slice(root.length))).blob();
}
export function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the project file.'));
    reader.readAsDataURL(blob);
  });
}
export async function digest(blob: Blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}
