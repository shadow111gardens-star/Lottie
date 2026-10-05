# Responsive audit

Checked the local website in headless Chrome at 320×740, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080, and 844×390 (landscape).

81 page and interaction states passed the viewport-width and usable-editor-canvas assertions. Scrolled through all ten landing-page sections at phone, tablet, and desktop sizes. Screenshots are in this directory and `sections/`; measurements are in `results.json`.

Coverage: landing page, tablet/mobile navigation, privacy, terms, dashboard grid/list views, project filters, PNG-to-SVG converter, My assets, editor workspace, properties/exports, timeline, and playback controls.

## Changes

- Editor: canvas above the panels on smaller screens, stacked panels on phones, wrapped toolbars, accessible workspace link, vertical scrolling on small/short screens, and canvas fitting when its container changes size.
- Landing page: tablet navigation uses the mobile menu with a sign-in button; the menu scrolls in landscape. Capabilities use a grid on tablet and a single column on phones. Desktop horizontal scrolling recalculates its travel distance on resize. Testimonial cards fit narrow phones.
- Dashboard: filters and toolbar wrap, imports remain accessible, project list details can shrink, and narrow phones use a single project column.
- Converter: actions stack on phones; headings, previews, and status text fit smaller widths.

## Validation

- Responsive browser audit and landing-section scroll audit: passed.
- TypeScript and production build: passed.
- Project actions, PNG-to-SVG UI, dashboard previews/interactions, editor model, Lottie model/rendering, React rendering, media decoding, and media UI checks: passed.
- The existing interaction suite passes its native editor checks but fails at `tests/interactions.mjs:585`: imported Lottie layer count is 7 instead of 3. Reproduced the same failure with the original `Canvas.tsx` restored temporarily, confirming it is unrelated to this change.

Authenticated layouts were checked with synthetic project data and mocked authentication/storage modules in the test browser. Live sign-in/cloud operations and physical-device Safari/Firefox behavior were not tested. No site was deployed.

## Repeat

With Playwright available, run `node scripts/check-responsive.mjs` and `node scripts/check-landing-sections.mjs` against Vite at `http://127.0.0.1:5173`. If Playwright is installed outside this repository, set `PLAYWRIGHT_MODULE` to its `index.mjs` file URL. Chrome must be installed.
