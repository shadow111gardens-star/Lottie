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

export function useEntitlement() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
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
      if (!user) { setEntitlement(null); setStatus(''); return; }
      try {
        const response = await fetch('/api/entitlement', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error('Could not check your plan.');
        if (disposed || version !== generation) return;
        const current = result.entitlement as Entitlement | null;
        const waiting = processing && (!current?.active || (['pro', 'lifetime'].includes(requestedPlan || '') && current.plan !== requestedPlan));
        setEntitlement(current);
        setStatus(waiting ? 'Payment processing…' : current?.active ? `${current.plan === 'pro' ? 'Pro' : 'Lifetime'} · Active` : current ? 'Pro · Inactive' : 'No active paid plan');
        if (waiting && attempts++ < 30) timer = setTimeout(() => void refresh(), 2000);
        else if (waiting) setStatus('Payment still pending. Refresh to check again.');
      } catch {
        if (!disposed && version === generation) {
          setStatus('Could not check plan. Refresh to retry.');
          if (processing && attempts++ < 30) timer = setTimeout(() => void refresh(), 2000);
        }
      }
    };
    const focus = () => { clearTimeout(timer); void refresh(); };
    try { stopAuth = onAuthStateChanged(getFirebaseAuth(), () => { ++generation; clearTimeout(timer); attempts = 0; setEntitlement(null); void refresh(); }); }
    catch { setStatus('Could not check plan.'); }
    window.addEventListener('focus', focus);
    return () => { disposed = true; ++generation; clearTimeout(timer); stopAuth?.(); window.removeEventListener('focus', focus); };
  }, []);
  return { entitlement, status };
}
