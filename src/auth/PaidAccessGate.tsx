import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useEntitlement } from '../lib/billing';
import './paid-access.css';

/** Protected content is never mounted until the server confirms paid access. */
export default function PaidAccessGate({ children, pricing }: { children: ReactNode; pricing: ReactNode }) {
  const billing = useEntitlement({ pollUntilActive: true });
  const location = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const blocked = billing.authReady && !!billing.userId && !billing.active;
  useEffect(() => {
    if (!blocked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [blocked]);
  if (!billing.authReady) return <div className="paid-access-check" role="status">Checking account access…</div>;
  if (!billing.userId) {
    if (/^\/(dashboard|editor|project|projects)(\/|$)/.test(location.pathname)) return <Navigate to="/" replace />;
    return children;
  }
  if (billing.active) return children;
  return <div className="paid-access-backdrop">
    <div ref={panel} tabIndex={-1} className="paid-access-dialog" role="dialog" aria-modal="true" aria-labelledby="paid-access-title" aria-describedby="paid-access-status" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header className="paid-access-heading"><h1 id="paid-access-title">Choose a plan to continue</h1><p>Access unlocks once your Pro or Lifetime purchase is confirmed.</p><p id="paid-access-status" role="status" aria-live="polite">{billing.status}</p></header>
      {pricing}
    </div>
  </div>;
}
