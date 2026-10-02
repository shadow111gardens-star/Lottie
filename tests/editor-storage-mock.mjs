// Editor interaction tests isolate persistence; cloud-flow exercises real SDKs/rules/API.
export const editorStorageMock = {
  name: 'editor-storage-boundary',
  setup(build) {
    build.onResolve({ filter: /projects\/store$/ }, () => ({ path: 'store', namespace: 'editor-storage' }));
    build.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'editor-storage' }));
    build.onLoad({ filter: /.*/, namespace: 'editor-storage' }, args => ({ contents: args.path === 'firebase'
      ? 'export function getFirebaseAuth() { return { currentUser: { uid: "interaction-user" } }; }'
      : 'export function localProject(){return null;} export async function preserveDraft(id, scene) { globalThis.editorDraft = scene; } export async function saveProject(id, scene) { globalThis.editorSaved = scene; } export async function loadProject() { throw new Error("Use Workspace in editor-only tests"); } export async function frameSvg() { return undefined; }' }));
  },
};
