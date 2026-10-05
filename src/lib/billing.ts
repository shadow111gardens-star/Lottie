import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

export type PaidPlan = 'pro' | 'lifetime';
export type Entitlement = { plan: PaidPlan; active: boolean; lifetime: boolean };
export async function createCheckout(plan: PaidPlan) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Sign in to choose your plan.');
  const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ plan }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Checkout could not be created. Please try again.');
  if (typeof result.checkoutUrl !== 'string' || new URL(result.checkoutUrl).protocol !== 'https:') throw new Error('Checkout returned an invalid URL.');
  window.location.assign(result.checkoutUrl);
}

export function useEntitlement({ pollUntilActive = false }: { pollUntilActive?: boolean } = {}) {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [status, setStatus] = useState('Checking plan…');
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopAuth: (() => void) | undefined;
    let generation = 0;
    const params = new URLSearchParams(window.location.search);
    const processing = params.get('checkout') === 'processing';
    const requestedPlan = params.get('checkout_plan');
    let attempts = 0;
    const refresh = async () => {
      const version = ++generation;
      const user = getFirebaseAuth().currentUser;
      if (!user) { setEntitlement(null); setConfirmedFor(null); setStatus(''); return; }
      try {
        const response = await fetch('/api/entitlement', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error('Could not check your plan.');
        if (disposed || version !== generation || getFirebaseAuth().currentUser?.uid !== user.uid) return;
        const received = result.entitlement;
        const current: Entitlement | null = received && ['pro', 'lifetime'].includes(received.plan) && typeof received.active === 'boolean' ? received : null;
        setConfirmedFor(user.uid);
        const waiting = processing && (!current?.active || (['pro', 'lifetime'].includes(requestedPlan || '') && current.plan !== requestedPlan));
        setEntitlement(current);
        setStatus(waiting ? 'Payment processing…' : current?.active ? `${current.plan === 'pro' ? 'Pro' : 'Lifetime'} · Active` : current ? 'Pro · Inactive' : 'No active paid plan');
        if ((pollUntilActive && !current?.active) || (waiting && attempts++ < 30)) { clearTimeout(timer); timer = setTimeout(() => void refresh(), 2000); }
        else if (waiting) setStatus('Payment still pending. Refresh to check again.');
      } catch {
        if (!disposed && version === generation) {
          setEntitlement(null); setConfirmedFor(null);
          setStatus('Could not check plan. Retrying...');
          if (pollUntilActive || (processing && attempts++ < 30)) timer = setTimeout(() => void refresh(), 2000);
        }
      }
    };
    const focus = () => { clearTimeout(timer); void refresh(); };
    try { stopAuth = onAuthStateChanged(getFirebaseAuth(), user => { ++generation; clearTimeout(timer); attempts = 0; setEntitlement(null); setConfirmedFor(null); setUserId(user?.uid ?? null); setAuthReady(true); setStatus(user ? 'Checking plan...' : ''); void refresh(); }); }
    catch { setAuthReady(true); setStatus('Could not check plan.'); }
    window.addEventListener('focus', focus);
    return () => { disposed = true; ++generation; clearTimeout(timer); stopAuth?.(); window.removeEventListener('focus', focus); };
  }, [pollUntilActive]);
  const active = !!userId && confirmedFor === userId && getFirebaseAuth().currentUser?.uid === userId && entitlement?.active === true && ['pro', 'lifetime'].includes(entitlement.plan);
  return { entitlement, status, authReady, userId, active };
}
