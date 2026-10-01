import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

const SignInContext = createContext<{ busy: boolean; signIn: () => void } | null>(null);

export function googleSignInError(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/popup-blocked') return 'Allow popups for this site, then try Google sign-in again.';
  if (code === 'auth/unauthorized-domain') return 'This domain must be added to Firebase Authentication’s authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in must be enabled in Firebase Authentication.';
  if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') return 'The Firebase API key is invalid. Update the web app configuration to enable Google sign-in.';
  if (code === 'auth/network-request-failed') return 'Could not connect to Google sign-in. Check your connection and try again.';
  if (code === 'auth/account-exists-with-different-credential') return 'This email already uses another sign-in provider. Sign in with that provider first.';
  if (error instanceof Error && /Missing Firebase configuration|Firebase app configuration/i.test(error.message)) return `${error.message} Restart Vite after updating .env.`;
  return 'Google sign-in could not be completed. Please try again.';
}

export function GoogleSignInProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = () => {
    if (pending.current) return;
    setError(null);
    pending.current = true;
    setBusy(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Invoke directly from the click to retain the browser's popup permission.
    try {
      void signInWithPopup(getFirebaseAuth(), provider)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((cause: unknown) => setError(googleSignInError(cause)))
      .finally(() => { pending.current = false; setBusy(false); });
    } catch (cause) {
      setError(googleSignInError(cause));
      pending.current = false;
      setBusy(false);
    }
  };
  return <SignInContext.Provider value={{ busy, signIn }}>
    {children}
    {error && <div role="alert" className="fixed bottom-6 left-1/2 z-[200] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-4 rounded-xl bg-slate-900 px-5 py-4 text-sm text-white shadow-xl"><span>{error}</span><button type="button" aria-label="Dismiss sign-in error" onClick={() => setError(null)} className="shrink-0 px-2 text-xl">×</button></div>}
  </SignInContext.Provider>;
}

export function GoogleSignInButton({ children, className }: { children: ReactNode; className: string }) {
  const signIn = useContext(SignInContext);
  if (!signIn) throw new Error('GoogleSignInButton requires GoogleSignInProvider.');
  return <button type="button" className={className} onClick={signIn.signIn} disabled={signIn.busy} aria-busy={signIn.busy} style={signIn.busy ? { opacity: .65, cursor: 'wait' } : undefined}>{children}</button>;
}
