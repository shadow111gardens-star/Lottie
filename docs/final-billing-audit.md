# Vekto final authentication and billing audit

Date: October 5, 2026. Scope: inspected workspace implementation, automated regression tests, Firebase emulators, read-only Dodo product lookups, and the public Production HTML. No real checkout, payment, or production entitlement was created or changed during this audit.

## 1. Files inspected

- `src/App.tsx`, `src/main.tsx`: pricing reuse and all React Router routes.
- `src/auth/GoogleSignIn.tsx`, `src/auth/PaidAccessGate.tsx`, `src/auth/paid-access.css`: identity, login continuation, global paid gate and presentation.
- `src/lib/firebase.ts`, `src/lib/billing.ts`: Firebase restoration, checkout requests, entitlement requests and browser lifecycle handling.
- `src/Dashboard.tsx`, `src/Editor.tsx`: protected mounting, logout, project loading, autosave and cleanup.
- `src/projects/store.ts`, `storage.ts`, `drafts.ts`, `lifecycle.ts`: ownership, asynchronous account checks, owner-scoped caches, private drafts and cancelled work.
- `server/payments.mjs`, `server/firebase-admin.mjs`, `server/storage.mjs`, `server/index.mjs`: billing authority, webhook processing, token verification and project API protections.
- `api/checkout.mjs`, `api/entitlement.mjs`, `api/webhooks/dodo.mjs`, `api/storage.mjs`: Vercel handlers and raw request-body preservation.
- `firestore.rules`, `vercel.json`, `vite.config.ts`, `package.json`, installed Dodo SDK: rule permissions, routing, middleware, tests and SDK environment.
- Authentication, billing, gate, storage, cloud-project, project-list, asset, Dashboard and server-runtime tests.
- Ignored local environment configuration, tracked source, reachable Git patches and generated browser bundle were examined without printing secrets.

## 2. Files changed in this audit

- `src/lib/billing.ts`: strict paid predicate; route-specific confirmations; checkout-leaving invalidation; pagehide/pageshow, Back/Forward, visibility and focus revalidation; request abortion/timeouts; bounded stale-response handling; paid revocation polling; auth failure handling.
- `src/auth/PaidAccessGate.tsx`: route key supplied to entitlement validation; authentication failure blocks content.
- `src/auth/paid-access.css`: removed gate-specific overrides of the existing pricing heading, spacing and layout. Pricing component/cards remain reused.
- `server/payments.mjs`: Pro entitlement response additionally exposes server-derived `subscriptionStatus`, allowing strict client validation. Its existing three fields remain present.
- `server/firebase-admin.mjs`: revoked/disabled-user checks enabled during ID-token verification.
- `server/storage.mjs`: storage uses the shared configured Firebase Admin verifier rather than a separate app relying on ambient credentials.
- `firestore.rules`: active Pro/Lifetime required for project creation and updates, in addition to existing ownership constraints.
- `tests/payments.mjs`, `tests/billing-ui.mjs`, `tests/paid-access.mjs`: stricter contract, browser restoration, spoofed claims, auth/errors, logout and rules regression coverage.
- `tests/cloud-flow.mjs`: paid-project fixture scoped to the required demo emulators for the stricter project rules.
- `tests/project-list-loading.mjs`: repaired an existing test-harness failure caused by importing browser lifecycle code without a window.
- `scripts/audit-billing-secrets.mjs`: secret-safe source, history and browser-bundle audit.
- `.env.local`: only the two outdated local product mappings corrected to the previously verified existing Live IDs. No credentials changed; this file remains ignored.
- `dist/index.html`: regenerated production build.
- This report.

No checkout architecture, production product, API key, account, project ownership, webhook URL or unrelated application feature was replaced.

## 3. Back-button root cause and evidence

The inspected global gate already checked server entitlement, and checkout creation did not grant it. An unpaid user's bypass through a real, authenticated Dodo browser session was not reproduced in this audit.

A concrete lifecycle gap was found: entitlement was rechecked on auth/focus but not on `pageshow` after back/forward-cache restoration, `pagehide` before freezing, or route/history restoration. Previously confirmed access could be reused after browser restoration or a later subscription change. Paid users also had no periodic entitlement revalidation after initial confirmation. These are security-relevant gaps, not proof that checkout records ever granted payment.

Back/Forward restoration can fire `pageshow`, including bfcache restoration: [MDN pageshow reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event).

The public Production HTML contains the paid gate but lacks the new `vekto-checkout-leaving` handler. Therefore Production is not yet running this audit's full fix.

## 4. Fix

- Checkout leaving and pagehide synchronously invalidate confirmed access.
- Pageshow, popstate, focus and visibility restoration clear confirmation and fetch `/api/entitlement` again.
- A different route cannot use the previous route's confirmation, even before React effects run.
- Old-account, aborted and superseded responses cannot grant access.
- Pro requires `plan === 'pro'`, `active === true` and `subscriptionStatus === 'active'`.
- Lifetime requires `plan === 'lifetime'`, `active === true` and `lifetime === true`.
- Gate checks recur every two seconds while blocked; paid access is rechecked every fifteen seconds while the page is active. Server mutation/rule checks remain independent of this polling interval.
- Entitlement and authentication errors block access. Request timeouts cannot grant it.

## 5. Authentication

Firebase Authentication supplies identity. Server handlers verify Firebase tokens, including revocation/disabled-user status. Storage and billing now share the same configured Admin verifier. The shared verifier accepted a real emulator Firebase user token and rejected that token after the emulator user was disabled. Client UID/plan/product/price input is not accepted as identity or payment proof. Logout clears entitlement confirmation, unmounts protected content and returns to public UI. Owner-scoped drafts/caches never become another account's data.

Revocation requires an explicit Admin verification option: [Firebase session-management documentation](https://firebase.google.com/docs/auth/admin/manage-sessions).

## 6. Entitlement

`getUserEntitlement` reads only the server-side `users/{verifiedUid}` document. Pro active status is derived from the stored subscription state; Lifetime requires its stored boolean. Null, missing, free, malformed, cancelled, expired, past_due and invalid Lifetime responses do not unlock the gate. No Free plan was introduced. Pro responses additionally include `subscriptionStatus`; Lifetime responses retain their existing shape.

## 7. Dashboard gate

All routes remain inside the existing global gate. Protected components are unmounted while identity or payment cannot be verified. The gate has no close button or dismissal callback; Escape and backdrop interaction cannot unlock it. Existing Pricing is reused. Tests assert protected content never mounts for unpaid direct URLs, navigation or refresh.

## 8. Checkout

Existing authenticated POST body remains exactly `{plan:'pro'}` or `{plan:'lifetime'}`. Server maps product and quantity one. Return URL remains a processing indication, never proof of payment. `dodoCheckouts` remains tracking/binding data only.

Read-only SDK 2.53.0 Live lookups returned HTTP 200 for:

- Pro: `pdt_0Np4xktCfmmx3Im3IJNrK`, USD 500 cents, recurring monthly.
- Lifetime: `pdt_0Np4yjyCx2Qy1xJP41nzH`, USD 2900 cents, one-time.

No live checkout session or payment was created. Production's secret API key cannot be exported through Vercel, so these product reads used the available local Live key. Production product mappings had already been independently verified in the preceding task.

## 9. Webhook security

Endpoint remains `https://www.vekto.website/api/webhooks/dodo`. Raw body is preserved and the official SDK verifies signature/timestamp before processing. Invalid/expired signatures fail. Duplicate delivery is transactionally idempotent. Stale events do not overwrite newer object state. Subscription processing fetches current Dodo subscription state and validates server-created UID/plan/product/environment binding. All requested payment and subscription lifecycle events are covered by the existing automated suite. Normal Pro events do not revoke Lifetime. Refund/reversal revocation is not implemented or newly added.

## 10. Firestore security

Client account billing writes remain denied entirely. Private checkout, billing-object and webhook collections remain denied by default. New paid checks protect project creation/updates even if someone alters browser code. Ownership, immutable owner/project identity and creation timestamp checks remain. Unrelated account fields remain intact under Admin merge writes; existing project UID ownership survives plan changes.

Owner-only read/delete access is intentionally retained for data recovery and cleanup, including after subscription expiration. Storage downloads/cleanup require authentication and ownership; paid upload/copy operations require server entitlement. These recovery operations do not grant Dashboard access or paid mutations.

## 11. Route and client-bypass boundary

Direct protected URLs, query claims, session IDs, localStorage/sessionStorage plan claims, Back/Forward restoration and checkout return indicators do not grant access in the application. Payment authority never comes from these values.

A user can alter JavaScript/DOM in their own browser; no frontend can prevent that. Such alteration cannot forge a Firebase token, write billing entitlement/private webhook records or bypass paid project-write/upload/copy checks. The server/rules are the enforceable security boundary, while the route gate controls normal rendering.

## 12. Secret exposure

The secret audit passed for current source, ignored-environment exclusion from Git, reachable Git history, configured secret values and private-key material. The generated browser bundle contains no configured Dodo/Firebase Admin credentials or server SDK imports. SDK exception objects are not logged by billing handlers. No secret values appear in this report.

## 13. Test matrix

All rows below concern isolated automated fixtures or emulator verification, not actual charged Dodo transactions.

| Cases | Verification |
| --- | --- |
| A, V: logged out/logout | Public UI only; protected access/confirmation removed. |
| B, C: missing/invalid/free billing | Gate; no protected mount. |
| D: active Pro | Requires all three strict Pro conditions. |
| E, F, G: cancelled/expired/past_due/inactive Pro | Gate; lifecycle transitions verified. |
| H, I: valid Lifetime and later Pro cancellation | Unlock; Lifetime preserved across Pro lifecycle. |
| J, G/H checkout scenarios, Y: checkout/tracking only | Existing checkout tests assert no entitlement activation; record is not consulted by gate. |
| K, L, M, N: Back/Forward, cancel, close, failure | Gate under Pro/Lifetime return states and browser events; verified failed/cancelled webhook handling. |
| O, P: delayed entitlement then active server response | Gate until confirmation; polling unlocks only after valid response. |
| Q, R: invalid/duplicate/stale webhooks | Reject/idempotent/preserve current entitlement. |
| S, T, U: direct URL and unpaid/paid restoration | Gate or protected content strictly after server confirmation. |
| W, X, Z: storage/query/return claims | Claims cannot grant access. |
| Auth/API failure | Auth failure and entitlement 401/500 fail closed. |
| Account/request race | Old-account and old-route responses cannot grant access. |
| Console/backend bypass | Emulator rejects billing writes, private collections and unpaid project create/update; storage denies unauthenticated/foreign access and unpaid uploads. |

Passing commands/checks:

- `npm run typecheck`
- `npm run build`
- `npm run test:auth`
- `npm run test:firebase`
- `npm run test:payments`
- `npm run test:payments:emulator`
- `npm run test:storage`
- `npm run test:project-actions`
- `npm run test:runtime`
- `npm run test:cloud`
- `node tests/project-list-loading.mjs`
- `node tests/uploaded-assets.mjs`
- `node tests/dashboard-preview.mjs`
- `npm run check:payments`
- `node scripts/audit-billing-secrets.mjs`

Initial validation exposed and corrected a TypeScript narrowing error, a status-label encoding mismatch and the missing-window test harness. A concurrent emulator startup attempt hit occupied ports; both emulator suites subsequently ran sequentially and passed. Expected negative-test HTTP errors and Happy DOM's evaluation notice were not hidden.

## 14. Build/typecheck

Final typecheck and production build passed. Final billing/gate tests and secret scan passed against the generated artifact.

## 15. Remaining blockers

- Deploy the rebuilt frontend/server code and the updated Firestore rules. This audit did not publish them; the currently public site lacks the new checkout-leaving handler.
- Live end-to-end success/webhook delivery and genuine cross-origin Dodo Back/Cancel/Close need verification with an authorized test account after deployment. This audit did not make a real payment or assert that such a payment was tested.
- Production Admin credentials and the non-exportable Production API key were not independently exercised with an authenticated Production token in this audit. Local checks note that local Admin credentials are unavailable; emulators verified server/rules behavior. Production credentials remain configured as reported by the user.

Workspace acceptance: no checkout/session/URL/storage claim grants access; strict server confirmation controls normal rendering; paid mutations remain enforced server-side. Production acceptance awaits deployment and the live checks above.
