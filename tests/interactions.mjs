import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Window } from "happy-dom";
import { editorStorageMock } from './editor-storage-mock.mjs';
const win = new Window({
  url: "http://localhost:5173/editor/new-interactions",
  width: 1440,
  height: 900,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "SVGElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "DOMParser",
  "localStorage",
])
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? win : win[key],
    configurable: true,
    writable: true,
  });
win.HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: "",
  fillRect() {},
  measureText(t) {
    return { width: t.length * 10 };
  },
  getImageData() {
    return { data: new Uint8ClampedArray(4) };
  },
});
win.SVGElement.prototype.getComputedTextLength = function () {
  return (this.textContent || "").length * 10;
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let now = 0,
  frameId = 0;
const frames = new Map();
globalThis.requestAnimationFrame = win.requestAnimationFrame = (cb) => {
  frames.set(++frameId, cb);
  return frameId;
};
globalThis.cancelAnimationFrame = win.cancelAnimationFrame = (id) =>
  frames.delete(id);
Object.defineProperty(globalThis, "performance", {
  value: { now: () => now },
  configurable: true,
});
const captures = new Map();
win.Element.prototype.setPointerCapture = function (id) {
  captures.set(id, this);
};
win.Element.prototype.releasePointerCapture = function (id) {
  captures.delete(id);
};
win.Element.prototype.hasPointerCapture = function (id) {
  return captures.get(id) === this;
};
win.Element.prototype.getBoundingClientRect = function () {
  let x = 0,
    y = 0,
    width = 100,
    height = 30;
  if (this.classList.contains("ke-stage")) {
    x = 280;
    y = 80;
    width = 850;
    height = 460;
  } else if (this.getAttribute("aria-label") === "Animation canvas") {
    width = parseFloat(this.parentElement.style.width);
    height = parseFloat(this.parentElement.style.height);
    x = 280 + (850 - width) / 2;
    y = 80 + (440 - height) / 2;
  } else if (
    this.classList.contains("ke-ruler") ||
    this.classList.contains("ke-track")
  ) {
    x = 280;
    y = 600;
    width = 1000;
    height = 24;
  }
  return {
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON() {
      return this;
    },
  };
};
const blobs = [];
URL.createObjectURL = (blob) => {
  blobs.push(blob);
  return "blob:test";
};
URL.revokeObjectURL = () => {};
win.HTMLAnchorElement.prototype.click = function () {};
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const file = resolve("tests/.editor-interactions.mjs");
const bundle = await build({
  entryPoints: ["src/Editor.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  loader: { ".css": "empty" },
  plugins: [editorStorageMock],
  write: false,
});
await writeFile(file, bundle.outputFiles[0].text);
let root;
const errors = [];
const originalError = console.error;
const originalInfo = console.info;
const lottieLogs = [];
console.info = (...args) => lottieLogs.push(args);
console.error = (...args) => {
  errors.push(args.join(" "));
  originalError(...args);
};
try {
  const { Workspace: Editor } = await import(pathToFileURL(file));
  const initial = { version: 1, name: 'Untitled scene', width: 960, height: 540, duration: 6, background: '#ffffff', clip: true, layers: [], editorView: { time: 1.5, zoom: .55, selected: null, expanded: [], timelineHeight: 290 } };
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/editor/new-interactions"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/editor/:projectId",
              element: React.createElement(Editor, { projectId: 'new-interactions', initial }),
            }),
          ),
        ),
      ),
    ),
  );
  const all = (s) => [...document.querySelectorAll(s)];
  const label = (s) => {
    const el = all("[aria-label]").find(
      (x) => x.getAttribute("aria-label") === s,
    );
    assert.ok(el, `Missing control ${s}`);
    return el;
  };
  const click = async (el) =>
    act(async () =>
      el.dispatchEvent(
        new win.MouseEvent("click", { bubbles: true, button: 0 }),
      ),
    );
  const button = async (name) =>
    click(
      all("button").find(
        (el) =>
          el.getAttribute("aria-label") === name ||
          el.textContent.trim() === name,
      ) || label(name),
    );
  const canvas = () => label("Animation canvas");
  const layers = () =>
    all('svg[aria-label="Animation canvas"] > g[data-layer]');
  const input = async (name, value) => {
    const el = label(name);
    await act(async () => {
      const proto =
        el.tagName === "TEXTAREA"
          ? win.HTMLTextAreaElement.prototype
          : win.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(
        el,
        String(value),
      );
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
    });
  };
  const key = async (k, code = k) =>
    act(async () =>
      document.body.dispatchEvent(
        new win.KeyboardEvent("keydown", { key: k, code, bubbles: true }),
      ),
    );
  const pointer = async (target, type, x, y, extras = {}) =>
    act(async () =>
      target.dispatchEvent(
        new win.PointerEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          pointerId: 1,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          ...extras,
        }),
      ),
    );
  const pos = (x, y) => {
    const r = canvas().getBoundingClientRect();
    const z = r.width / 960;
    return [r.left + x * z, r.top + y * z];
  };
  const drag = async (target, from, to, extras = {}) => {
    await pointer(target, "pointerdown", ...pos(...from), extras);
    await pointer(
      document.querySelector(".ke-stage"),
      "pointermove",
      ...pos(...to),
      extras,
    );
    await pointer(
      document.querySelector(".ke-stage"),
      "pointerup",
      ...pos(...to),
      extras,
    );
  };
  const draw = async (tool, from, to) => {
    await button(tool);
    await drag(canvas(), from, to);
  };
  const number = (name) => Number(label(name).value);
  const check = (name) => console.log("PASS " + name);
  assert.equal(layers().length, 0);
  await draw("Rectangle (R)", [100, 100], [300, 220]);
  assert.equal(layers().length, 1);
  assert.ok(
    Math.abs(
      Number(layers()[0].querySelector("rect").getAttribute("width")) - 200,
    ) < 0.001,
  );
  assert.equal(number("height"), 120);
  assert.ok(document.querySelector(".ke-track-row"));
  check(
    "Rectangle drag creates editable SVG, layer, inspector and real tracks",
  );
  await button("Move (M)");
  await drag(layers()[0], [150, 150], [190, 170]);
  assert.equal(number("x"), 140);
  assert.equal(number("y"), 120);
  await button("Undo (Ctrl+Z)");
  assert.equal(number("x"), 100);
  await button("Redo (Ctrl+Shift+Z)");
  assert.equal(number("x"), 140);
  await button("Select (V)");
  await click(document.querySelector(".ke-layer-name"));
  assert.equal(label("Redo (Ctrl+Shift+Z)").disabled, true);
  await drag(label("Resize se"), [340, 240], [390, 270]);
  assert.equal(number("width"), 250);
  assert.equal(number("height"), 150);
  const rot = label("Rotate object");
  const start = [
    Number(rot.getAttribute("cx")),
    Number(rot.getAttribute("cy")),
  ];
  const cx = number("x") + number("width") / 2,
    cy = number("y") + number("height") / 2;
  await drag(rot, start, [cx + (cy - start[1]), cy]);
  assert.ok(Math.abs(number("rotation") - 90) < 0.01);
  check("Select/Move, drag, resize, rotate and gesture Undo/Redo");
  await input("rotation", 0);
  await input("scaleX", 150);
  assert.ok(layers()[0].getAttribute("transform").includes("scale(1.5 1)"));
  await input("Fill color", "#ff0000");
  assert.equal(
    layers()[0].querySelector("rect").getAttribute("fill"),
    "#ff0000",
  );
  await input("Layer name", "Red box");
  assert.ok(
    document.querySelector(".ke-layer-name").textContent.includes("Red box"),
  );
  await button("Hide Red box");
  assert.equal(layers().length, 0);
  await button("Show Red box");
  await button("Lock Red box");
  assert.equal(label("x").closest("fieldset").disabled, true);
  assert.equal(all('[aria-label="Rotate object"]').length, 0);
  await button("Unlock Red box");
  await button("Duplicate layer");
  assert.equal(layers().length, 2);
  await input("Duration", 15);
  assert.equal(number("Duration"), 15);
  await input("Duration", 12);
  await button("Move layer down");
  assert.ok(
    document.querySelectorAll(".ke-layer-name")[1].textContent.includes("copy"),
  );
  await button("Delete selected");
  assert.equal(layers().length, 1);
  await button("Undo (Ctrl+Z)");
  assert.equal(layers().length, 2);
  check(
    "Inspector, name, visibility, lock, duplicate, reorder, delete and undo",
  );
  await draw("Ellipse (O)", [350, 80], [430, 160]);
  assert.ok(
    Math.abs(
      Number(layers().at(-1).querySelector("ellipse").getAttribute("rx")) - 40,
    ) < 0.001,
  );
  await draw("Line (L)", [100, 350], [300, 450]);
  assert.ok(layers().at(-1).querySelector("line"));
  assert.ok(Math.abs(number("width") - Math.hypot(200, 100)) < 0.01);
  await button("Pen (P)");
  for (const [x, y] of [
    [500, 100],
    [600, 100],
    [550, 200],
  ]) {
    await pointer(canvas(), "pointerdown", ...pos(x, y));
    await pointer(
      document.querySelector(".ke-stage"),
      "pointerup",
      ...pos(x, y),
    );
  }
  await key("Enter");
  assert.ok(
    layers().at(-1).querySelector("path").getAttribute("d").includes("L"),
  );
  await button("Pen (P)");
  await drag(canvas(), [500, 300], [530, 320]);
  await pointer(canvas(), "pointerdown", ...pos(650, 350));
  await pointer(
    document.querySelector(".ke-stage"),
    "pointerup",
    ...pos(650, 350),
  );
  await key("Enter");
  assert.ok(
    layers().at(-1).querySelector("path").getAttribute("d").includes("C"),
  );
  await button("Text (T)");
  await pointer(canvas(), "pointerdown", ...pos(200, 300));
  await pointer(
    document.querySelector(".ke-stage"),
    "pointerup",
    ...pos(200, 300),
  );
  await input("Text content", "Hello SVG");
  assert.equal(layers().at(-1).querySelector("text").textContent, "Hello SVG");
  check("Ellipse, Line, straight Pen, curved Pen and editable Text tools");
  await button("Stop playback");
  await button("Add x keyframe");
  await button("Add scaleX keyframe");
  await button("Add rotation keyframe");
  await button("Add opacity keyframe");
  const ruler = document.querySelector(".ke-ruler");
  await pointer(ruler, "pointerdown", 780, 610);
  await pointer(ruler, "pointerup", 780, 610);
  await input("x", 400);
  await input("scaleX", 200);
  await input("rotation", 90);
  await input("opacity", 50);
  await pointer(ruler, "pointerdown", 530, 610);
  await pointer(ruler, "pointerup", 530, 610);
  assert.equal(number("x"), 300);
  assert.equal(number("scaleX"), 150);
  assert.equal(number("rotation"), 45);
  assert.equal(number("opacity"), 75);
  check("Position, scale, rotation and opacity keyframes interpolate on scrub");
  const textRow = all(".ke-track-row").find((el) =>
    el.textContent.includes("New text"),
  ).parentElement;
  const xTrack = textRow.querySelector(".ke-property-row .ke-track");
  let keys = [...xTrack.querySelectorAll(".ke-key")];
  assert.equal(keys.length, 2);
  await pointer(keys[1], "pointerdown", 780, 620);
  await pointer(keys[1], "pointermove", 1030, 620);
  await pointer(keys[1], "pointerup", 1030, 620);
  assert.ok(
    xTrack
      .querySelectorAll(".ke-key")[1]
      .getAttribute("aria-label")
      .includes("9.00"),
  );
  await button("Delete keyframe");
  assert.equal(xTrack.querySelectorAll(".ke-key").length, 1);
  await button("Undo (Ctrl+Z)");
  assert.equal(xTrack.querySelectorAll(".ke-key").length, 2);
  await act(async () =>
    xTrack.dispatchEvent(
      new win.MouseEvent("dblclick", {
        bubbles: true,
        clientX: 530,
        clientY: 620,
      }),
    ),
  );
  assert.equal(xTrack.querySelectorAll(".ke-key").length, 3);
  let moving = xTrack.querySelectorAll(".ke-key")[2];
  await pointer(moving, "pointerdown", 1030, 620);
  await pointer(moving, "pointermove", 530, 620);
  await pointer(moving, "pointermove", 780, 620);
  await pointer(moving, "pointerup", 780, 620);
  assert.equal(
    xTrack.querySelectorAll(".ke-key").length,
    3,
    "Crossed keyframes must survive dragging",
  );
  await button("Undo (Ctrl+Z)");
  await pointer(xTrack.querySelector(".ke-key"), "pointerdown", 280, 620);
  await pointer(xTrack.querySelector(".ke-key"), "pointerup", 280, 620);
  assert.equal(
    label("Redo (Ctrl+Shift+Z)").disabled,
    false,
    "Selection must not discard redo",
  );
  await button("Stop playback");
  await button("Start playback");
  now += 1000;
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((cb) => cb(now));
  });
  assert.ok(document.querySelector(".ke-time").textContent.startsWith("1.00"));
  assert.ok(number("x") > 200);
  await button("Pause playback");
  const paused = document.querySelector(".ke-time").textContent;
  now += 1000;
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((cb) => cb(now));
  });
  assert.equal(document.querySelector(".ke-time").textContent, paused);
  await button("Stop playback");
  assert.ok(document.querySelector(".ke-time").textContent.startsWith("0.00"));
  await button("Loop playback");
  await button("Start playback");
  now += 13000;
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((cb) => cb(now));
  });
  assert.ok(document.querySelector(".ke-time").textContent.startsWith("12.00"));
  assert.ok(label("Start playback"));
  await button("Loop playback");
  await button("Start playback");
  now += 13000;
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((cb) => cb(now));
  });
  assert.ok(document.querySelector(".ke-time").textContent.startsWith("1.00"));
  await button("Stop playback");
  check(
    "Keyframe retiming/deletion/undo and requestAnimationFrame play/pause/stop",
  );
  const oldWidth = parseFloat(canvas().parentElement.style.width);
  await button("Zoom in");
  assert.ok(parseFloat(canvas().parentElement.style.width) > oldWidth);
  await button("Pan (H)");
  await drag(canvas(), [100, 100], [150, 130]);
  assert.notEqual(
    canvas().parentElement.style.transform,
    "translate(0px, 0px)",
  );
  await click(document.querySelector(".ke-reset-view"));
  assert.equal(canvas().parentElement.style.transform, "translate(0px, 0px)");
  await button("Export SVG snapshot");
  const exported = await blobs.at(-1).text();
  assert.ok(exported.includes("<line"));
  assert.ok(exported.includes("Hello SVG"));
  assert.ok(exported.includes("scale("));
  assert.ok(!exported.includes("Selection handles"));
  const xml = new win.DOMParser().parseFromString(exported, "image/svg+xml");
  assert.equal(xml.querySelector("parsererror"), null);
  check("Zoom, pan, fit and SVG export from actual edited scene");
  await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
  const saved = globalThis.editorDraft;
  assert.ok(saved.layers.some((l) => l.text === "Hello SVG"));
  assert.equal(errors.length, 0, "React runtime errors: " + errors.join("\n"));
  check("Private draft preservation and no React runtime errors");
  await button("Import");
  assert.ok(
    all('[role="menuitem"]').some(
      (el) => el.textContent === "Import Lottie JSON",
    ),
  );
  await button("Import Lottie JSON");
  const upload = document.querySelector('input[type="file"]');
  const fixture = {
    v: "5.12.2",
    nm: "Imported test",
    w: 320,
    h: 240,
    fr: 24,
    ip: 12,
    op: 60,
    layers: [
      {
        ty: 4,
        ind: 1,
        nm: "Imported box",
        ip: 12,
        op: 60,
        ks: {
          p: {
            a: 1,
            k: [
              {
                t: 12,
                s: [50, 50],
                e: [150, 50],
                o: { x: 0, y: 0 },
                i: { x: 1, y: 1 },
              },
              { t: 36, s: [150, 50] },
            ],
          },
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
        },
        shapes: [
          {
            ty: "rc",
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [20, 20] },
            r: { a: 0, k: 0 },
          },
          { ty: "fl", c: { a: 0, k: [1, 0, 0] }, o: { a: 0, k: 100 } },
        ],
      },
    ],
  };
  const uploadJson = async (raw) => {
    Object.defineProperty(upload, "files", {
      value: [
        {
          name: "test.json",
          size: 1000,
          text: async () => JSON.stringify(raw),
        },
      ],
      configurable: true,
    });
    await act(async () =>
      upload.dispatchEvent(new win.Event("change", { bubbles: true })),
    );
  };
  const renderReady = async () =>
    act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
  const retainedRoot = () =>
    document.querySelector("[data-lottie-canvas] svg > g > g[data-layer]");
  await uploadJson(fixture);
  await renderReady();
  assert.equal(document.querySelectorAll(".ke-layer-row").length, 3);
  assert.ok(document.querySelector("[data-lottie-canvas] path[d]"));
  assert.ok(
    document
      .querySelector(".ke-layer-list")
      .textContent.includes("Imported box"),
  );
  assert.ok(
    document.querySelector(".ke-ruler-row").textContent.includes("24 fps"),
  );
  assert.ok(document.querySelector(".ke-time").textContent.startsWith("0.00"));
  await click(document.querySelector(".ke-layer-name"));
  assert.equal(number("x"), 50);
  assert.ok(all(".ke-key").length > 0);
  await input("x", 75);
  await input("Fill color", "#00ff00");
  await renderReady();
  assert.ok(
    document.querySelector('[data-lottie-canvas] path[fill="rgb(0,255,0)"]'),
  );
  await input("In point", 0.25);
  await input("Out point", 1.75);
  await renderReady();
  assert.equal(retainedRoot().style.display, "none");
  await button("Start playback");
  now += 500;
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((cb) => cb(now));
  });
  assert.notEqual(retainedRoot().style.display, "none");
  await button("Pause playback");
  await button("Export");
  await click(
    all('[role="menuitem"]').find(
      (el) => el.textContent === "Export Lottie JSON",
    ),
  );
  const lottie = JSON.parse(await blobs.at(-1).text());
  assert.equal(lottie.fr, 24);
  assert.equal(lottie.layers[0].ks.p.x.k[0].s[0], 75);
  assert.equal(lottie.layers[0].ip, 18);
  assert.equal(lottie.layers[0].op, 54);
  assert.deepEqual(
    lottie.layers[0].shapes.find((s) => s.ty === "fl").c.k,
    [0, 1, 0],
  );
  await uploadJson({ invalid: true });
  assert.equal(
    document.querySelectorAll(".ke-layer-row").length,
    3,
    "failed import must leave the scene intact",
  );
  assert.ok(
    document
      .querySelector('[role="status"]')
      .textContent.includes("valid Lottie"),
  );
  await button("Animated SVG");
  await renderReady();
  assert.ok((await blobs.at(-1).text()).includes("<animate"));
  await button("Export SVG snapshot");
  await renderReady();
  assert.ok((await blobs.at(-1).text()).includes("<svg"));
  assert.equal(errors.length, 0, "React runtime errors after Lottie editing");
  assert.ok(
    lottieLogs.some(
      ([tag, data]) =>
        tag === "[Lottie pipeline]" &&
        data.parsedNodes === 3 &&
        data.renderedObjects === 3,
    ),
  );
  check(
    "Lottie menu/upload, editable layers and colors, FPS, timing, playback, real JSON download, invalid-file recovery and SVG exports",
  );
} finally {
  if (root) await act(async () => root.unmount());
  console.error = originalError;
  console.info = originalInfo;
  await unlink(file).catch(() => {});
  win.happyDOM.abort();
}
