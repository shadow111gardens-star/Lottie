import express from 'express';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, CopyObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';

// Server-only module. Vite never imports this module into a browser entry point.
config({ quiet: true });
export function createR2Client() {
  for (const name of ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) {
    if (!process.env[name]?.trim()) throw new Error('Server storage configuration is unavailable.');
  }
  if (process.env.R2_BUCKET_NAME.trim() !== 'svgforge-assets') throw Object.assign(new Error('Server storage bucket must be svgforge-assets.'), { status: 503, code: 'STORAGE_CONFIGURATION_ERROR' });
  const endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return new S3Client({ region: 'auto', endpoint, credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(), secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
  }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
}
export function projectPrefix(uid, projectId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) throw Object.assign(new Error('Invalid project identifier.'), { status: 400 });
  return `users/${uid}/projects/${projectId}/`;
}
export function objectKey(uid, projectId, relative) {
  if (typeof relative !== 'string' || !/^(source|frames|lottie|thumbnails|project)\/[A-Za-z0-9_./-]+$/.test(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Object.assign(new Error('Invalid asset path.'), { status: 400 });
  }
  return projectPrefix(uid, projectId) + relative;
}
export function createStorageMiddleware() {
  const application = express();
  application.disable('x-powered-by');
  application.use(createStorageApi());
  return application;
}
export function createStorageApi(options = {}) {
  const router = express.Router();
  let client;
  const s3 = () => options.s3 || (client ??= createR2Client());
  const bucket = options.bucket || process.env.R2_BUCKET_NAME?.trim();
  const diagnostics = options.diagnostics && process.env.STORAGE_DIAGNOSTICS !== '0';
  const trace = (req, stage, exists = null) => {
    req.storageStage = stage;
    if (diagnostics) console.info(JSON.stringify({ event: 'project-storage', requestId: req.storageRequestId, route: req.storageRoute || req.originalUrl?.split('?')[0], method: req.method, uid: req.identity?.uid || null, projectId: req.storageProjectId || null, key: req.storageKey || null, bucket, exists, stage }));
  };
  const verify = options.verify || (async token => {
    const app = getApps().find(app => app.name === 'storage-api') || initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID }, 'storage-api');
    return getAuth(app).verifyIdToken(token);
  });
  // Use the user's ID token for Firestore REST; this also enforces deployed rules.
  const authorizeProject = options.authorizeProject || (async (uid, id, token, mutation) => {
    const host = process.env.FIRESTORE_EMULATOR_HOST ? `http://${process.env.FIRESTORE_EMULATOR_HOST}` : 'https://firestore.googleapis.com';
    const url = `${host}/v1/projects/${encodeURIComponent(process.env.VITE_FIREBASE_PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(uid)}/projects/${encodeURIComponent(id)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw Object.assign(new Error('Project access denied or project unavailable.'), { status: response.status === 404 ? 404 : 403, code: response.status === 404 ? 'PROJECT_NOT_FOUND' : 'PROJECT_ACCESS_DENIED' });
    const document = await response.json();
    if (mutation && document.fields?.status?.stringValue === 'deleting') throw Object.assign(new Error('This project is being deleted.'), { status: 409 });
  });
  router.use(async (req, res, next) => {
    req.storageRequestId = randomUUID();
    res.setHeader('X-SVGForge-Storage', 'authenticated-r2');
    res.setHeader('X-Request-Id', req.storageRequestId);
    trace(req, 'authentication');
    res.setHeader('Cache-Control', 'private, no-store');
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Sign in to access project storage.', requestId: req.storageRequestId });
    try { req.identity = await verify(token); req.idToken = token; trace(req, 'authenticated'); next(); }
    catch { res.status(401).json({ code: 'AUTH_INVALID', error: 'Your sign-in session has expired. Sign in again.', requestId: req.storageRequestId }); }
  });
  const operations = new Map();
  router.use('/:projectId', async (req, res, next) => {
    try {
      req.storageProjectId = req.params.projectId;
      const key = projectPrefix(req.identity.uid, req.params.projectId);
      const before = operations.get(key) || Promise.resolve();
      let release;
      const finished = new Promise(resolve => { release = resolve; });
      const pending = before.then(() => finished);
      operations.set(key, pending);
      await before;
      let released = false;
      const done = () => { if (released) return; released = true; release(); if (operations.get(key) === pending) operations.delete(key); };
      res.once('finish', done); res.once('close', done);
      next();
    } catch (error) { next(error); }
  });
  async function list(prefix) {
    const keys = []; let continuation;
    do {
      const result = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuation }));
      keys.push(...(result.Contents || []).map(object => object.Key));
      continuation = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuation);
    return keys;
  }
  router.get('/:projectId', async (req, res, next) => {
    try {
      const key = objectKey(req.identity.uid, req.params.projectId, req.query.path);
      req.storageKey = key; trace(req, 'project-authorization');
      await authorizeProject(req.identity.uid, req.params.projectId, req.idToken, false);
      trace(req, 'r2-read');
      const result = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      trace(req, 'r2-object-found', true);
      res.setHeader('Content-Type', result.ContentType || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.send(Buffer.from(await result.Body.transformToByteArray()));
    } catch (error) { next(error); }
  });
  router.put('/:projectId', express.raw({ type: () => true, limit: '768mb' }), async (req, res, next) => {
    try {
      const key = objectKey(req.identity.uid, req.params.projectId, req.query.path);
      req.storageKey = key; trace(req, 'project-authorization');
      await authorizeProject(req.identity.uid, req.params.projectId, req.idToken, true);
      const body = req.body;
      if (!Buffer.isBuffer(body) || !body.length) throw Object.assign(new Error('The uploaded file is empty.'), { status: 400 });
      trace(req, 'r2-upload');
      await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: req.headers['content-type'] || 'application/octet-stream' }));
      try { await authorizeProject(req.identity.uid, req.params.projectId, req.idToken, true); }
      catch (error) {
        // Clean up a write whose project was deleted by another server instance.
        if ([404, 409].includes(error.status)) await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }] } }));
        throw error;
      }
      trace(req, 'r2-object-written', true);
      res.json({ key });
    } catch (error) { next(error); }
  });
  router.post('/:projectId/copy', express.json({ limit: '2kb' }), async (req, res, next) => {
    try {
      const uid = req.identity.uid, source = projectPrefix(uid, req.params.projectId), target = projectPrefix(uid, req.body.projectId);
      if (source === target) throw Object.assign(new Error('Choose a different destination project.'), { status: 400 });
      await authorizeProject(uid, req.params.projectId, req.idToken, true);
      await authorizeProject(uid, req.body.projectId, req.idToken, true);
      for (const key of await list(source)) await s3().send(new CopyObjectCommand({ Bucket: bucket, Key: target + key.slice(source.length), CopySource: `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}` }));
      res.json({ copied: true });
    } catch (error) { next(error); }
  });
  router.delete('/:projectId', async (req, res, next) => {
    try {
      const prefix = projectPrefix(req.identity.uid, req.params.projectId);
      // A retry must also clean orphaned assets after Firestore already removed
      // the document. UID still comes exclusively from the verified token.
      try { await authorizeProject(req.identity.uid, req.params.projectId, req.idToken, false); }
      catch (error) { if (error.status !== 404) throw error; }
      const keys = await list(prefix);
      for (let i = 0; i < keys.length; i += 1000) {
        const result = await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })) } }));
        if (result.Errors?.length) throw new Error('Some project files could not be deleted. Retry deletion.');
      }
      res.json({ deleted: true });
    } catch (error) { next(error); }
  });
  router.use((req, res) => res.status(404).json({ code: 'STORAGE_ROUTE_NOT_FOUND', error: 'Unknown project storage route.', requestId: req.storageRequestId }));
  router.use((error, req, res, _next) => {
    const missing = error.name === 'NoSuchKey' || (req.storageStage === 'r2-read' && error.$metadata?.httpStatusCode === 404 && error.name !== 'NoSuchBucket');
    const status = error.status || (missing ? 404 : error.type === 'entity.too.large' ? 413 : 502);
    const code = error.code || (missing ? 'ASSET_NOT_FOUND' : error.name === 'NoSuchBucket' ? 'STORAGE_BUCKET_NOT_FOUND' : error.type === 'entity.too.large' ? 'ASSET_TOO_LARGE' : status === 400 ? 'INVALID_STORAGE_REQUEST' : 'STORAGE_REQUEST_FAILED');
    trace(req, code, missing ? false : null);
    const message = missing ? 'This project asset was not found in R2. Save the project again to upload it.' : status < 500 ? error.message : 'Project storage request failed on the server. Your local changes are preserved; please retry.';
    res.status(status).json({ code, error: message, requestId: req.storageRequestId });
  });
  return router;
}
