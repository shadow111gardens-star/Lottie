# Kinetic editor

The existing landing and legal pages remain at `/`, `/privacy`, and `/terms`. Open the editor at `/editor/1`, or use `/dashboard` to create or reopen a project.

## Run and verify

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Editing

- Drag Rectangle, Ellipse, or Line on the canvas to draw. Hold Shift for a square/circle or angle snapping. Click with Text to insert editable text. With Pen, click to place nodes or drag to create curved segments; Enter/double-click finishes, clicking the first node closes the path, and Escape cancels.
- Select a layer, drag it to move, and drag any edge/corner handle to resize, or drag the circular handle to rotate around its center. Shift snaps rotation to 15 degrees. The inspector edits position, dimensions, independent X/Y scale (percent), rotation, opacity, fill, stroke, text, and SVG path data.
- The Layers panel supports double-click renaming, visibility, locking, drag ordering (or the arrow buttons), duplication, and deletion.
- Add a property keyframe with a diamond in the inspector or timeline. Scrub to another time and edit its value. Editing an already animated property creates or updates a keyframe at the playhead; Auto key also enables this for unanimated properties.
- Double-click a timeline track to add a keyframe. Drag a diamond to retime it; select one to edit its value/easing or delete it. Timing snaps to the project FPS (60 fps for existing projects). Dragging onto another keyframe replaces that keyframe and is undoable.
- Drag the time ruler to scrub; use Play, Loop, and Go to start. Drag the timeline's top edge to resize the panel.
- Use the Hand tool or scroll to pan, Ctrl+scroll or the zoom buttons to zoom, and Fit canvas to reset the view.
- Changes save locally per project. Export an editable Kinetic JSON file for backup or transfer. SVG snapshot exports the current frame; Animated SVG exports looping motion sampled at the project FPS using SVG animation elements.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Select / Move / Hand | V / M / H |
| Rectangle / Ellipse | R / O |
| Line / Text / Pen | L / T / P |
| Play / pause | Space |
| Move selection | Arrow keys (Shift for 10 units) |
| Undo / redo | Ctrl or Cmd + Z / Shift + Z |
| Duplicate | Ctrl or Cmd + D |
| Delete layer or selected keyframe | Delete / Backspace |
| Clear selection / exit preview | Escape |

## Architecture

- `src/App.tsx`: existing pages and editor routes.
- `src/Dashboard.tsx`: project entry points and local project discovery.
- `src/Editor.tsx`: scene state, undo/redo, persistence, inspector, layers, toolbar, and timeline.
- `src/editor/model.ts`: typed scene/layer/keyframe data and interpolation.
- `src/editor/Canvas.tsx`: SVG rendering, pointer gestures, drawing tools, pen curves, selection, resize/rotate, zoom/pan.
- `src/editor/geometry.ts`: shared drawing and transform calculations.
- `src/editor/io.ts`: project validation and static/animated SVG serialization.
- `src/editor/importSvg.ts`: data-only basic SVG import.
- `src/editor/lottie.ts`: validated Lottie import, editable conversion, SVG path normalization, and Lottie serialization.
- `src/editor/editor.css`: scoped full-screen workspace styling.

SVG import supports paths, rectangles, circles, ellipses, text, polygons, polylines, and lines. It does not preserve transforms, gradients, clipping masks, CSS styles, or SVG animation. Vector paths can be edited through path data; there is no Bezier node-handle editor. Projects are stored on this browser/device, without cloud sync. Animation can be exported as SVG or Lottie JSON; video export is not included.

Automated checks cover interpolation, transform geometry, legacy-project migration, scene round trips, validation, SVG exports, and React rendering. `tests/interactions.mjs` mounts the actual editor in Happy DOM and dispatches pointer, input, keyboard, and playback events to exercise every major tool and panel. SVG layout bounds and the animation clock are controlled by the harness. Browser visual and pointer-driven checks could not be run in the implementation environment because no browser automation surface was available.


## Lottie JSON

Import through **Import > Import Lottie JSON**. The importer retains a hierarchy of layer, group, geometry, paint, modifier, mask and precomposition records. The existing Layers panel lists these records with their hierarchy in their names. Nothing is silently discarded. Unsupported types and properties get **Unsupported** records, source paths and console diagnostics. Unsupported visual nodes render as explicit placeholders.

The canvas rebuilds Lottie data from these internal records and editor changes, then renders it with the `lottie-web` SVG light engine. Original z-order, style scope, group transforms, Bezier easing, spatial motion, masks, alpha/luminance mattes, gradients, trim paths, repeaters, dashed strokes, text, glyph data, solids, null parents, precompositions, time remapping, visibility, in/out points and source FPS are retained. Legacy color ranges, path closure, composition time-stretch defaults and text defaults are normalized before rendering. Text uses the source font or embedded glyphs; installed/web font availability still affects native text.

Position, scale, rotation, opacity and color tracks use the existing inspector and timeline. Unchanged source properties keep their original curves; edits are written back into the retained hierarchy. Precomposition instances have independent records. Duplicate/delete, undo/redo and local project serialization preserve the retained structure.

Embedded images and absolute HTTP(S) asset URLs resolve directly. Programmatic imports can supply `baseUrl` or an `assets` mapping for relative references. A standalone uploaded JSON cannot supply missing sibling image files: unresolved references remain visible as Unsupported image layers with their exact asset paths. Runtime image-load failures also identify the affected layer. The renderer loads referenced assets only.

The SVG light engine does not execute expressions or effects. These properties remain in the project/export and have explicit Unsupported records; authored keyframes and other supported content continue rendering. Unknown shapes (including unsupported merge-path operations), audio/camera layers, unknown properties and unsupported mask modes are diagnosed. 3D data is retained with an explicit warning about the SVG renderer's 2D projection. This is not a claim of universal Lottie feature support.

Console messages:

- `[Lottie parse]`: node ID, source path, layer type/name, shape type and support status.
- `[Lottie unsupported]`: exact unsupported type/property and reason.
- `[Lottie pipeline]`: parsed-node count, renderer-object count and any missing mapping.
- `[Lottie renderer]`: runtime failures with the affected node and source property.

Lottie export reconstructs real layers, shapes and assets from the current model. Both SVG exports use the same renderer for imported content, preserving gradients/masks. Retained-content Animated SVG exports frame snapshots, with a 3,600-frame limit; use Lottie JSON for longer animations. Native editor SVG exports remain unchanged. Import limits are 25 MB, 10,000 retained nodes, two million editable keyframes, dimensions up to 8192, 240 fps, 600 seconds and 36,000 source frames.

`tests/lottie.mjs` checks exact source-to-model-to-renderer geometry at multiple frames, gradients, masks/mattes, trim paths, text, assets, unsupported placeholders, transforms, timing and exports. The real upstream Bodymovin fixture contains multiple layers, nested groups, paints and animation; the test audits all 2,029 retained records against actual renderer objects. Fixture provenance and license are in `tests/fixtures/README.md`. The UI interaction suite also checks upload, editing, playback, download, error recovery and both SVG exports.

Implementation: `lottieDocument.ts` retains and rebuilds the hierarchy; `lottieProperty.ts` evaluates inspector tracks; `lottieRenderer.ts` renders and audits coverage; `LottieCanvas.tsx` synchronizes the existing canvas with the editor playhead. No new editor layout or panels were introduced.

## Video and GIF source frames

Use **Import ? Import video or GIF (up to 10s)**. Import creates a media scene, matching the existing Lottie/project import flow. Every decoded source frame has an independent ID, one-based frame number, original integer PTS, rational time base, display duration, and full-resolution composited PNG. Thumbnails in the existing timeline use those same images. Click any thumbnail to inspect its exact image, including frames with identical timestamps or zero duration. No timestamps are invented to make them unique. Playback follows source presentation timing; the display refresh rate can limit what a monitor physically shows, but extraction and frame selection never sample or remove frames.

Video uses the locally served, single-thread FFmpeg WASM decoder and FFprobe. `-vsync 0` disables duplication/drop synchronization; there is no FPS filter, target frame rate, seeking loop, or frame limit. B-frames remain in presentation order. Presentation deltas determine VFR display intervals, while packet durations remain separately recorded. The final frame requires an encoded duration or exact stream end. Probe/decode counts must agree. GIF imports preserve original hundredth-second delays (including zero), transparency, local palettes, interlacing, partial-image compositing and disposal methods 0–3. Loop repetitions do not create extra source frames.

Imports longer than ten seconds are rejected, never truncated. Missing/ambiguous timing, multiple video streams, unsupported GIF visual instructions, decode errors and mismatched counts reject the entire import. Audio is not imported. Browser memory limits currently allow files up to 128 MB and 128 million decoded pixels, with dimensions up to 8192; exceeding a limit rejects the complete import instead of sampling it. Full-resolution frames are embedded in project JSON; large projects may exceed localStorage quota, in which case the existing save status requests a project export.

`vectorizationFrames()` in `src/editor/media.ts` provides every full-resolution PNG and its timing/identity as independent vectorization inputs. This prepares raster inputs; it does not claim that raster pixels are already vector paths. Static/animated SVG can embed these images, and Lottie export uses embedded image assets with source in/out times.

`npm run dev` and `npm run build` prepare local FFmpeg assets. Deploy the entire `dist` directory, including `ffmpeg/`, not just `index.html`; media decoding requires HTTP(S). FFmpeg core licensing and source references are in `public/ffmpeg/NOTICE.txt`. No upload service or runtime CDN is used.

`tests/media.mjs` runs the actual WASM decoder against generated VFR H.264 with B-frames and repeated images, and tests GIF disposal, timing, limits, serialization and exports. `tests/media-ui.mjs` checks the actual upload handler, all thumbnails, exact-frame canvas selection, playback and atomic rejection.
