import express from 'express';
import { createStorageApi } from '../server/storage.mjs';

// Preserve SVG/video/JSON bytes for the existing Express body parsers.
export const config = { api: { bodyParser: false } };

// Vercel's Node function reuses the same authenticated handler as Vite/Node.
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const url = new URL(req.url, 'http://storage.internal');
  const routes = url.searchParams.getAll('__storageRoute');
  if (routes.length > 1) return res.status(400).json({ code: 'INVALID_ROUTE', error: 'Invalid storage route.' });
  const route = routes[0] || url.pathname.replace(/^\/api\/storage\/?/, '');
  url.searchParams.delete('__storageRoute');
  if (!/^[A-Za-z0-9_-]{1,128}(?:\/copy)?$/.test(route)) return res.status(404).json({ code: 'STORAGE_ROUTE_NOT_FOUND', error: 'Unknown project storage route.' });
  req.storageRoute = `/api/storage/${route}`;
  req.url = `/${route}${url.searchParams.size ? `?${url.searchParams}` : ''}`;
  next();
});
app.use(createStorageApi({ diagnostics: true }));
export default app;
