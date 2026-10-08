import { build } from 'esbuild';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';

// Prerender only the public About route. Authentication stays browser-only:
// rendering a sign-in button must not initialize services or read credentials.
const temporary = new URL('./.about-prerender.mjs', import.meta.url);
try {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import { renderToString } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import AboutPage from './src/About';
      export { aboutStructuredData } from './src/About';
      import { Navbar, Footer } from './src/SiteChrome';
      import { GoogleSignInProvider } from './src/auth/GoogleSignIn';
      export function render() {
        return renderToString(<MemoryRouter initialEntries={['/about']}><GoogleSignInProvider><AboutPage navbar={<Navbar about />} footer={<Footer about />} /></GoogleSignInProvider></MemoryRouter>);
      }
    ` },
    bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, write: false,
    plugins: [{ name: 'public-page-prerender', setup(builder) {
      builder.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'public-prerender' }));
      builder.onLoad({ filter: /.*/, namespace: 'public-prerender' }, () => ({ contents: 'export function getFirebaseAuth(){throw new Error("Authentication is only available in the browser.");}' }));
    } }],
  });
  await writeFile(temporary, bundle.outputFiles[0].text);
  const { render, aboutStructuredData } = await import(temporary.href);
  let html = await readFile('dist/index.html', 'utf8');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>About Vekto — Building the Future of Product Animation</title>');
  html = html.replace('</head>', `
    <meta data-about-metadata name="description" content="Learn about Vekto, its founder Abhay Solanki, and the vision behind building a simpler, AI-native way to create product animations.">
    <link data-about-metadata rel="canonical" href="https://www.vekto.website/about">
    <meta data-about-metadata property="og:title" content="About Vekto — Building the Future of Product Animation">
    <meta data-about-metadata property="og:description" content="Learn about Vekto, its founder Abhay Solanki, and the vision behind building a simpler, AI-native way to create product animations.">
    <meta data-about-metadata property="og:url" content="https://www.vekto.website/about">
    <meta data-about-metadata property="og:type" content="website">
    <meta data-about-metadata name="twitter:card" content="summary">
  </head>`);
  html = html.replace('</head>', `<script data-about-schema type="application/ld+json">${JSON.stringify(aboutStructuredData).replace(/</g, '\\u003c')}</script></head>`);
  html = html.replace('<div id="root"></div>', () => `<div id="root">${render()}</div>`);
  await mkdir('dist/about', { recursive: true });
  await writeFile('dist/about/index.html', html);
  console.log('PASS: prerendered /about with the shared navbar/footer, complete content and route-specific SEO metadata.');
} finally {
  await unlink(temporary).catch(() => {});
}
