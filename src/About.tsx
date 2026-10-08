import { useEffect, type ReactNode } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Braces, Check, Code2, Command, Heart, Layers, Mail, MessageSquare, MousePointer2, Play, SlidersHorizontal, Sparkles, Terminal, Zap } from 'lucide-react';
import './about.css';

const email = 'founder@vekto.website';
const title = 'About Vekto — Building the Future of Product Animation';
const description = 'Learn about Vekto, its founder Abhay Solanki, and the vision behind building a simpler, AI-native way to create product animations.';
export const aboutStructuredData = {
  '@context': 'https://schema.org', '@type': 'AboutPage', name: title, description, url: 'https://www.vekto.website/about',
  mainEntity: {
    '@type': 'Organization', name: 'Vekto', url: 'https://www.vekto.website/', foundingDate: '2026', email,
    founder: { '@type': 'Person', name: 'Abhay Solanki', jobTitle: 'Founder', email, sameAs: ['https://x.com/abhay8769', 'https://www.linkedin.com/in/abhay-solanki-b2a503234/'] },
  },
};

function SocialLinks() {
  return <div className="about-socials">
    <a href="https://x.com/abhay8769" target="_blank" rel="noopener noreferrer" aria-label="Abhay Solanki on X (opens in a new tab)"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L5.5 22H2.3l7.2-8.3L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" /></svg>X<ArrowUpRight aria-hidden="true" /></a>
    <a href="https://www.linkedin.com/in/abhay-solanki-b2a503234/" target="_blank" rel="noopener noreferrer" aria-label="Abhay Solanki on LinkedIn (opens in a new tab)"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96C2 21.32 2.69 22 3.55 22h16.9c.86 0 1.55-.68 1.55-1.52V3.52C22 2.68 21.31 2 20.45 2ZM7.93 18.75H4.96V9.2h2.97ZM6.44 7.9a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44Zm12.31 10.85h-2.97V14.1c0-1.11-.02-2.54-1.55-2.54-1.55 0-1.79 1.21-1.79 2.46v4.73H9.47V9.2h2.85v1.3h.04c.4-.75 1.37-1.55 2.82-1.55 3.02 0 3.57 1.99 3.57 4.58Z" /></svg>LinkedIn<ArrowUpRight aria-hidden="true" /></a>
    <a href={`mailto:${email}`} aria-label={`Email Abhay Solanki at ${email}`}><Mail aria-hidden="true" />Email<ArrowUpRight aria-hidden="true" /></a>
  </div>;
}

function Section({ id, number, label, children, className = '' }: { id: string; number: string; label: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.section id={id} aria-labelledby={`${id}-title`} className={`about-section ${className}`} initial={false} whileInView={reduced ? undefined : { opacity: [0.65, 1], y: [16, 0] }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
    <div className="about-eyebrow"><span>{number}</span>{label}</div>{children}
  </motion.section>;
}

function Workflow({ label, items, vision = false }: { label: string; items: string[]; vision?: boolean }) {
  return <div className={`about-workflow ${vision ? 'about-workflow-vision' : ''}`}><h3>{label}</h3><ol>{items.map((item, index) => <li key={item}><span className="about-step-index">0{index + 1}</span><span>{item}</span>{index < items.length - 1 && <ArrowRight aria-hidden="true" />}</li>)}</ol></div>;
}

export default function AboutPage({ navbar, footer }: { navbar: ReactNode; footer: ReactNode }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const oldTitle = document.title === title ? 'vekto Studio — Animate Your Product Story' : document.title;
    document.title = title;
    const cleanups: (() => void)[] = [];
    const metadata = (selector: string, attributes: Record<string, string>) => {
      const existing = document.head.querySelector(selector);
      const element = existing ?? document.createElement(selector.startsWith('link') ? 'link' : 'meta');
      const previous = element.getAttribute(attributes.href ? 'href' : 'content');
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      if (!existing) document.head.append(element);
      cleanups.push(() => { if (!existing || element.hasAttribute('data-about-metadata')) element.remove(); else if (previous === null) element.removeAttribute(attributes.href ? 'href' : 'content'); else element.setAttribute(attributes.href ? 'href' : 'content', previous); });
    };
    metadata('meta[name="description"]', { name: 'description', content: description });
    metadata('link[rel="canonical"]', { rel: 'canonical', href: 'https://www.vekto.website/about' });
    metadata('meta[property="og:title"]', { property: 'og:title', content: title });
    metadata('meta[property="og:description"]', { property: 'og:description', content: description });
    metadata('meta[property="og:url"]', { property: 'og:url', content: 'https://www.vekto.website/about' });
    metadata('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    metadata('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    const structuredData = document.head.querySelector<HTMLScriptElement>('script[data-about-schema]') ?? document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.textContent = JSON.stringify(aboutStructuredData);
    document.head.append(structuredData);
    cleanups.push(() => structuredData.remove());
    if (!window.location.hash) window.scrollTo(0, 0);
    else requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView());
    return () => { document.title = oldTitle; cleanups.forEach(cleanup => cleanup()); };
  }, []);

  return <MotionConfig reducedMotion="user"><div className="about-page font-display">
    <a className="about-skip" href="#about-main">Skip to content</a>
    {navbar}
    <main id="about-main" tabIndex={-1}>
      <section className="about-hero about-container" aria-labelledby="about-title">
        <div className="about-eyebrow"><span className="about-live-dot" />ABOUT VEKTO · INDEPENDENTLY BUILT</div>
        <motion.div initial={false} animate={reduced ? undefined : { opacity: [0.6, 1], y: [18, 0] }} transition={{ duration: 0.7 }}>
          <h1 id="about-title">Building the future of<br /><span className="gradient-text">product animation.</span></h1>
          <div className="about-hero-bottom"><div><p className="about-lead">Vekto is building a simpler way to create, automate, and eventually generate product animations with AI.</p><p className="about-hero-founder">Founder-led software & SaaS. Built by <a href="#founder">Abhay Solanki <ArrowUpRight aria-hidden="true" /></a> in India.</p></div><a href="#story" className="about-button">Get to know Vekto<ArrowRight aria-hidden="true" /></a></div>
        </motion.div>
        <div className="about-hero-art" aria-label="Illustrative animation timeline: an idea becomes a product reveal">
          <div className="about-art-header"><span><Layers aria-hidden="true" />THE IDEA, IN MOTION</span><span className="about-art-status">An illustration of our vision</span></div>
          <div className="about-art-stage"><div className="about-prompt"><MessageSquare aria-hidden="true" /><span>A product reveal.<br /><strong>A little more alive.</strong></span></div><div className="about-stage-arrow"><ArrowRight aria-hidden="true" /></div><div className="about-preview"><div className="about-preview-top"><i /><i /><i /><span>product / preview</span></div><div className="about-preview-content"><div className="about-preview-line" /><div className="about-preview-cards"><span /><span /><span /></div><span className="about-preview-cta">Your next idea<ArrowUpRight aria-hidden="true" /></span><MousePointer2 className="about-preview-pointer" aria-hidden="true" /></div></div></div>
          <div className="about-art-timeline"><span><Play aria-hidden="true" />01:20</span><div><i /><i /><i /></div><span>IDEA → MOVEMENT</span></div>
        </div>
        <dl className="about-facts"><div><dt>Founded</dt><dd>2026</dd></div><div><dt>Built in</dt><dd>India</dd></div><div><dt>Our focus</dt><dd>Product animation</dd></div><div><dt>Our approach</dt><dd>Founder-led. AI-native.</dd></div></dl>
      </section>

      <div className="about-container">
        <Section id="story" number="01" label="Our story"><div className="about-split"><h2 id="story-title">An idea deserves<br /><span className="about-muted">a little movement.</span></h2><div className="about-copy"><p>Good products have stories worth telling. But turning a product into a polished animation can mean juggling tools, learning complicated timelines, and doing hours of manual work.</p><p>Vekto began with a simpler question: what if the path from an idea to a visual result felt more direct?</p><p>Founded in 2026 by Abhay Solanki, Vekto is an independently built SaaS platform exploring that question—one workflow, experiment, and iteration at a time.</p></div></div></Section>

        <Section id="product" number="02" label="What is Vekto?"><div className="about-split"><h2 id="product-title">Your browser.<br /><span className="gradient-text">Your product story.</span></h2><div className="about-copy"><p>Vekto is being built to make product visuals, animation, and product storytelling easier for creators, founders, developers, and product teams.</p><p>The current focus is a simpler browser-based workflow for creating polished animated visuals. The longer-term direction is an AI-native experience that helps turn what you describe into something you can preview, refine, and use.</p></div></div><div className="about-three"><article className="about-card card-hover"><MousePointer2 aria-hidden="true" /><h3>Create with clarity</h3><p>A more direct path from an idea to a visual, without unnecessary complexity.</p></article><article className="about-card card-hover"><SlidersHorizontal aria-hidden="true" /><h3>Keep creative control</h3><p>Experiment with the details. Refine the motion until it tells your story.</p></article><article className="about-card card-hover"><Code2 aria-hidden="true" /><h3>Build toward automation</h3><p>A future where prompts and developer workflows can help bring ideas to life.</p></article></div></Section>

        <Section id="why" number="03" label="Why we are building it"><div className="about-split"><h2 id="why-title">Strong products need<br /><span className="about-muted">strong visual stories.</span></h2><div className="about-copy"><p>Product launches. Landing pages. Social media. A demo that makes a feature click. Modern products need movement to explain what they do and why it matters.</p><p>Creating that movement should feel approachable. Vekto aims to reduce the complexity, first through a simpler interface and eventually through natural-language AI workflows.</p></div></div><ul className="about-usecases">{['Product launches', 'Landing pages', 'Marketing', 'Social media', 'Product demonstrations', 'Documentation', 'Developer tools', 'Startup launches'].map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></Section>

        <Section id="vision" number="04" label="Where Vekto is going" className="about-vision"><span className="about-roadmap"><Sparkles aria-hidden="true" />LONG-TERM VISION · NOT A RELEASED WORKFLOW</span><h2 id="vision-title">What if animation started<br />with <span className="gradient-text">a conversation?</span></h2><p className="about-lead">Describe an idea. See it take shape. Refine it in your own words.</p><div className="about-quote-prompt"><MessageSquare aria-hidden="true" /><blockquote>“Create a smooth product reveal animation where the dashboard fades in, the cards slide upward, and the main CTA appears at the end.”</blockquote></div><div className="about-workflows"><Workflow label="Traditional workflow" items={['Idea', 'Design', 'Timeline', 'Manual animation', 'Export']} /><Workflow label="The Vekto vision" items={['Prompt', 'AI', 'Animation', 'Refine', 'Export']} vision /></div><div className="about-copy"><p>The goal is for Vekto to understand the intent behind your prompt and help generate an animation. Then, instead of manually rebuilding each step, you could keep refining through conversation.</p></div><ul className="about-refinements">{['Make the animation slower.', 'Move the cards closer together.', 'Change the entrance animation.', 'Add a subtle spring effect.', 'Make the final transition smoother.'].map(text => <li key={text}><span>↳</span>“{text}”</li>)}</ul><p className="about-caption">This is our future direction. The complete prompt-to-animation workflow is not available today.</p></Section>

        <Section id="cli" number="05" label="Developer workflows"><div className="about-split"><div><span className="about-roadmap">FUTURE ROADMAP</span><h2 id="cli-title">Vekto CLI.<br /><span className="about-muted">Motion, in your workflow.</span></h2><div className="about-copy"><p>One future direction is a developer-focused CLI that brings AI-powered animation generation into development workflows.</p><p>Designed toward integration with models such as Claude and GPT, it could let developers and creators generate or modify animation projects programmatically through natural-language prompts.</p><p>The vision: connect AI reasoning with animation creation, with Vekto as the bridge between an idea and an animation.</p></div></div><div className="about-terminal"><div className="about-terminal-head"><Terminal aria-hidden="true" />VEKTO CLI<span>CONCEPT PREVIEW</span></div><div className="about-terminal-body"><p className="about-terminal-comment">// A future conversational workflow</p><p><span>you ›</span> Create a product launch animation for this dashboard.</p><p className="about-terminal-comment">// Claude or GPT interprets the intent</p><p><span>you ›</span> Make the hero animation more cinematic.</p><p><span>you ›</span> Add a 500ms delay before the cards appear.</p><p><span>you ›</span> Make the transition smoother.</p><p><span>you ›</span> Export this as a reusable animation.</p><p className="about-terminal-comment">// Roadmap concept. No released CLI commands.</p></div></div></div><Workflow label="The proposed CLI pipeline" items={['Natural language', 'AI model', 'Animation logic', 'Vekto', 'Generated animation']} vision /></Section>

        <Section id="ai" number="06" label="AI-native animation"><div className="about-split"><h2 id="ai-title">Understand the intent.<br /><span className="gradient-text">Keep the creator.</span></h2><div className="about-copy"><p>Our future vision is an intelligent layer that understands what you want an animation to do. Integrations with models such as Claude and GPT could translate that intent into structured instructions Vekto can execute.</p><p>That could make animation more accessible to people without advanced motion-design skills, while keeping the final creative decisions in their hands.</p><p className="about-caption">A potential future workflow, not a claim of currently released AI integrations.</p></div></div><ol className="about-ai-steps">{[['Describe', 'Tell Vekto what you want to animate.', MessageSquare], ['Interpret', 'Claude or GPT interprets your request.', Sparkles], ['Structure', 'AI turns intent into animation instructions.', Braces], ['Execute', 'Vekto executes those instructions.', Command], ['Preview', 'See the animation and decide what works.', Play], ['Refine', 'Ask for changes in natural language.', SlidersHorizontal], ['Update', 'Vekto updates the animation accordingly.', Layers]].map(([name, copy, Icon], index) => { const StepIcon = Icon as typeof Sparkles; return <li key={String(name)}><span className="about-step-index">0{index + 1}</span><StepIcon aria-hidden="true" /><h3>{String(name)}</h3><p>{String(copy)}</p></li>; })}</ol></Section>

        <Section id="beliefs" number="07" label="What we believe"><h2 id="beliefs-title">Less friction.<br /><span className="about-muted">More possibility.</span></h2><div className="about-beliefs">{[['Simplicity', 'Animation tools should be easier to understand and use.', MousePointer2], ['Speed', 'Move quickly from an idea to a visual result.', Zap], ['AI as a creative tool', 'Help people express and iterate on ideas while keeping creative control.', Sparkles], ['Developer-friendly', 'Make animation easier to integrate into modern development workflows.', Code2], ['Iteration', 'Build better through experimentation, feedback, and continuous improvement.', Heart]].map(([name, copy, Icon], index) => { const BeliefIcon = Icon as typeof Sparkles; return <article key={String(name)}><span className="about-step-index">0{index + 1}</span><BeliefIcon aria-hidden="true" /><h3>{String(name)}</h3><p>{String(copy)}</p></article>; })}</div></Section>

        <Section id="today" number="08" label="Our current stage"><div className="about-split"><div><span className="about-roadmap"><span className="about-live-dot" />ACTIVELY BEING BUILT</span><h2 id="today-title">Where we are today.</h2></div><div className="about-copy"><p>Vekto was founded in 2026. It is an early-stage, independently built product, not yet funded.</p><p>Today, the focus is building the core product experience, improving the animation workflow, experimenting with AI-assisted creation, and learning how creators and developers want to work with animation.</p><p>There is still a lot to build. Feedback and real use will help shape what comes next.</p></div></div></Section>

        <Section id="founder" number="09" label="Meet the founder"><div className="about-founder"><div className="about-founder-photo"><img src="/founder-abhay-solanki.jpg" alt="Abhay Solanki, founder of Vekto" width={1280} height={1280} loading="lazy" decoding="async" /></div><div><div className="about-eyebrow">THE PERSON BEHIND VEKTO</div><h2 id="founder-title">Abhay Solanki</h2><p className="about-founder-role">Founder, Vekto</p><div className="about-copy"><p>Abhay is an independent software builder and solo founder based in India. He is building Vekto directly, working across product development, engineering, product strategy, design direction, experimentation, and technical architecture.</p><p>He enjoys building software from the ground up, testing new ideas, and turning concepts into usable products. That hands-on approach lets Vekto move quickly, explore new workflows, and iterate based on feedback.</p></div><SocialLinks /><a className="about-founder-email" href={`mailto:${email}`}>{email}<ArrowUpRight aria-hidden="true" /></a></div></div></Section>

        <Section id="note" number="10" label="A note from the founder" className="about-note"><h2 id="note-title">Built from the ground up.</h2><blockquote><p>Vekto is being built from the ground up with a simple belief: creating great product visuals should not require a complicated workflow.</p><p>I’m building Vekto as a solo founder, working across engineering, product, design, and experimentation.</p><p>The long-term goal is to combine the flexibility of modern animation tooling with the intelligence of AI, so that creating and refining animations can become as simple as describing what you want.</p><p>There is still a lot to build, but that is what makes the process exciting.</p></blockquote><p className="about-signature">Abhay Solanki<span>Founder, Vekto</span></p></Section>

        <Section id="contact" number="11" label="Let's talk"><div className="about-split"><h2 id="contact-title">Have a question<br />or want to <span className="gradient-text">get in touch?</span></h2><div><p className="about-lead">For product questions, feedback, partnerships, or business inquiries, reach out directly.</p><a className="about-contact-email" href={`mailto:${email}`}>{email}<ArrowUpRight aria-hidden="true" /></a><SocialLinks /></div></div></Section>
      </div>
    </main>
    {footer}
  </div></MotionConfig>;
}
