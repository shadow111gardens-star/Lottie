import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { trialRequest, useEntitlement } from '../lib/billing';
import { Crown, X } from 'lucide-react';
import './paid-access.css';

/** Confirm account access first. Plans open only from an explicit Upgrade action. */
export default function PaidAccessGate({ children, pricing }: { children: ReactNode; pricing: ReactNode }) {
  const location = useLocation();
  const billing = useEntitlement({ pollUntilActive: true, revalidationKey: `${location.key}:${location.pathname}${location.search}` });
  const [enrollmentRetry, setEnrollmentRetry] = useState(0);
  const [upgradeUid, setUpgradeUid] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{uid: string; error: string} | null>(null);
  const enrolling = useRef<string | null>(null);
  const originalPlan = useRef<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const showUpgrade = !!billing.userId && upgradeUid === billing.userId && billing.canAccess;
  useEffect(() => {
    if (!billing.accessChecked || billing.canAccess || !billing.userId || enrolling.current === billing.userId) return;
    const uid = billing.userId;
    enrolling.current = uid;
    setEnrollment(null);
    // New/legacy authenticated accounts start with Free; no pricing modal is forced.
    void trialRequest('start').then(() => {
      if (enrolling.current === uid) enrolling.current = null;
    }).catch(cause => {
      if (enrolling.current === uid) enrolling.current = null;
      setEnrollment({ uid, error: cause instanceof Error ? cause.message : 'Could not start your free plan.' });
    });
  }, [billing.accessChecked, billing.canAccess, billing.userId, enrollmentRetry]);
  useEffect(() => {
    const open = () => {
      if (!billing.canAccess || !billing.userId) return;
      originalPlan.current = billing.active ? billing.entitlement?.plan ?? null : null;
      setUpgradeUid(billing.userId);
    };
    const close = () => setUpgradeUid(null);
    window.addEventListener('vekto-upgrade-open', open);
    window.addEventListener('vekto-upgrade-close', close);
    return () => { window.removeEventListener('vekto-upgrade-open', open); window.removeEventListener('vekto-upgrade-close', close); };
  }, [billing.canAccess, billing.userId, billing.active, billing.entitlement?.plan]);
  useEffect(() => { setUpgradeUid(null); }, [billing.userId, location.pathname]);
  useEffect(() => {
    if (billing.active && billing.entitlement?.plan !== originalPlan.current) setUpgradeUid(null);
  }, [billing.active, billing.entitlement?.plan]);
  useEffect(() => {
    if (!showUpgrade) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [showUpgrade]);
  if (billing.authError) return <div className="paid-access-check" role="alert">{billing.status}</div>;
  if (!billing.authReady) return <div className="paid-access-check" role="status">Checking account access…</div>;
  if (!billing.userId) return <Navigate to="/" replace />;
  if (!billing.canAccess) {
    const enrollmentFailed = enrollment?.uid === billing.userId;
    const checkFailed = billing.status.startsWith('Could not');
    return <div className="paid-access-check"><div className="paid-access-check-card" role={enrollmentFailed || checkFailed ? 'alert' : 'status'}>
      <span className="paid-access-check-mark" aria-hidden="true"><Crown size={19} /></span>
      <strong>{enrollmentFailed ? 'Free plan setup paused' : checkFailed ? 'Could not check your access' : 'Preparing your workspace…'}</strong>
      <p>{enrollmentFailed ? enrollment.error : checkFailed ? 'Your projects are still protected. Check your connection and retry.' : billing.status || 'Checking your plan and project access.'}</p>
      {(enrollmentFailed || checkFailed) && <button type="button" onClick={() => {
        if (enrollmentFailed) {
          enrolling.current = null;
          setEnrollment(null);
          setEnrollmentRetry(value => value + 1);
        } else {
          window.dispatchEvent(new Event('vekto-access-changed'));
        }
      }}>Retry</button>}
    </div></div>;
  }
  return <>
    <div className="paid-access-workspace" inert={showUpgrade || undefined} aria-hidden={showUpgrade || undefined}>{children}</div>
    {showUpgrade && <div className="paid-access-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setUpgradeUid(null); }}>
      <div ref={panel} tabIndex={-1} className="paid-access-dialog" role="dialog" aria-modal="true" aria-labelledby="paid-access-title" aria-describedby="paid-access-status" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setUpgradeUid(null); }
        if (event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')];
          const first = controls[0], last = controls[controls.length - 1];
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
        }
      }}>
        <button className="paid-access-close" type="button" aria-label="Close upgrade plans" onClick={() => setUpgradeUid(null)}><X size={20} /></button>
        <header className="paid-access-heading"><div className="paid-access-kicker"><Crown size={25} /><span>Unlock your creative space</span></div><h1 id="paid-access-title">Choose your plan</h1><p>Upgrade for unlimited projects, animation and exports.</p><p id="paid-access-status" role="status" aria-live="polite">{billing.status}</p></header>
        {pricing}
      </div>
    </div>}
  </>;
}
