import { build } from 'esbuild';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { blogPosts } from '../shared/blog-posts.mjs';

const origin = 'https://www.vekto.website';
const temporary = new URL('./.blog-prerender.mjs', import.meta.url);
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
try {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import { renderToString } from 'react-dom/server';
      import { MemoryRouter, Routes, Route } from 'react-router-dom';
      import { GoogleSignInProvider } from './src/auth/GoogleSignIn';
      import { BlogIndexPage, BlogArticlePage } from './src/Blog';
      export function render(path) {
        return renderToString(<MemoryRouter initialEntries={[path]}><GoogleSignInProvider><Routes><Route path='/blog' element={<BlogIndexPage />} /><Route path='/blog/:slug' element={<BlogArticlePage />} /></Routes></GoogleSignInProvider></MemoryRouter>);
      }
    ` },
    bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, write: false,
    plugins: [{ name: 'public-page-prerender', setup(builder) {
      builder.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebase', namespace: 'public-prerender' }));
      builder.onLoad({ filter: /.*/, namespace: 'public-prerender' }, () => ({ contents: 'export function getFirebaseAuth(){throw new Error("Authentication is browser-only.");}' }));
    } }],
  });
  await writeFile(temporary, bundle.outputFiles[0].text);
  const { render } = await import(temporary.href);
  const template = await readFile('dist/index.html', 'utf8');
  const articleSchema = (post) => ({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.description, image: `${origin}${post.cover}`, datePublished: post.publishedAt, dateModified: post.updatedAt, author: { '@type': 'Organization', name: 'Vekto Editorial', url: `${origin}/about` }, publisher: { '@type': 'Organization', name: 'Vekto', url: origin }, mainEntityOfPage: { '@type': 'WebPage', '@id': `${origin}/blog/${post.slug}` }, articleSection: post.category });
  const collectionSchema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Vekto Blog — Motion Design, SVG & Product Animation', description: 'Practical guides to motion design, SVG animation, product storytelling, Lottie exports, and accessible interface motion.', url: `${origin}/blog`, mainEntity: { '@type': 'ItemList', itemListElement: blogPosts.map((post, index) => ({ '@type': 'ListItem', position: index + 1, url: `${origin}/blog/${post.slug}`, name: post.title })) } };
  const entries = [{ path: '/blog', title: collectionSchema.name, description: collectionSchema.description, image: '/blog-covers/motion-design.svg', schema: collectionSchema, html: render('/blog') }, ...blogPosts.map(post => ({ path: `/blog/${post.slug}`, title: post.title, description: post.description, image: post.cover, schema: articleSchema(post), html: render(`/blog/${post.slug}`), post }))];
  for (const entry of entries) {
    let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escape(entry.title)}</title>`);
    html = html.replace('</head>', `
      <meta name="description" content="${escape(entry.description)}">
      <link rel="canonical" href="${origin}${entry.path}">
      <meta property="og:title" content="${escape(entry.title)}"><meta property="og:description" content="${escape(entry.description)}">
      <meta property="og:url" content="${origin}${entry.path}"><meta property="og:type" content="${entry.post ? 'article' : 'website'}">
      <meta property="og:image" content="${origin}${entry.image}"><meta name="twitter:card" content="summary_large_image">
      <script type="application/ld+json">${JSON.stringify(entry.schema).replaceAll('<', '\\u003c')}</script>
    </head>`);
    html = html.replace('<div id="root"></div>', `<div id="root">${entry.html}</div>`);
    const directory = entry.path === '/blog' ? 'dist/blog' : `dist${entry.path}`;
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/index.html`, html);
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/about', '/blog', ...blogPosts.map(post => `/blog/${post.slug}`)].map(path => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
  await writeFile('dist/sitemap.xml', sitemap);
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  console.log(`PASS: prerendered the blog index and ${blogPosts.length} articles with metadata, structured data, sitemap, and robots policy.`);
} finally {
  await unlink(temporary).catch(() => {});
}
