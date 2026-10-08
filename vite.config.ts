import path from "path";
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createStorageMiddleware } from './server/storage.mjs';
import { createPaymentsApi } from './server/payments.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), {
    name: 'authenticated-project-storage',
    configureServer(server) { server.middlewares.use(createPaymentsApi()); server.middlewares.use('/api/storage', createStorageMiddleware()); },
    configurePreviewServer(server) {
      // Vite preview otherwise resolves extensionless SPA paths to the homepage HTML.
      server.middlewares.use((request, response, next) => {
        if (!/^\/about\/?$/.test((request.url ?? '').split('?')[0])) return next();
        void readFile(path.resolve(__dirname, 'dist/about/index.html')).then(html => {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(html);
        }).catch(next);
      });
      server.middlewares.use(createPaymentsApi());
      server.middlewares.use('/api/storage', createStorageMiddleware());
    },
  }],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
