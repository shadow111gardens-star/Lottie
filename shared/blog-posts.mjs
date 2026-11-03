export const blogPosts = [
  {
    slug:'what-is-motion-design',
    title:'What Is Motion Design? A Practical Guide for Product Teams',
    description:'Learn what motion design is, how it helps explain digital products, and how to use animation with purpose in interfaces and product stories.',
    category:'Motion design', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/motion-design.svg',
    coverAlt:'Abstract purple motion-design shapes connected by a flowing animated path',
    intro:'Motion design is the use of movement, timing, and visual change to communicate an idea. In a digital product, it can show what changed, where to look, and how one action leads to another. Good motion makes a screen easier to understand; it does not ask the user to admire an effect before they can use the product.',
    sections:[
      {heading:'Motion is visual communication',paragraphs:['A transition can explain that a card expanded into a detail view. A short progress animation can show that an export is still working. A product demo can reveal a feature in the same order a person would discover it. In each case, movement carries information that a static image would need extra labels or screenshots to explain.','This is why motion design sits between graphic design, interaction design, and storytelling. It includes decorative movement, but its strongest work helps people understand hierarchy, cause and effect, and spatial relationships.'],points:['Guide attention toward the next useful detail.','Show continuity when an interface changes state.','Give a product story a clear beginning, action, and result.']},
      {heading:'Where product teams use it',paragraphs:['Product teams use motion in onboarding, buttons, loading states, charts, feature demos, launch pages, and exported brand assets. A small interaction can clarify that a control was accepted; a longer product animation can show a workflow that would otherwise take several screens to describe.','The right format depends on where the animation will appear. CSS works well for interface states, SVG suits crisp vector artwork, and Lottie can package layered motion for compatible apps. A video may be a better fit for detailed footage or complex compositing.'],points:[]},
      {heading:'Start with the message',paragraphs:['Before choosing an effect, write down what the viewer should notice or understand. Then decide what moves, when it moves, and when it should stop. Use a simple storyboard or keyframe sketch before polishing curves. This keeps the animation focused on the idea instead of turning into a list of effects.','For an approachable first project, import a logo or illustration, organize its layers, set a few keyframes, and preview the result at the size where people will actually see it. Vekto is built around that browser-based SVG and product-animation workflow.'],points:[]},
    ],
    related:['product-animation-for-saas','keyframes-easing-timing']
  },
  {
    slug:'product-animation-for-saas',
    title:'Product Animation for SaaS: Show the Feature, Not Just the Screen',
    description:'A practical framework for turning a SaaS workflow into a clear product animation for landing pages, launches, and customer education.',
    category:'Product storytelling', readTime:7, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/saas-product-animation.svg',
    coverAlt:'Layered product interface panels linked by a curved purple motion path',
    intro:'A product animation can make an abstract SaaS feature feel concrete. Instead of showing a crowded dashboard and hoping viewers understand it, focus on one task, the decision that makes it useful, and the result the customer cares about.',
    sections:[
      {heading:'Choose one promise',paragraphs:['Start with a single sentence: “After this animation, the viewer will understand that the product can ___.” If the sentence contains several unrelated features, split it into multiple stories. A focused animation is easier to follow, easier to keep current, and easier to reuse across a launch page and a sales deck.','Pick a realistic starting state and a believable outcome. If a workflow normally takes three steps, show those steps in order. Avoid inventing buttons, metrics, or product behavior just to make the scene look more impressive.'],points:['Name the audience and their job.','Show the friction or starting point briefly.','Make the useful result unmistakable.']},
      {heading:'Storyboard the sequence',paragraphs:['Sketch the sequence as a handful of frames: context, action, response, outcome. Each frame should answer one question. Use zooms and pans only when they help the viewer inspect a detail; repeated camera movement can make a simple workflow feel harder than it is.','Use short labels to explain what a cursor or interface change means. Keep text large enough for a mobile viewer, and leave pauses around important values so they can be read.'],points:[]},
      {heading:'Design for reuse',paragraphs:['Keep interface pieces, callouts, and backgrounds on separate layers. That makes it easier to change a label or replace one screen without rebuilding the whole animation. Save an editable source project alongside the exported asset, and keep the source screenshots free of personal or customer data.','For a landing page, export a format that fits the implementation and provide a static fallback. Vekto can help create editable SVG motion and Lottie exports from browser-based projects; use the format your team can reliably support.'],points:[]},
    ],
    related:['motion-design-landing-pages','storyboard-product-demo']
  },
  {
    slug:'svg-vs-lottie-vs-gif',
    title:'SVG vs Lottie vs GIF: Which Animation Format Should You Use?',
    description:'Compare animated SVG, Lottie JSON, and GIF by editability, browser support, file behavior, and the job each format is good at.',
    category:'Formats & export', readTime:7, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/svg-lottie-gif.svg',
    coverAlt:'Three distinct file cards for SVG, Lottie, and GIF arranged along a motion line',
    intro:'SVG, Lottie, and GIF can all show animation on a web page, but they are not interchangeable. SVG is a vector document, Lottie is a JSON animation format interpreted by a player, and GIF is a raster image sequence. The right choice depends on what you need to edit and where the animation will run.',
    sections:[
      {heading:'Animated SVG for vector artwork',paragraphs:['SVG stores shapes and paths as XML. That makes logos, icons, and simple illustrations crisp at different sizes. SVG can animate with SMIL or CSS and can be inspected or edited as markup. It is often a good fit for a small self-contained web animation, but SVG features and embedded animation should still be checked in the target browsers and tools.','Use animated SVG when you want scalable vector art and your delivery environment supports the animation features you need. If the file includes many complex filters or external references, test performance and portability before shipping.'],points:[]},
      {heading:'Lottie for app and web players',paragraphs:['Lottie packages animation data as JSON that a compatible player renders. It can preserve vector-like layers and keyframes across platforms, which is useful when a product team already has Lottie tooling. It also introduces a runtime dependency and a supported-feature boundary: not every After Effects or editor feature translates to every player.','Test the export with the exact Lottie player and version used by the product. Check loops, easing, image assets, and reduced-motion behavior.'],points:[]},
      {heading:'GIF for broad, simple playback',paragraphs:['GIF is a sequence of raster frames. It is widely previewable and simple to embed, but it does not preserve editable vector layers, has a limited palette, and can become large when the animation is detailed or long. For photographic motion, modern video formats are usually more suitable than GIF.','A quick decision: choose SVG for suitable vector artwork, Lottie for a compatible player workflow, and GIF only when its easy playback outweighs its raster and file-size limits. Keep an editable source no matter which file you deliver.'],points:[]},
    ],
    related:['animate-svg-logo','lottie-export-web']
  },
  {
    slug:'png-to-svg-vectorize-artwork',
    title:'PNG to SVG: When to Vectorize Artwork—and When to Keep It Raster',
    description:'Understand what PNG-to-SVG conversion does, how tracing affects color and detail, and how to choose the right source for editable motion.',
    category:'SVG & vectorization', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/png-to-svg.svg',
    coverAlt:'A pixel image transforming into smooth editable vector paths',
    intro:'Converting a PNG to SVG can make flat artwork easier to scale, recolor, and edit. The conversion traces pixels into paths; it does not recover the original designer’s layers or magically turn a photograph into perfect vector shapes. Knowing that distinction helps you choose the right source and settings.',
    sections:[
      {heading:'What tracing changes',paragraphs:['A vectorizer groups nearby pixels into colored regions and approximates their edges with paths. A simple icon with a few flat colors may become a compact, clean SVG. A textured illustration or photograph can produce thousands of small shapes, a much larger file, and details that look different from the original.','Transparent edges, gradients, shadows, and subtle texture are particularly difficult to represent as clean editable paths. The best result is often a compromise between path count, visual similarity, and how much editing you need afterward.'],points:['Use a high-resolution source with clean edges.','Reduce noise and unnecessary colors before tracing.','Inspect small details and transparency after conversion.']},
      {heading:'When SVG is the right target',paragraphs:['Logos, symbols, flat illustrations, and UI icons are strong candidates because they have clear shapes and limited color palettes. Once traced, you can adjust fills, move paths, and scale the artwork without pixelation. Keep a copy of the original PNG so you can compare and retrace if needed.','If the main goal is to animate a detailed image, a raster base with a few editable overlays can be a better workflow than tracing every pixel into a path. This keeps the design responsive without making the document unwieldy.'],points:[]},
      {heading:'A careful conversion workflow',paragraphs:['Crop to the artwork, remove a background only when you have permission and a reliable source, then trace at a size appropriate for the final use. Review the exported SVG in a browser and in the application where you plan to edit it. Check colors, path complexity, alpha, and the file size.','Vekto’s PNG to SVG workflow is designed for browser-based tracing and further editing. Treat the traced file as a new editable interpretation, not a perfect recovery of the original source layers.'],points:[]},
    ],
    related:['svg-vs-lottie-vs-gif','animate-svg-logo']
  },
  {
    slug:'animate-svg-logo',
    title:'How to Animate an SVG Logo Without Losing Its Identity',
    description:'Plan a logo animation around the brand mark: prepare clean SVG paths, choose restrained movement, and export a version that stays useful.',
    category:'Logo animation', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/logo-animation.svg',
    coverAlt:'A geometric purple logo mark with curved paths showing a restrained reveal',
    intro:'A good logo animation reveals the brand instead of competing with it. A short draw-on, a subtle stagger, or a deliberate transition can make a mark feel considered. The movement should leave the logo recognizable at every important point and settle into a clear final frame.',
    sections:[
      {heading:'Prepare the source artwork',paragraphs:['Start with the original vector file whenever possible. Group related paths, give important pieces clear names, and remove hidden duplicates. If the only source is a PNG, trace it and inspect the result; a very detailed image may be better kept as a raster base with only selected vector elements animated.','Use a square or composition-sized canvas with enough breathing room around the mark. Keep the artwork centered and preserve its exact colors, proportions, and spacing before you add motion.'],points:[]},
      {heading:'Pick one motion idea',paragraphs:['Choose a motion metaphor that fits the identity: a line drawing itself, pieces assembling, a soft scale settle, or a simple reveal. Avoid stacking rotation, bounce, blur, and color changes at once. Each additional effect should make the mark easier to read or reinforce a recognizable brand quality.','Set a clear endpoint. A logo that keeps moving forever may distract in a header or product interface; a loop may make sense in a loading state or a social post. Consider both use cases rather than exporting one animation for every placement.'],points:['Keep the mark recognizable during movement.','Use easing to soften starts and stops.','Check the result at its smallest display size.']},
      {heading:'Export and review',paragraphs:['Preview the animation against light and dark backgrounds and on a transparent canvas. Verify the final frame, loop seam, file size, and target-player behavior. Keep the editable source project so the timing can be adjusted later without re-tracing the artwork.','Vekto supports editable SVG scenes and exports animated SVG or Lottie JSON. Check each export in the destination where it will be used, since player support can differ.'],points:[]},
    ],
    related:['keyframes-easing-timing','svg-vs-lottie-vs-gif']
  },
  {
    slug:'keyframes-easing-timing',
    title:'Keyframes, Easing, and Timing: The Building Blocks of Motion',
    description:'A beginner-friendly guide to setting animation keyframes, shaping easing curves, and timing movement so it feels clear and intentional.',
    category:'Animation fundamentals', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/keyframes-easing.svg',
    coverAlt:'A motion curve passing through several keyframe points on a timeline',
    intro:'Keyframes define values at selected moments. Easing controls how an object moves between those values, and timing determines how long the change takes. Together, they turn a static illustration into a sequence that can feel calm, energetic, direct, or playful.',
    sections:[
      {heading:'Start and end with intent',paragraphs:['For a simple move, place a starting keyframe and an ending keyframe. The difference between their positions, scale, opacity, or color tells the editor what should change. Add a middle keyframe only when the motion needs an overshoot, pause, or direction change.','Set keyframes around the story beats: when the viewer should first notice movement, when the key detail appears, and when the animation should settle. More keyframes are not automatically more control; they can make revisions harder.'],points:[]},
      {heading:'Use easing to shape the feel',paragraphs:['Linear interpolation travels at a constant rate. Ease-in starts gently, ease-out settles gently, and ease-in-out eases both ends. A spring or overshoot can add character, but it can also make a professional UI feel unstable if used everywhere.','Use consistent easing for actions that belong together. Let a primary object lead and supporting details follow slightly later. Keep stagger small enough that the viewer sees a coordinated event rather than a queue of unrelated objects.'],points:['Ease-out works well for an element arriving.','Ease-in can make an element leaving feel deliberate.','Use a pause to give important text time to be read.']},
      {heading:'Time the animation for its purpose',paragraphs:['A button response should usually feel immediate. A feature overview can take longer because the viewer needs time to understand each step. Test the animation at its final display size and on a real device; a timeline that feels short on a desktop monitor may feel rushed on a phone.','Preview one change at a time. Adjust duration first, then easing, then stagger. This keeps cause and effect visible and makes it easier to reproduce a result across several assets.'],points:[]},
    ],
    related:['what-is-motion-design','animate-svg-logo']
  },
  {
    slug:'microinteractions-interface-motion',
    title:'Microinteractions: Small Motion That Makes Interfaces Easier to Read',
    description:'Use small interface animations to confirm actions, explain state changes, and reduce uncertainty without adding distracting motion.',
    category:'Interaction design', readTime:5, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/microinteractions.svg',
    coverAlt:'A small interface control with a check mark and subtle motion rings',
    intro:'Microinteractions are small responses to a user action: a toggle changes state, a save control confirms success, or a field explains what needs attention. Their job is to make the interface’s response visible and understandable, not to turn every click into a performance.',
    sections:[
      {heading:'A clear interaction has four parts',paragraphs:['A useful microinteraction has a trigger, a visible response, feedback about the result, and rules for what happens next. For example, after a user saves a change, a button can briefly confirm the save and then return to its normal state. If the save fails, the feedback should say what happened and offer a way to recover.','The visual change should match the action. A toggle should move into a selected state; a progress indicator should show that work is still underway. Movement that does not reflect system state can make people less confident, not more.'],points:[]},
      {heading:'Keep feedback quick and consistent',paragraphs:['Use a short duration for small controls and keep repeated patterns consistent across the product. Avoid making a user wait for an animation to finish before they can continue unless the system is genuinely processing something.','Motion should not be the only signal. Pair it with text, color, shape, or a programmatic state so the interface remains understandable for people who cannot see or prefer not to see the animation.'],points:['Confirm success and failure distinctly.','Avoid loops for one-time actions.','Respect reduced-motion preferences.']},
      {heading:'Review the whole product',paragraphs:['A motion detail may feel pleasant once and noisy after hundreds of repetitions. Review the pattern in its real context, including keyboard focus, screen readers, error states, and repeated interactions. A consistent, quiet response often does more for usability than a complex transition.','Create a small motion system: durations, easing choices, and feedback patterns that teams can reuse. This keeps each new interaction from inventing its own rules.'],points:[]},
    ],
    related:['keyframes-easing-timing','accessible-animation-reduced-motion']
  },
  {
    slug:'motion-design-landing-pages',
    title:'Motion Design for Landing Pages: Explain More Without Slowing the Page',
    description:'Plan landing-page animation that helps people understand a product while protecting readability, accessibility, and page performance.',
    category:'Product storytelling', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/landing-page-motion.svg',
    coverAlt:'A landing-page layout with a product illustration and a measured sequence of animated callouts',
    intro:'Landing-page motion can make a product workflow easier to understand and give a launch page a clear visual rhythm. It can also slow the page, obscure content, or distract from the next step. A good animation earns its place by explaining something the page needs to communicate.',
    sections:[
      {heading:'Make the first screen understandable on its own',paragraphs:['People should be able to understand the product and the page’s main action even if the animation has not played. Put the value proposition in text, keep the key visual focused, and let motion add context instead of hiding information behind a long sequence.','Use a few meaningful beats rather than constant movement. A quick reveal can point to a feature; a paused state can let the visitor inspect it. Avoid auto-playing complex motion before the reader can orient themselves.'],points:[]},
      {heading:'Protect performance and accessibility',paragraphs:['Prefer lightweight vector animation for suitable artwork and avoid shipping a large video when a small SVG can tell the same story. Lazy-load below-the-fold media, set dimensions to reduce layout shifts, and test on a slower network and a modest phone.','Provide a static representation and respect reduced-motion settings. Avoid rapid flashing, large unexpected movement, and parallax that makes scrolling uncomfortable. Make sure text remains readable against every frame.'],points:['Keep the CTA visible and usable.','Check the page without animation.','Measure load and interaction performance after adding media.']},
      {heading:'Tie the motion to a user question',paragraphs:['Before designing, write the question the section should answer: “How does the feature work?” or “What changes after I click?” Use the animation to answer that question in sequence. This gives the story a practical purpose and makes it easier to remove scenes that do not help.','Vekto can help prepare editable SVG and Lottie product visuals for web use. Match the export to your implementation, then test the final page rather than relying only on the animation preview.'],points:[]},
    ],
    related:['product-animation-for-saas','accessible-animation-reduced-motion']
  },
  {
    slug:'lottie-export-web',
    title:'Preparing a Lottie Export for the Web: A Practical Checklist',
    description:'Review layers, assets, loops, player compatibility, and fallback behavior before shipping a Lottie animation on a website.',
    category:'Formats & export', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/lottie-export.svg',
    coverAlt:'A Lottie JSON file connected to a responsive browser preview',
    intro:'A Lottie export is only ready when it works in the player and page where it will appear. Layer structure, unsupported effects, external image assets, loop behavior, and player versions can all affect the result. A careful handoff catches these issues before a launch.',
    sections:[
      {heading:'Simplify the source before export',paragraphs:['Remove hidden layers and unused assets. Name layers so another person can recognize them, group related artwork, and keep the composition near its intended display size. If the animation contains embedded raster images, confirm those assets travel with the JSON or are packaged at the expected paths.','Avoid assuming that every editor effect maps to every Lottie renderer. Check masks, text, gradients, expressions, and blend modes against the target player. If an effect is unsupported, replace it with a simpler construction or export an alternate format.'],points:[]},
      {heading:'Test the player and the loop',paragraphs:['Load the exact JSON in the same player version and framework used by the product. Confirm the first frame, final frame, timing, easing, responsiveness, and whether the animation loops or plays once. If the file is interactive, test its trigger and pause behavior too.','Review the animation at multiple sizes and device pixel ratios. Check that thin strokes remain visible and text is still legible. Look for layout shifts or oversized intrinsic dimensions that cause the player to claim more space than expected.'],points:['Keep the JSON and image assets together.','Test on the actual target device.','Provide a static fallback for unsupported contexts.']},
      {heading:'Ship accessible defaults',paragraphs:['Do not force motion on every visitor. Respect reduced-motion preferences, provide a pause control for prolonged decorative movement, and ensure the meaningful information is available without the animation. Keep the file focused on one job so it is easy to review and replace later.','Vekto exports Lottie JSON from editable scenes. The export still needs a player-level review because the runtime determines how a given feature is rendered.'],points:[]},
    ],
    related:['svg-vs-lottie-vs-gif','png-to-svg-vectorize-artwork']
  },
  {
    slug:'accessible-animation-reduced-motion',
    title:'Accessible Animation: Reduced Motion, Readability, and User Control',
    description:'A practical checklist for making web animation more comfortable, including reduced-motion support, pacing, contrast, and pause behavior.',
    category:'Accessibility', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/accessible-motion.svg',
    coverAlt:'An accessible motion interface showing a reduced-motion setting and a calm static state',
    intro:'Motion can help explain a change, but some people prefer less of it, and some movement can cause discomfort. Accessible animation offers a clear static path, avoids unnecessary movement, and gives people control over motion that runs for a long time.',
    sections:[
      {heading:'Respect reduced-motion preferences',paragraphs:['On the web, the prefers-reduced-motion media query lets a page detect when a visitor has requested less animation. Reduce or remove nonessential transitions and parallax in that mode. Keep functional feedback understandable: if an element moves to show a saved state, the saved state itself should remain visible.','Do not use reduced motion as a reason to hide information. Replace a moving explanation with a static illustration or a direct state change, and ensure the content remains in the document for assistive technology.'],points:[]},
      {heading:'Avoid common sources of discomfort',paragraphs:['Large zooms, continuous parallax, rapid flashes, and movement that follows scrolling can be uncomfortable or distracting. Keep decorative loops slow and subtle, avoid flashing content, and let users pause animations that continue for an extended period.','Check contrast and reading time across every frame. Moving text can be difficult to follow, so keep critical instructions static whenever possible. Do not make a user chase a control or message that moves away before they can act.'],points:['Make important information available in a static state.','Keep interactive controls keyboard accessible.','Use motion to clarify, not to punish missed timing.']},
      {heading:'Test with real settings',paragraphs:['Turn on reduced motion at the operating-system level and test the whole page, not just one component. Verify that motion-heavy exports have a fallback and that looping animations do not prevent people from reading nearby content. Ask people with different needs to review important product flows.','Accessibility is part of the motion system from the beginning. Choose sensible defaults, document the behavior, and make reduced movement easy to maintain as the product changes.'],points:[]},
    ],
    related:['microinteractions-interface-motion','motion-design-landing-pages']
  },
  {
    slug:'storyboard-product-demo',
    title:'How to Storyboard a Short Product Demo Animation',
    description:'Turn a product feature into a short storyboard with a clear setup, action, result, and readable on-screen pacing.',
    category:'Product storytelling', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/storyboard.svg',
    coverAlt:'A row of four storyboard frames showing context, action, response, and result',
    intro:'A storyboard is a quick sequence of frames that explains what an animation will show before you spend time polishing it. For a product demo, it helps keep the story focused on the user’s task and gives designers, founders, and developers a shared plan.',
    sections:[
      {heading:'Write the story in four beats',paragraphs:['Begin with context: what is the viewer looking at and what are they trying to do? Next show the action, then the product response, then the result. These beats can fit in a few seconds or expand into a longer walkthrough depending on the complexity of the feature.','Make one frame per meaningful state. Add a short note for movement, narration, or a callout. If two frames communicate the same thing, combine them. If one frame contains several unrelated actions, split it.'],points:['Context: introduce the screen or problem.','Action: show the meaningful input.','Response: reveal what the product changes.','Result: pause on the benefit.']},
      {heading:'Keep the viewer oriented',paragraphs:['Maintain a consistent camera and interface scale unless a change in view has a clear purpose. Use a highlight, cursor, or callout to direct attention to one detail at a time. Keep labels brief and make sure they remain on screen long enough to read.','Use a real, sanitized product state wherever possible. If you create a demo state, label it internally so nobody mistakes sample numbers or fake customer data for a real account.'],points:[]},
      {heading:'Turn frames into a motion plan',paragraphs:['Mark where each beat begins and ends. Decide whether the interface slides, fades, draws, or simply changes state. Choose timing that lets people understand the action; do not make every transition equally dramatic. A pause on the result is often more useful than an extra flourish.','Once the storyboard works as a sequence of stills, add keyframes and preview the full animation. Share the exported format with the team that will embed it, and keep the editable source beside the final file.'],points:[]},
    ],
    related:['product-animation-for-saas','keyframes-easing-timing']
  },
  {
    slug:'layered-vector-illustrations-motion',
    title:'Preparing a Layered Vector Illustration for Animation',
    description:'Organize vector shapes, pivots, naming, and movement before animating an illustration for a website or product demo.',
    category:'SVG & vectorization', readTime:6, publishedAt:'2026-11-03', updatedAt:'2026-11-03', cover:'/blog-covers/layered-vectors.svg',
    coverAlt:'A layered vector illustration separated into colorful shapes ready for animation',
    intro:'An illustration is easier to animate when its source is organized around the movement you want. A character whose arm should wave needs a separable arm; a product icon that should open needs an independent lid. Layer preparation is motion design work, not just file cleanup.',
    sections:[
      {heading:'Separate parts by movement',paragraphs:['Before splitting artwork, decide what should move independently. Group pieces that will always move together and separate pieces that need their own timing. Too few layers limit the motion; too many make the scene difficult to manage. Use the smallest useful structure.','Place pivots near the point of rotation, such as a shoulder for an arm or a hinge for a lid. Check that adjacent shapes overlap enough to avoid gaps when the part moves.'],points:[]},
      {heading:'Name and inspect the SVG',paragraphs:['Use descriptive layer names such as “front wheel” or “speech bubble” instead of “path 27.” Remove hidden duplicates and verify fills, strokes, clipping, and transparency. A quick static preview can expose missing shapes before you add keyframes.','If your only source is a PNG, tracing can produce editable paths, but complex artwork may create many shapes and change small details. Keep the original image and compare the trace. For a detailed illustration, a raster base with a few vector overlays may be more practical.'],points:['Group semantic parts.','Check overlaps at intended poses.','Keep a clean original source file.']},
      {heading:'Animate and export with restraint',paragraphs:['Set a neutral pose first, then animate one group at a time. Use keyframes for clear actions and small delays to give movement a natural sequence. Avoid shifting an entire character when the action is only a blink or a hand gesture.','Preview in the actual destination, export the format your player supports, and verify that the editable file remains available for later revisions.'],points:[]},
    ],
    related:['png-to-svg-vectorize-artwork','animate-svg-logo']
  },
];

export const blogPostBySlug = Object.fromEntries(blogPosts.map(post=>[post.slug,post]));
