import { flushSync } from 'react-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

export type PaidPlan = 'pro' | 'lifetime';
export type Entitlement = { plan: PaidPlan; active: boolean; lifetime: boolean; subscriptionStatus?: string };
export function isPaidEntitlement(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Entitlement>;
  return item.active === true && ((item.plan === 'pro' && item.subscriptionStatus === 'active') || (item.plan === 'lifetime' && item.lifetime === true));
}
export async function createCheckout(plan: PaidPlan) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Sign in to choose your plan.');
  const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ plan }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Checkout could not be created. Please try again.');
  if (typeof result.checkoutUrl !== 'string' || new URL(result.checkoutUrl).protocol !== 'https:') throw new Error('Checkout returned an invalid URL.');
  if (getFirebaseAuth().currentUser?.uid !== user.uid) throw new Error('Your account changed. Sign in again.');
  window.dispatchEvent(new Event('vekto-checkout-leaving'));
  window.location.assign(result.checkoutUrl);
}

export function useEntitlement({ pollUntilActive = false, revalidationKey = '' }: { pollUntilActive?: boolean; revalidationKey?: string } = {}) {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ uid: string; route: string } | null>(null);
  const [status, setStatus] = useState('Checking plan...');
  useEffect(() => {
    let disposed = false, generation = 0, attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopAuth: (() => void) | undefined;
    let request: AbortController | undefined;
    const reset = () => { ++generation; clearTimeout(timer); request?.abort(); setEntitlement(null); setConfirmation(null); };
    const refresh = async () => {
      clearTimeout(timer); request?.abort();
      const version = ++generation;
      let user;
      try { user = getFirebaseAuth().currentUser; }
      catch { setAuthError(true); setStatus('Could not verify your account. Reload to retry.'); return; }
      if (!user) { setEntitlement(null); setConfirmation(null); setStatus(''); return; }
      const abort = new AbortController(); request = abort;
      const timeout = setTimeout(() => abort.abort(), 15000);
      try {
        const response = await fetch('/api/entitlement', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store', signal: abort.signal });
        const result = await response.json();
        if (!response.ok) throw new Error('Could not check your plan.');
        if (disposed || version !== generation || abort.signal.aborted || getFirebaseAuth().currentUser?.uid !== user.uid) return;
        const received = result.entitlement;
        const current: Entitlement | null = received && ['pro', 'lifetime'].includes(received.plan) && typeof received.active === 'boolean' ? received : null;
        const paid = isPaidEntitlement(current);
        // Redirect/query/checkout records never supply entitlement. They only change status text.
        const params = new URLSearchParams(window.location.search);
        const processing = params.get('checkout') === 'processing';
        const waiting = processing && (!paid || (['pro', 'lifetime'].includes(params.get('checkout_plan') || '') && current?.plan !== params.get('checkout_plan')));
        setEntitlement(current); setConfirmation({ uid: user.uid, route: revalidationKey });
        setStatus(waiting ? 'Payment processing...' : paid ? `${current!.plan === 'pro' ? 'Pro' : 'Lifetime'} \u00b7 Active` : current ? `${current.plan === 'pro' ? 'Pro' : 'Lifetime'} \u00b7 Inactive` : 'No active paid plan');
        if (pollUntilActive) timer = setTimeout(() => void refresh(), paid ? 15000 : 2000);
        else if (waiting && attempts++ < 30) timer = setTimeout(() => void refresh(), 2000);
        else if (waiting) setStatus('Payment still pending. Refresh to check again.');
      } catch {
        if (!disposed && version === generation) {
          setEntitlement(null); setConfirmation(null); setStatus('Could not check plan. Retrying...');
          if (pollUntilActive || attempts++ < 30) timer = setTimeout(() => void refresh(), 2000);
        }
      } finally { clearTimeout(timeout); }
    };
    const resume = () => { flushSync(reset); void refresh(); };
    const leave = () => { flushSync(reset); };
    const visibility = () => { if (document.visibilityState === 'visible') resume(); else leave(); };
    try {
      stopAuth = onAuthStateChanged(getFirebaseAuth(), user => {
        reset(); attempts = 0; setUserId(user?.uid ?? null); setAuthReady(true); setAuthError(false);
        setStatus(user ? 'Checking plan...' : ''); void refresh();
      }, () => { reset(); setAuthReady(true); setAuthError(true); setStatus('Could not verify your account. Reload to retry.'); });
    } catch { reset(); setAuthReady(true); setAuthError(true); setStatus('Could not verify your account. Reload to retry.'); }
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('popstate', resume);
    window.addEventListener('pagehide', leave);
    window.addEventListener('vekto-checkout-leaving', leave);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; ++generation; clearTimeout(timer); request?.abort(); stopAuth?.();
      window.removeEventListener('focus', resume); window.removeEventListener('pageshow', resume);
      window.removeEventListener('popstate', resume); window.removeEventListener('pagehide', leave);
      window.removeEventListener('vekto-checkout-leaving', leave); document.removeEventListener('visibilitychange', visibility);
    };
  }, [pollUntilActive, revalidationKey]);
  let currentUid: string | undefined;
  try { currentUid = getFirebaseAuth().currentUser?.uid; } catch { /* Initialization errors never grant access. */ }
  const active = !authError && !!userId && confirmation?.uid === userId && confirmation.route === revalidationKey && currentUid === userId && isPaidEntitlement(entitlement);
  return { entitlement, status, authReady, authError, userId, active };
}
