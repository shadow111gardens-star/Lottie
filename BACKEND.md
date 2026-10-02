# SVGForge project persistence

The existing Firebase Auth session owns all projects. Firestore documents live at
`users/{uid}/projects/{projectId}`. No project operation is allowed while signed out.
Owner-only rules are in `firestore.rules` and deployed to the configured project.

`npm run dev` and `npm run preview` include the authenticated `/api/storage` routes.
Vercel deploys `api/storage.mjs`; `vercel.json` routes `/api/storage/{projectId}`
and `/copy` to that function before the editor SPA fallback. The rewrite preserves
the `path` query and passes the entire project ID (including `new-`) unchanged.
The function reuses `server/storage.mjs`; no separate storage implementation exists.
For standalone Node hosting, run `npm run build` followed by `npm start`.
Hosting only `dist` will not provide the storage API. Existing environment variables are read on the server; R2 secrets
are never sent to Vite's client bundle. Firebase Storage is not used.

R2 files are stored under `users/{uid}/projects/{projectId}/` in `source`, `frames`,
`lottie`, `thumbnails`, and `project`. Frame files retain names such as `001.svg`;
Lottie files retain `animation.json`. Content-hash subdirectories distinguish
asset versions and media layers. Immutable `project/{revision}/editor.json`
snapshots contain complete editable layers, keyframes, source frame identities,
timestamps, SVG references and settings. Firestore stores small metadata and
snapshot/file references. This avoids Firestore size limits and preserves the
previous saved snapshot when an upload fails.

Every storage request verifies a Firebase ID token and checks the user's project
document against Firestore rules. The server derives UID from the verified token,
validates all relative object paths and never accepts a client-supplied owner UID.

Autosave waits 1.2 seconds after editing stops and serializes writes per project.
The existing saved-status control and Ctrl+S also trigger a save. IndexedDB holds
private owner-scoped drafts; a failed save keeps the draft for reopening. Revision
checks reject conflicting saves from another session instead of overwriting them.
Export the editable project to retain a conflicted draft before resolving it.

Duplicate creates its own ID and R2 prefix. Delete first marks the document as
deleting, removes its R2 objects, then deletes its Firestore record. A failed delete
retains that record for retry through the existing Delete action. The existing Undo
notification retains a private in-memory backup and restores assets and state;
it expires when that dashboard session ends.

Verification:

- `npm run typecheck`, `npm test`, `npm run test:auth`, `npm run test:firebase`.
- `npm run test:storage`: API authentication, paths, copy/delete and failure checks.
- `npm run test:vector`: real VTracer WASM and every-frame/failure/timing checks.
- `npm run test:cloud`: real Firebase Auth/Firestore emulators, deployed-rule source,
  real FFmpeg and VTracer, R2-compatible test storage, save/reopen and CRUD.
- Set `SVGFORGE_TEST_REAL_R2=1` for `test:cloud` to use the configured live R2 bucket.
  This creates uniquely identified temporary projects and deletes their objects.
  Firebase Auth and Firestore still use emulators; no live user projects are touched.
- After building, `node scripts/check-browser-secrets.mjs` checks all browser outputs
  without printing configuration values.

Emulator tests use the local Firebase CLI. On Windows the runner downloads and
verifies a portable Java 21 runtime into the system temporary directory when needed;
it does not change system Java settings. A real browser Google popup login is a
separate manual check and is not replaced by the emulator sign-in test.

Vercel diagnostics (temporary, disable with server `STORAGE_DIAGNOSTICS=0`) log
request ID, route, verified UID, project ID, derived object key, bucket, stage and
object existence determined by actual R2 GET/PUT results. They do not log tokens,
headers or credentials. `X-SVGForge-Storage: authenticated-r2` identifies handler
responses; JSON codes distinguish `PROJECT_NOT_FOUND`, `ASSET_NOT_FOUND` and
`STORAGE_ROUTE_NOT_FOUND`. Bucket configuration must equal `svgforge-assets`.

Vercel limits function request/response payloads to 4.5 MB. This route fix does
not change the existing binary upload protocol; files above that platform limit
require a separate follow-up to extend this same authenticated R2 handler with
multipart transfer. The standalone Node server retains its existing upload limit.
