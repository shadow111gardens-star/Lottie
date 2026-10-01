import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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

// Nullable exports let the local editor keep working when Firebase is unavailable.
// Callers must check the service before attempting a remote operation.
export let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let firebaseError: Error | null = null;

function reportInitializationError(error: unknown) {
  firebaseError = error instanceof Error ? error : new Error(String(error));
  console.error('Firebase initialization failed. Check .env and the Firebase Console web app config, then restart Vite.', firebaseError);
}

try {
  for (const name of ['apiKey', 'authDomain', 'projectId', 'appId'] as const) {
    const value = firebaseConfig[name];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Missing Firebase configuration: ${name}`);
    }
  }
  // Whitespace from copied environment values is not part of the configuration.
  for (const name of Object.keys(firebaseConfig) as (keyof typeof firebaseConfig)[]) {
    if (typeof firebaseConfig[name] === 'string') firebaseConfig[name] = firebaseConfig[name].trim();
  }
  app = getApps().some((existingApp) => existingApp.name === '[DEFAULT]')
    ? getApp()
    : initializeApp(firebaseConfig);
} catch (error) {
  reportInitializationError(error);
}

if (app) {
  try {
    auth = getAuth(app);
  } catch (error) {
    reportInitializationError(error);
  }
  try {
    db = getFirestore(app);
  } catch (error) {
    reportInitializationError(error);
  }
}

/** Recover from a transient initialization failure and expose the actual cause. */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  if (!app) throw firebaseError ?? new Error('Firebase app configuration is missing.');
  try {
    auth = getAuth(app);
    return auth;
  } catch (error) {
    reportInitializationError(error);
    throw firebaseError;
  }
}

// Analytics becomes available asynchronously in supported browsers only.
// The storageBucket config value does not initialize Firebase Storage.
export let analytics: Analytics | null = null;

if (typeof window !== 'undefined' && app) {
  const analyticsApp = app;
  void import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) analytics = getAnalytics(analyticsApp);
    })
    .catch((error: unknown) => {
      console.warn('Firebase Analytics is unavailable:', error);
    });
}
