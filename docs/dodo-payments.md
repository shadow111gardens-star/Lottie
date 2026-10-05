Vekto Dodo Payments integration — October 5, 2026

Implemented with the official `dodopayments` SDK 2.53.0. Existing pricing card design and normal button labels are preserved. No paid access is granted by a checkout creation or browser return URL. No payment was made during development.

Files changed

- `api/checkout.mjs`, `api/entitlement.mjs`, `api/webhooks/dodo.mjs`: Vercel handlers with automatic body parsing disabled.
- `server/firebase-admin.mjs`: server Auth/Firestore initialization and server-only credential support.
- `server/payments.mjs`, `server/payments.d.mts`: checkout, raw-body webhook verification, billing transactions, entitlement helper and guard.
- `server/index.mjs`, `server/storage.mjs`: Express routes and entitlement enforcement for R2 uploads/project copies.
- `src/lib/billing.ts`: authenticated checkout, hosted redirect, server entitlement reads and bounded processing polling.
- `src/App.tsx`, `src/auth/GoogleSignIn.tsx`: existing pricing buttons, sign-in continuation, loading and errors.
- `src/Dashboard.tsx`: account plan/status in the existing sidebar.
- `firestore.rules`: owner-only account reads; billing writes remain Admin-only.
- `vite.config.ts`, `vercel.json`: local/dev/preview and production function routing.
- `package.json`, `package-lock.json`: SDK dependency and verification commands.
- `tests/payments.mjs`, `tests/billing-ui.mjs`: billing, security, lifecycle and UI tests.
- `tests/storage-api.mjs`, `tests/cloud-flow.mjs`: explicit paid test fixtures for existing storage tests.
- `tests/google-auth.mjs`: account for the existing fourth mobile sign-in entry point.
- `scripts/test-cloud.mjs`: billing emulator test support.
- `scripts/check-payments.mjs`: read-only product/price checks and browser-secret scan.
- `dist/index.html`: regenerated tracked production build.
- `docs/dodo-payments.md`: this report and operation instructions.

API routes created

| Route | Authentication and behavior |
| --- | --- |
| `POST /api/checkout` | Firebase bearer token required; body must contain only `{ "plan": "pro" }` or `{ "plan": "lifetime" }`; UID/email from verified token; server env product mapping, quantity 1; returns `{ "checkoutUrl": "…" }` only. |
| `POST /api/webhooks/dodo` | Dodo signature and delivery timestamp checked with the official SDK on the raw request body; then Firestore transaction. |
| `GET /api/entitlement` | Firebase bearer token required; only the current user's actual server entitlement is returned. |

Firestore fields used

Existing `users/{uid}` documents receive merged billing fields, preserving unrelated fields:

- `plan`: `pro` or `lifetime`; no plan is assigned merely because an Auth user exists.
- `subscriptionStatus`: current provider subscription status, or `active` for a confirmed Lifetime purchase.
- `lifetime`: boolean.
- `dodoCustomerId`, `dodoSubscriptionId` for Pro, `dodoLifetimePaymentId` for Lifetime.
- `dodoLastPaymentId`, `dodoLastPaymentStatus` track verified attempts without revoking a successful purchase.
- `dodoSubscriptions`: a map keyed by subscription ID containing status, customer/product IDs, provider event time, next billing date and scheduled cancellation flag. Multiple active subscriptions are handled without an old cancellation removing a newer valid subscription.
- `updatedAt`: Firestore server timestamp.

Private Admin-only collections:

- `dodoCheckouts/{serverGeneratedUuid}`: verified UID, selected plan, mapped product ID, Dodo environment, checkout session ID and event/timestamp tracking. Metadata is bound to this record before creating the hosted session.
- `dodoBillingObjects/{sha256}`: payment/subscription owner, provider ID/status/product, event time and update timestamp. Prevents owner mismatches and stale event writes.
- `dodoWebhookEvents/{sha256OfWebhookId}`: processed type, UID/event time when applicable, stale/ignored flags and processing timestamp. Transactionally prevents duplicate changes.

Entitlement helper returns `null` for an account without a known paid plan; existing inactive Pro returns `{ plan: "pro", active: false, lifetime: false }`. Pro access requires `subscriptionStatus === "active"`. Lifetime requires `plan === "lifetime" && lifetime === true`.

The server guard protects cloud uploads and copies. Existing project reads, asset downloads and cleanup/deletion remain available to the owner. Browser rendering/conversion remains within the existing architecture; its executable client code is not a server security boundary.

Dodo events handled

`payment.succeeded`, `payment.failed`, `payment.cancelled`, `subscription.active`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired`, `subscription.failed`, `subscription.on_hold`, `subscription.past_due`, `subscription.paused`, `subscription.plan_changed`, `subscription.unpaused`, `subscription.updated`.

Current subscription state is retrieved from Dodo rather than blindly translating the event name: Dodo payloads can contain the latest state on delayed deliveries. Scheduled cancellation remains active while the provider status is active. Product changes away from the bound Pro product disable that subscription. Failed or cancelled payment attempts do not revoke existing access. Pro events cannot overwrite a confirmed Lifetime entitlement. Refund/reversal events are not configured or implemented; Lifetime remains persistent.

Environment variables used

Existing names are unchanged and used only on the server:

- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_ENVIRONMENT` (`live_mode` or `test_mode`)
- `DODO_PAYMENTS_WEBHOOK_SECRET`
- `DODO_PRO_PRODUCT_ID`
- `DODO_LIFETIME_PRODUCT_ID`

Existing `VITE_FIREBASE_PROJECT_ID` identifies the Firebase project; only public Firebase configuration is bundled. Optional server-only `FIREBASE_PROJECT_ID` overrides the project for server/emulator use. Firebase Admin writes require either `FIREBASE_ADMIN_SERVICE_ACCOUNT` (service-account JSON, stored as a Vercel Secret) or configured Google Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` on a host with an actual credentials file). Never prefix Admin credentials with `VITE_`. For a JSON service-account environment variable, use the downloaded JSON as-is; do not replace escaped newlines in its private key manually.

Existing Firebase schema discovered

The repository obtains UID/email from Firebase Auth and stores projects under `users/{uid}/projects/{projectId}`. Project fields include `ownerId`, `projectId`, `name`, `createdAt`, `updatedAt`, `settings`, `editorState`, `r2`, `assets`, `status` and `libraryOnly`. The code has no root user-profile creation, billing schema, plan/provider fields or prior payment integration. The previous Admin usage verified Auth tokens; project authorization used Firestore REST with the user's ID token. Live user documents were not inspected because no server Firestore credentials were available; existing unknown fields are preserved by merge writes.

Migration

No user-data migration or bulk plan assignment is needed. A verified event can create the previously absent root user document without changing project subcollections. Deploy the updated Firestore rules separately from the Vercel application. Private billing collections and their documents are created on demand. Historical Dodo purchases not created through this integration need an explicit, verified association/backfill process; the handler deliberately rejects payments with no server checkout binding.

How to test Pro

1. Resolve the production blockers below, deploy the code and Firestore rules, and configure Firebase Admin credentials for the same Firebase project used by Auth.
2. For payment testing without a real charge, use a separate deployment with `DODO_PAYMENTS_ENVIRONMENT=test_mode` and that environment's API key, webhook secret and product IDs. Preserve the live Production settings. Use the provider's documented test payment methods.
3. Sign in, click the existing **Subscribe for $5/mo** button, and verify the hosted checkout shows the Pro product at USD 5/month.
4. Complete the payment manually in the chosen test environment. On return, check server entitlement rather than the return URL. The dashboard should show Pro active only after the verified webhook. Verify the root user fields and paid cloud upload/copy access.
5. Resend the same Dodo webhook delivery and confirm one processed-event record and unchanged entitlement. Exercise paused/past-due/on-hold/expired/cancelled and unpaused/active lifecycle transitions in the test dashboard. Scheduled cancellation should stay active until the provider changes its status.

How to test Lifetime

1. Use a separate Firebase test account or upgrade a Pro test account. Click **Get Lifetime for $29** and confirm USD 29 one-time in hosted checkout.
2. Complete the payment manually. `payment.succeeded` with the bound Lifetime product must set `plan=lifetime`, `lifetime=true`, `subscriptionStatus=active` and `dodoLifetimePaymentId`.
3. Return to the existing dashboard; an existing Pro entitlement must not prematurely confirm a pending Lifetime upgrade.
4. Resend the payment webhook and then deliver Pro lifecycle events for the same account. Lifetime must remain active. Check unrelated user fields remain unchanged.

Production testing blockers found on October 5, 2026

- Read-only Dodo product retrieval using the configured local live-mode key and exact supplied product IDs returned **HTTP 404 / NOT_FOUND for both products**. Check that the products exist and are accessible to this key in the same live Dodo business/environment. The application does not substitute products or change the supplied mapping.
- Read-only `vercel env ls production` confirmed all five Dodo variables are present, but no `FIREBASE_ADMIN_SERVICE_ACCOUNT`, `GOOGLE_APPLICATION_CREDENTIALS` or other configured Admin credential variable was present. Vercel does not automatically supply Google service-account credentials. Add valid server Firestore credentials before production checkout/webhook writes can work.
- This implementation has not been deployed. Actual webhook delivery and the deployed Vercel runtime require deployment and the above configuration fixes. Local Node 22 ESM/Vercel handler imports, including running without experimental CommonJS require support, were verified.
- No live checkout or real payment was initiated.

Validation completed

`npm run typecheck`, `npm run build`, `npm run test:payments`, `npm run test:payments:emulator`, `npm run test:auth`, `npm run test:firebase`, `npm run test:storage`, `npm run test:runtime`, `npm run test:project-actions` and `npm run test:cloud` passed. Real Firestore emulator checks include atomic concurrent duplicates, owner billing reads, rejected client billing writes, denied other-owner reads and private webhook/checkout collections. SDK checks include invalid/missing/expired signatures and signed JSON with unmodified whitespace. Frontend checks include exact request bodies, ID-token headers, hosted redirect, failure feedback and processing states.

The project has no lint script or lint configuration; Node syntax checks and TypeScript checks were run. `npm run check:payments` confirms the built browser contains no actual Dodo/Admin secret values or Admin imports; the read-only product check currently fails with the two 404 responses noted above. The unrelated pre-existing full editor test failure in `tests/interactions.mjs` (Lottie layer count) was not part of this change.

Official SDK/API reference: https://github.com/dodopayments/dodopayments-typescript
