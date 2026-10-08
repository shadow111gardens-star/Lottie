import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { Window } from 'happy-dom';

const win = new Window({ url: 'https://www.vekto.website/about' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'Event']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true });
}
win.matchMedia = query => ({ media: query, matches: query.includes('prefers-reduced-motion'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
document.title = 'Original website title';
const originalDescription = document.createElement('meta');
originalDescription.name = 'description'; originalDescription.content = 'Original description'; document.head.append(originalDescription);
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { renderToString } = await import('react-dom/server');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const output = new URL('./.about-ui.mjs', import.meta.url);
const bundle = await build({ entryPoints: ['src/About.tsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, write: false });
await writeFile(output, bundle.outputFiles[0].text);
const host = document.createElement('div'); document.body.append(host);
const root = createRoot(host);
try {
  const About = (await import(output.href)).default;
  const page = React.createElement(About, { navbar: null, footer: null });
  const serverHtml = renderToString(page);
  assert.ok(serverHtml.includes('Abhay Solanki'));
  assert.ok(serverHtml.includes('NOT A RELEASED WORKFLOW'));
  await React.act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/about'] }, React.createElement(Routes, null, React.createElement(Route, { path: '/about', element: page })))));
  assert.equal(host.querySelectorAll('h1').length, 1);
  assert.equal(host.querySelectorAll('h2').length, 11);
  assert.equal(document.title, 'About Vekto — Building the Future of Product Animation');
  assert.equal(document.querySelector('link[rel="canonical"]').href, 'https://www.vekto.website/about');
  assert.equal(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).mainEntity.founder.name, 'Abhay Solanki');
  assert.match(originalDescription.content, /Abhay Solanki/);
  for (const section of host.querySelectorAll('section')) assert.ok(host.querySelector(`#${section.getAttribute('aria-labelledby')}`));
  for (const anchor of host.querySelectorAll('a[href^="#"]')) assert.ok(host.querySelector(anchor.getAttribute('href')));
  for (const anchor of host.querySelectorAll('a[target="_blank"]')) {
    assert.equal(anchor.rel, 'noopener noreferrer');
    assert.ok(anchor.getAttribute('aria-label').includes('new tab'));
    assert.ok(['https://x.com/abhay8769', 'https://www.linkedin.com/in/abhay-solanki-b2a503234/'].includes(anchor.href));
  }
  assert.equal(host.querySelectorAll('a[href="mailto:founder@vekto.website"]').length, 4);
  const app = await readFile('src/App.tsx', 'utf8');
  assert.match(app, /path="\/about" element=\{<AboutPage/);
  const routing = JSON.parse(await readFile('vercel.json', 'utf8'));
  const fallback = routing.routes.find(route => route.src && new RegExp(route.src).test('/about'));
  assert.equal(fallback.dest, '/about/index.html');
  assert.ok(new RegExp(fallback.src).test('/about/'));
  assert.match(await readFile('src/about.css', 'utf8'), /prefers-reduced-motion:reduce/);
  await React.act(async () => root.unmount());
  assert.equal(document.title, 'Original website title');
  assert.equal(originalDescription.content, 'Original description');
  assert.equal(document.querySelector('link[rel="canonical"]'), null);
  assert.equal(document.querySelector('script[type="application/ld+json"]'), null);
  console.log('PASS: direct /about render, server content, headings, landmarks, social/email/anchor links, metadata cleanup, hosting refresh route and reduced-motion styling.');
} finally {
  await unlink(output).catch(() => {});
  await win.happyDOM.close();
}
