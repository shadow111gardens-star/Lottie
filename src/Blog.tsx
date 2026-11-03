import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { blogPosts, blogPostBySlug } from '../shared/blog-posts.mjs';
import { Footer, Navbar } from './SiteChrome';
import './blog.css';

const origin = 'https://www.vekto.website';
const indexTitle = 'Vekto Blog — Motion Design, SVG & Product Animation';
const indexDescription = 'Practical guides to motion design, SVG animation, product storytelling, Lottie exports, and accessible interface motion.';
function setMeta(selector: string, tag: 'meta' | 'link', attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = document.createElement(tag); document.head.append(el); }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
}
function useSeo(title: string, description: string, path: string, image?: string, schema?: object) {
  useEffect(() => {
    document.head.querySelector('meta[name="robots"]')?.remove();
    document.title = title;
    setMeta('meta[name="description"]', 'meta', { name: 'description', content: description });
    setMeta('link[rel="canonical"]', 'link', { rel: 'canonical', href: `${origin}${path}` });
    setMeta('meta[property="og:title"]', 'meta', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', 'meta', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', 'meta', { property: 'og:url', content: `${origin}${path}` });
    setMeta('meta[property="og:type"]', 'meta', { property: 'og:type', content: image ? 'article' : 'website' });
    setMeta('meta[property="og:image"]', 'meta', { property: 'og:image', content: image ? `${origin}${image}` : `${origin}/blog-covers/motion-design.svg` });
    setMeta('meta[name="twitter:card"]', 'meta', { name: 'twitter:card', content: 'summary_large_image' });
    let script = document.head.querySelector<HTMLScriptElement>('script[data-blog-schema]');
    if (!script) { script = document.createElement('script'); script.dataset.blogSchema = 'true'; script.type = 'application/ld+json'; document.head.append(script); }
    script.textContent = schema ? JSON.stringify(schema) : '';
  }, [title, description, path, image, schema]);
}
function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="blog-page font-display"><Navbar about /><main>{children}</main><Footer about /></div>;
}
const indexSchema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: indexTitle, description: indexDescription, url: `${origin}/blog`, mainEntity: { '@type': 'ItemList', itemListElement: blogPosts.map((post, i) => ({ '@type': 'ListItem', position: i + 1, url: `${origin}/blog/${post.slug}`, name: post.title })) } };
export function BlogIndexPage() {
  useSeo(indexTitle, indexDescription, '/blog', undefined, indexSchema);
  return <BlogLayout><header className="blog-hero"><div className="blog-container"><p className="blog-kicker">VEKTO · MOTION NOTES</p><h1>Ideas in <span>motion.</span></h1><p>Practical notes on SVG, animation, and making product stories easier to understand.</p></div></header><section className="blog-container blog-grid" aria-label="Articles">{blogPosts.map(post => <article className="blog-card" key={post.slug}><Link to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}><img src={post.cover} alt={post.coverAlt} loading="lazy"/><div className="blog-card-copy"><p className="blog-kicker">{post.category}</p><h2>{post.title}</h2><p>{post.description}</p><span>Read article <ArrowRight size={16}/></span></div></Link></article>)}</section></BlogLayout>;
}
function articleSchema(post: (typeof blogPosts)[number]) {
  const url = `${origin}/blog/${post.slug}`;
  return { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.description, image: `${origin}${post.cover}`, datePublished: post.publishedAt, dateModified: post.updatedAt, author: { '@type': 'Organization', name: 'Vekto Editorial', url: `${origin}/about` }, publisher: { '@type': 'Organization', name: 'Vekto', url: origin }, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, articleSection: post.category };
}
export function BlogArticlePage() {
  const { slug = '' } = useParams();
  const post = blogPostBySlug[slug];
  useSeo(post?.title ?? 'Article not found — Vekto Blog', post?.description ?? indexDescription, `/blog/${slug}`, post?.cover, post ? articleSchema(post) : indexSchema);
  if (!post) return <BlogLayout><section className="blog-container blog-not-found"><h1>Article not found</h1><Link to="/blog">Back to the Vekto blog</Link></section></BlogLayout>;
  const breadcrumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin }, { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` }, { '@type': 'ListItem', position: 3, name: post.title, item: `${origin}/blog/${post.slug}` }] };
  return <BlogLayout><article className="blog-article"><header className="blog-article-head blog-container"><Link className="blog-back" to="/blog"><ArrowLeft size={16}/> All articles</Link><p className="blog-kicker">{post.category} · {post.readTime} min read</p><h1>{post.title}</h1><p className="blog-deck">{post.description}</p><div className="blog-byline"><span>Vekto Editorial</span><span>{new Date(`${post.publishedAt}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span><span><Clock3 size={15}/> {post.readTime} min read</span></div></header><img className="blog-cover" src={post.cover} alt={post.coverAlt} width="1200" height="630"/><div className="blog-prose"><p className="blog-intro">{post.intro}</p>{post.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.points.length > 0 && <ul>{section.points.map(point => <li key={point}>{point}</li>)}</ul>}</section>)}<p>Explore <Link to="/#capabilities">Vekto’s animation workflow</Link> or browse more <Link to="/blog">motion design articles</Link>.</p></div><nav className="blog-related blog-container" aria-label="Related articles"><h2>Keep exploring</h2><div>{post.related.map(relatedSlug => { const related = blogPostBySlug[relatedSlug]; return related ? <Link key={related.slug} to={`/blog/${related.slug}`}><span className="blog-kicker">{related.category}</span><strong>{related.title}</strong><ArrowRight size={17}/></Link> : null; })}</div></nav><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}/></article></BlogLayout>;
}
