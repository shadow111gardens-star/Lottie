import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: ['.env.local', '.env'], quiet: true });
export function firebaseAdmin() {
  const existing = getApps().find(app => app.name === 'vekto-billing');
  if (existing) return existing;
  const options = { projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID };
  // Alternatively use Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) options.credential = cert(JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT));
  return initializeApp(options, 'vekto-billing');
}
export const billingFirestore = () => getFirestore(firebaseAdmin());
export const verifyFirebaseToken = token => getAuth(firebaseAdmin()).verifyIdToken(token, true);
