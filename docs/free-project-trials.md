# Free project trials

The Free plan includes three project slots per authenticated account, with keyframes/text animation, layers/shapes/colors, editable SVG and SVG/Lottie exports. Pro and Lifetime checkout and webhook handling are unchanged.

Selecting Free enrolls the account through authenticated POST /api/trial (action=start). Authenticated Dashboard access also enrolls new/legacy accounts in Free after server access verification; it never opens pricing automatically. Upgrade buttons explicitly open a dismissible modal over the real, inert Dashboard. A newly confirmed paid entitlement closes that modal. GET /api/entitlement returns trial access separately from the paid entitlement. A free account can use the workspace; only projects with a server-issued grant can be created or edited.

New projects, imported projects, library file projects and duplicates allocate a slot through POST /api/trial (action=reserve, projectId). Allocation is transactional, capped at three and idempotent for the same project ID. Reserved project slots persist through failed upload retries, deletion, sign-out and refresh. Deleting or restoring the same project never resets usage. Existing trial projects remain editable after all slots are allocated. Pro/Lifetime do not consume trial slots.

Private counters live on users/{uid}: freeTrialEnabled and freeProjectsUsed. Immutable per-project grants live under users/{uid}/trialProjects/{projectId}. Client rules cannot write either. Firestore project writes and R2 upload/copy operations require a paid entitlement or the corresponding trial grant. Paid entitlement fields are never fabricated for Free accounts.

Deployment requires frontend/server changes, the new api/trial.mjs function and updated firestore.rules together. Deploy the rules before enabling Free in Production. No new Dodo product, key or payment is needed.
