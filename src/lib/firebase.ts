import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().some((app) => app.name === '[DEFAULT]')
  ? getApp()
  : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics becomes available asynchronously in supported browsers only.
// The storageBucket config value does not initialize Firebase Storage.
export let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  void import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) analytics = getAnalytics(app);
    })
    .catch((error: unknown) => {
      console.warn('Firebase Analytics is unavailable:', error);
    });
}
