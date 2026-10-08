# Vekto About page

Implemented in `src/About.tsx` with scoped `src/about.css`. `src/SiteChrome.tsx` contains the existing navbar/footer extracted for reuse, retaining the homepage appearance and behavior. Home navigation gains an About link. The About navbar remains visible and its mobile menu supports Escape, focus containment and returning focus to the menu button. Contact in the About footer scrolls to the contact section.

The page follows the supplied story, product, vision, CLI, AI, principles, stage, founder, founder note and contact structure. It uses the existing Outfit typeface, white/slate palette, indigo/pink gradient, rounded cards/buttons and Framer Motion. Diagrams and the illustrative timeline are CSS/SVG, with no new animation or UI dependency. Animation is restrained and respects reduced motion. A founder monogram avoids inventing a photograph. AI integrations and CLI workflows are explicitly future roadmap concepts.

Metadata includes the supplied title/description, canonical URL, Open Graph, Twitter summary and AboutPage/Organization/founder JSON-LD. Metadata is removed or restored on leaving the React route. The build's new postbuild script produces `dist/about/index.html` with the complete page and reused navbar/footer for crawlers and previews. Browser sign-in services are excluded from prerendering, while the production client retains its existing authentication behavior. Existing homepage and legal documents are not prerendered or redesigned.

`vercel.json` serves `/about` and `/about/` from that static document. Existing API routes and other page rewrites are preserved. Express static serving supports the document; a scoped `vite.config.ts` preview middleware serves it for extensionless About URLs, which would otherwise return the homepage SPA HTML. No deployment was performed.

## Checks

- `npm run typecheck`: passed.
- `npm run build`: passed, including About prerendering.
- `npm run test:about`: passed; direct route rendering, server-rendered content, single H1, section heading associations, social link destinations/security labels, mailto links, section anchors, SEO metadata/cleanup, structured founder data, reduced-motion handling and Vercel refresh paths.
- Direct HTTP visits to `/about` and `/about/`: passed locally. Prerendered production HTML was checked for page content and metadata.
- Existing editor/model/Lottie/SSR render checks, dashboard checks and media/UI checks: passed.
- `npm test` still stops at the existing `tests/interactions.mjs:585` imported-Lottie fixture assertion: expected 3 layer rows, actual 7. This test imports the unchanged Editor directly and does not load the About page. Its behavior/assertion was not changed. The earlier SSR harness failure was fixed by supplying the missing event-listener methods on its test-only window mock.
- No lint script exists in this project.
- Browser surfaces were unavailable in this session; viewport screenshots and live browser accessibility/visual inspection were not completed. Responsive CSS provides desktop/tablet/mobile grids, wrapping diagrams/social links, fluid headings and reduced-motion styles, but those checks are not a substitute for visual browser QA.

Preview: `npm run dev`, then open `/about`. A production preview is available through `npm run build` and `npm run preview`.
