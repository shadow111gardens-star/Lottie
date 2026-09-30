import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Window } from "happy-dom";
const out = resolve("tests/.lottie-test.mjs");
const bundle = await build({
  stdin: {
    contents:
      'export * from "./src/editor/lottie"; export * from "./src/editor/model"; export * from "./src/editor/io"; export * from "./src/editor/lottieDocument"; export * from "./src/editor/lottieRenderer";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  write: false,
});
await writeFile(out, bundle.outputFiles[0].text);
const m = await import(pathToFileURL(out));
const val = (k) => ({ a: 0, k });
const transform = (extra = {}) => ({
  p: val([0, 0, 0]),
  a: val([0, 0, 0]),
  s: val([100, 100, 100]),
  r: val(0),
  o: val(100),
  ...extra,
});
const anim = (a, b, start = 10, end = 40) => ({
  a: 1,
  k: [
    { t: start, s: a, e: b, o: { x: 1 / 3, y: 0 }, i: { x: 2 / 3, y: 1 } },
    { t: end, s: b },
  ],
});
const path = {
  v: [
    [0, 0],
    [40, 0],
    [40, 40],
    [0, 40],
  ],
  i: [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  o: [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  c: true,
};
const shape = (name = "Box") => ({
  ty: 4,
  ind: 1,
  nm: name,
  ip: 10,
  op: 70,
  st: 0,
  sr: 1,
  ks: transform({ p: anim([100, 100, 0], [220, 100, 0]), a: val([10, 20, 0]) }),
  shapes: [
    {
      ty: "gr",
      nm: "Group",
      it: [
        {
          ty: "gr",
          nm: "Nested",
          it: [
            { ty: "sh", nm: "Outline", ks: val(path) },
            {
              ty: "fl",
              nm: "Fill",
              c: anim([1, 0, 0, 1], [0, 0, 1, 1]),
              o: val(100),
              r: 1,
            },
            {
              ty: "st",
              nm: "Stroke",
              c: val([0, 1, 0, 1]),
              o: val(70),
              w: val(2),
              lc: 2,
              lj: 2,
            },
            {
              ty: "tr",
              ...transform({ s: val([80, 120]), r: anim([0], [45]) }),
            },
          ],
        },
        { ty: "tr", ...transform() },
      ],
    },
  ],
});
const fixture = {
  v: "5.12.2",
  nm: "Fixture",
  w: 320,
  h: 240,
  fr: 30,
  ip: 10,
  op: 70,
  assets: [],
  layers: [shape()],
};
const imported = (data) =>
  m.importLottie(data, "fixture.json", { diagnostics: false });
let passed = 0;
const test = (name, fn) => {
  fn();
  console.log("PASS " + name);
  passed++;
};
const near = (a, b, tol = 1e-5) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const info = console.info,
  warn = console.warn;
const logs = [];
console.info = (...args) => logs.push(args);
console.warn = (...args) => logs.push(args);
let win;
const runtimes = [];
try {
  test("Retained hierarchy has a record for every layer, nested group, path, paint and transform", () => {
    const { scene, diagnostics } = imported(fixture);
    assert.equal(diagnostics.length, 0);
    assert.equal(scene.layers.length, 8);
    assert.equal(scene.fps, 30);
    assert.equal(scene.frameStart, 10);
    assert.equal(scene.duration, 2);
    const root = scene.layers[0],
      group = scene.layers[1],
      nested = scene.layers[2],
      outline = scene.layers[3];
    assert.equal(group.lottie.parentId, root.id);
    assert.equal(nested.lottie.parentId, group.id);
    assert.equal(outline.lottie.parentId, nested.id);
    assert.ok(root.tracks.x.length);
    assert.ok(
      scene.layers.find((l) => l.lottie.source.ty === "fl").tracks.fillColor
        .length,
    );
    assert.equal(
      JSON.stringify(m.validateScene(JSON.parse(JSON.stringify(scene)))),
      JSON.stringify(scene),
    );
  });
  test("Serialization reconstructs original shape scope, z-order and exact authored animation without baking it", () => {
    const scene = imported(fixture).scene,
      json = m.exportLottie(scene);
    assert.deepEqual(json.layers[0].ks, fixture.layers[0].ks);
    assert.deepEqual(
      json.layers[0].shapes[0].it[0].it[1].c,
      fixture.layers[0].shapes[0].it[0].it[1].c,
    );
    assert.deepEqual(
      json.layers[0].shapes[0].it[0].it.map((s) => s.ty),
      ["sh", "fl", "st", "tr"],
    );
    scene.layers[0] = m.setProperty(scene.layers[0], "x", 333, 0.5, true);
    const edited = m.exportLottie(scene);
    assert.ok(
      edited.layers[0].ks.p.x.k.some((k) => k.t === 25 && k.s[0] === 333),
    );
    const fill = scene.layers.find((l) => l.lottie.source.ty === "fl");
    fill.fill = "#00ff00";
    fill.tracks.fillColor = [];
    fill.fillColor = 0x00ff00;
    assert.deepEqual(
      m.exportLottie(scene).layers[0].shapes[0].it[0].it[1].c.k,
      [0, 1, 0],
    );
  });
  test("Unsupported layers/shapes/properties are retained, labelled and precisely diagnosed", () => {
    const f = structuredClone(fixture);
    f.layers.push({ ty: 77, ind: 2, nm: "Mystery" });
    f.layers[0].shapes[0].it.push({ ty: "future", nm: "Future shape" });
    f.layers[0].ef = [{ ty: 999, nm: "Future effect" }];
    const { scene, diagnostics } = m.importLottie(f, "fixture.json");
    assert.equal(
      scene.layers.filter((l) => l.type === "unsupported").length,
      3,
    );
    assert.ok(
      diagnostics.some(
        (d) => d.layerType === 77 && d.unsupportedProperty === "ty",
      ),
    );
    assert.ok(diagnostics.some((d) => d.shapeType === "future"));
    assert.ok(diagnostics.some((d) => d.unsupportedProperty === "ef[0].ty"));
    assert.equal(m.exportLottie(scene).layers[1].ty, 77);
    assert.equal(m.exportLottie(scene).layers[0].ef[0].ty, 999);
    assert.ok(
      logs.some(
        ([tag, d]) =>
          tag === "[Lottie unsupported]" &&
          d.layerName === "Mystery" &&
          d.sourcePath === "layers[1]",
      ),
    );
    const all = imported({
      ...fixture,
      layers: [{ ty: 77, ind: 1, nm: "Only unsupported" }],
    }).scene;
    assert.equal(all.layers.length, 1);
    assert.equal(all.layers[0].type, "unsupported");
  });
  test("Asset resolution handles embedded/absolute/base-relative/mapped references and diagnoses missing files", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
    assert.equal(m.resolveLottieAsset({ p: png, e: 1 }), png);
    assert.equal(
      m.resolveLottieAsset({ p: "a.png", u: "https://example.test/images/" }),
      "https://example.test/images/a.png",
    );
    assert.equal(
      m.resolveLottieAsset(
        { id: "a", p: "a.png", u: "images/" },
        { baseUrl: "https://example.test/anim/data.json" },
      ),
      "https://example.test/anim/images/a.png",
    );
    assert.equal(
      m.resolveLottieAsset({ id: "a", p: "a.png" }, { assets: { a: png } }),
      png,
    );
    assert.equal(m.resolveLottieAsset({ p: "a.png" }), null);
    assert.equal(m.resolveLottieAsset({ p: "javascript:alert(1)" }), null);
    const f = {
      ...fixture,
      assets: [{ id: "a", w: 1, h: 1, p: png, e: 1 }],
      layers: [
        {
          ty: 2,
          ind: 1,
          nm: "Image",
          refId: "a",
          ks: transform(),
          ip: 10,
          op: 70,
        },
      ],
    };
    assert.equal(imported(f).diagnostics.length, 0);
    f.assets[0].p = "missing.png";
    const result = imported(f);
    assert.equal(result.scene.layers[0].type, "unsupported");
    assert.ok(result.diagnostics[0].message.includes("missing.png"));
  });
  test("Precomp instances and transform parents retain independent hierarchies and timing", () => {
    const f = {
      ...fixture,
      assets: [
        {
          id: "comp",
          w: 320,
          h: 240,
          layers: [shape(), { ty: 3, ind: 2, nm: "Parent", ks: transform() }],
        },
      ],
      layers: [
        {
          ty: 0,
          ind: 1,
          nm: "Instance A",
          refId: "comp",
          st: 10,
          sr: 2,
          ip: 10,
          op: 70,
          ks: transform(),
        },
        {
          ty: 0,
          ind: 2,
          nm: "Instance B",
          refId: "comp",
          st: 0,
          sr: 1,
          ip: 10,
          op: 70,
          ks: transform(),
        },
      ],
    };
    f.assets[0].layers[0].parent = 2;
    const scene = imported(f).scene,
      roots = scene.layers.filter(
        (l) => l.lottie.kind === "layer" && !l.lottie.parentId,
      ),
      doc = m.exportLottie(scene);
    assert.equal(roots.length, 2);
    assert.notEqual(doc.layers[0].refId, doc.layers[1].refId);
    assert.equal(doc.layers[0].sr, 2);
    assert.equal(doc.layers[0].st, 10);
    assert.ok(
      scene.layers.find((l) => l.lottie.source.parent === 2).lottie
        .transformParentId,
    );
    const asset = doc.assets.find((a) => a.id === doc.layers[0].refId);
    assert.equal(asset.layers.length, 2);
    assert.equal(asset.layers[0].parent, 2);
  });
  test("Invalid data fails atomically; malformed geometry becomes an explicit placeholder", () => {
    for (const v of [null, {}, { ...fixture, fr: 0 }, { ...fixture, op: 10 }])
      assert.throws(() => imported(v));
    const f = structuredClone(fixture);
    delete f.layers[0].shapes[0].it[0].it[1].c;
    const result = imported(f);
    assert.ok(result.diagnostics.some((d) => d.unsupportedProperty === "c"));
    assert.equal(
      result.scene.layers.find((l) => l.lottie.source.ty === "fl").type,
      "unsupported",
    );
  });
  test("Native editor export still produces cubic paths, CSS paints and scalar keyframes", () => {
    const s = m.initialScene();
    s.layers = [
      m.makeLayer("path", {
        path: "M0 0 h20 v20 q10 20 20 0 a10 10 0 0 1 20 0 z",
        fill: "rgba(255,0,0,0.5)",
      }),
    ];
    const json = m.exportLottie(s);
    assert.equal(
      json.layers[0].shapes[0].it.find((x) => x.ty === "fl").o.k,
      50,
    );
    assert.ok(json.layers[0].shapes[0].it[0].ks.k.v.length >= 6);
    assert.ok(m.exportSceneSvg(s, 0, true).includes("<animate"));
  });
  win = new Window({ url: "http://localhost/" });
  globalThis.window = win;
  globalThis.document = win.document;
  Object.defineProperty(globalThis, "navigator", {
    value: win.navigator,
    configurable: true,
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
  const loaded = async (player) => {
    if (player.isLoaded) return;
    await new Promise((res, rej) => {
      const timer = setTimeout(
        () => rej(new Error("Lottie load timeout")),
        4000,
      );
      player.addEventListener("DOMLoaded", () => {
        clearTimeout(timer);
        res();
      });
      player.addEventListener("data_failed", () => {
        clearTimeout(timer);
        rej(new Error("data failed"));
      });
    });
  };
  const mount = async (scene) => {
    const host = document.createElement("div");
    document.body.append(host);
    const errors = [];
    const runtime = await m.createLottieRenderer(host, scene, {
      log: false,
      onDiagnostic: (...args) => errors.push(args),
    });
    runtimes.push(runtime);
    await loaded(runtime.player);
    return { host, runtime, errors };
  };
  const advanced = structuredClone(fixture);
  advanced.layers[0].shapes[0].it[0].it.splice(
    1,
    1,
    {
      ty: "gf",
      nm: "Gradient",
      t: 1,
      g: { p: 2, k: val([0, 1, 0, 0, 1, 0, 0, 1]) },
      s: val([0, 0]),
      e: val([40, 40]),
      o: val(100),
      r: 1,
    },
    { ty: "tm", nm: "Trim", s: val(0), e: anim([20], [100]), o: val(0), m: 1 },
  );
  advanced.layers[0].hasMask = true;
  advanced.layers[0].masksProperties = [
    {
      nm: "Animated mask",
      mode: "a",
      inv: false,
      pt: val(path),
      o: val(100),
      x: val(0),
    },
  ];
  const a = await mount(imported(advanced).scene);
  a.runtime.seek(0.5);
  assert.equal(a.errors.length, 0, JSON.stringify(a.errors));
  assert.ok(a.runtime.coverage().every((r) => r.rendered));
  assert.ok(a.host.querySelector("linearGradient"));
  assert.ok(a.host.querySelector("mask,clipPath"));
  assert.ok(a.host.querySelector('path[fill^="url("]'));
  assert.ok(!a.host.innerHTML.includes("NaN"));
  const before = a.host.innerHTML;
  a.runtime.seek(0.9);
  assert.notEqual(a.host.innerHTML, before);
  console.log(
    "PASS Parsed gradients, masks, nested transforms, trim paths and animation all have real renderer objects",
  );
  passed++;
  const unsupported = structuredClone(fixture);
  unsupported.layers.push({ ty: 77, ind: 2, nm: "Unknown" });
  unsupported.layers[0].shapes[0].it.push({ ty: "mm", mm: 1 });
  const u = await mount(imported(unsupported).scene);
  assert.ok(
    u.runtime.coverage().every((r) => r.rendered),
    JSON.stringify(u.runtime.coverage().filter((r) => !r.rendered)),
  );
  u.runtime.seek(0.5);
  assert.ok(
    [...u.host.querySelectorAll("path[fill]")].some((el) =>
      el.getAttribute("fill").startsWith("rgb(255,2"),
    ),
  );
  console.log(
    "PASS Unsupported layer and modifier placeholders render instead of disappearing",
  );
  passed++;

  const matte = structuredClone(fixture);
  matte.layers = [
    {
      ty: 1,
      ind: 4,
      nm: "Matte",
      sw: 150,
      sh: 150,
      sc: "#ffffff",
      td: 1,
      ks: transform(),
      ip: 10,
      op: 70,
    },
    shape("Matted content"),
    { ty: 3, ind: 3, nm: "Null", ks: transform(), ip: 10, op: 70 },
  ];
  matte.layers[1].tt = 1;
  matte.layers[1].parent = 3;
  const mat = await mount(imported(matte).scene);
  mat.runtime.seek(0.5);
  assert.equal(mat.errors.length, 0);
  assert.ok(mat.runtime.coverage().every((row) => row.rendered));
  assert.ok(mat.host.querySelector("mask"));
  assert.ok(mat.host.querySelector("[mask]"));
  console.log(
    "PASS Track mattes, solids and nonvisual null transform parents retain renderer objects",
  );
  passed++;
  const textFixture = {
    ...fixture,
    fonts: {
      list: [
        { fName: "Arial-Bold", fFamily: "Arial", fStyle: "Bold", ascent: 82 },
      ],
    },
    layers: [
      {
        ty: 5,
        ind: 1,
        nm: "Text",
        ip: 10,
        op: 40,
        ks: transform({ p: val([20, 60]) }),
        t: {
          d: {
            k: [
              {
                t: 10,
                s: {
                  t: "Visible text",
                  f: "Arial-Bold",
                  s: 24,
                  j: 0,
                  tr: 0,
                  lh: 28,
                  ls: 0,
                  fc: [0.2, 0.6, 0.8],
                },
              },
              {
                t: 25,
                s: {
                  t: "Animated text",
                  f: "Arial-Bold",
                  s: 24,
                  j: 0,
                  tr: 0,
                  lh: 28,
                  ls: 0,
                  fc: [1, 0, 0],
                },
              },
            ],
          },
          a: [],
          m: { g: 1, a: val([0, 0]) },
        },
      },
    ],
  };
  const tx = await mount(imported(textFixture).scene);
  tx.runtime.seek(0);
  assert.ok(tx.host.textContent.includes("Visible text"));
  tx.runtime.seek(0.6);
  assert.ok(tx.host.textContent.includes("Animated text"));
  tx.runtime.seek(1.5);
  assert.equal(tx.host.querySelector("[data-layer]").style.display, "none");
  assert.equal(tx.errors.length, 0);
  console.log(
    "PASS Authored text, animated document data and layer out points render correctly",
  );
  passed++;
  const imageUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  const imageFixture = {
    ...fixture,
    assets: [{ id: "image", w: 1, h: 1, p: imageUrl, e: 1 }],
    layers: [
      {
        ty: 2,
        ind: 1,
        nm: "Embedded image",
        refId: "image",
        ks: transform(),
        ip: 10,
        op: 70,
      },
    ],
  };
  const imageScene = imported(imageFixture).scene,
    imageHost = document.createElement("div"),
    imageErrors = [];
  document.body.append(imageHost);
  const imageRuntime = await m.createLottieRenderer(imageHost, imageScene, {
    log: false,
    onDiagnostic: (...args) => imageErrors.push(args),
  });
  runtimes.push(imageRuntime);
  const imageElement = imageHost.querySelector("image");
  assert.ok(imageElement);
  assert.equal(
    imageElement.getAttributeNS("http://www.w3.org/1999/xlink", "href"),
    imageUrl,
  );
  imageElement.dispatchEvent(new win.Event("load"));
  await loaded(imageRuntime.player);
  imageRuntime.seek(0.5);
  assert.ok(imageRuntime.coverage().every((row) => row.rendered));
  assert.equal(imageErrors.length, 0);
  imageElement.dispatchEvent(new win.Event("error"));
  assert.equal(imageErrors[0][0], imageScene.layers[0].id);
  assert.equal(imageErrors[0][1], "refId");
  assert.ok(imageErrors[0][2].includes(imageUrl));
  console.log(
    "PASS Embedded image references reach SVG image objects; simulated load failures identify the exact layer and asset",
  );
  passed++;
  const originalScene = imported(fixture).scene;
  const duplicate = m.duplicateLottieNode(
    originalScene,
    originalScene.layers[0].id,
  );
  assert.equal(duplicate.scene.layers.length, originalScene.layers.length * 2);
  assert.equal(m.exportLottie(duplicate.scene).layers.length, 2);
  m.validateScene(duplicate.scene);
  const real = JSON.parse(
    await readFile("tests/fixtures/bodymovin.json", "utf8"),
  );
  const realResult = imported(real);
  assert.ok(realResult.scene.layers.length > 1000);
  assert.ok(
    realResult.diagnostics.every((d) => d.shapeType === "mm"),
    JSON.stringify(realResult.diagnostics.slice(0, 4)),
  );
  const r = await mount(realResult.scene);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors.slice(0, 5)));
  assert.ok(r.runtime.coverage().every((row) => row.rendered));
  r.runtime.seek(1.5);
  const paths = [...r.host.querySelectorAll("path[d]")].filter(
    (el) => el.getAttribute("d").length > 20,
  );
  assert.ok(paths.length > 100);
  assert.ok(!r.host.innerHTML.includes("NaN"));
  const mid = r.host.innerHTML;
  r.runtime.seek(2.5);
  assert.notEqual(r.host.innerHTML, mid);
  console.log(
    `PASS Real Bodymovin fixture: ${realResult.scene.layers.length} retained nodes, ${paths.length} drawn paths, complete model-to-renderer coverage`,
  );
  passed++;
  // Compare authored renderer output against parsed-model output, including actual gradient/mask DOM and frames.
  const { default: lottie } =
    await import("lottie-web/build/player/lottie_light.js");
  const directHost = document.createElement("div");
  document.body.append(directHost);
  const direct = lottie.loadAnimation({
    container: directHost,
    renderer: "svg",
    autoplay: false,
    animationData: structuredClone(advanced),
  });
  await loaded(direct);
  const geometry = (host) =>
    [...host.querySelectorAll("path")].map((el) => [
      el.getAttribute("d"),
      el.getAttribute("fill")?.startsWith("url(")
        ? "gradient"
        : el.getAttribute("fill"),
      el.getAttribute("stroke"),
      el.getAttribute("stroke-width"),
    ]);
  for (const frame of [0, 7.5, 15, 29, 45]) {
    direct.goToAndStop(frame, true);
    a.runtime.seek(frame / 30);
    assert.deepEqual(
      geometry(a.host),
      geometry(directHost),
      `Direct source vs parsed model at frame ${frame}`,
    );
  }
  direct.destroy();
  console.log(
    "PASS Direct Lottie JSON → player matches parsed internal model → canvas at five frames",
  );
  passed++;
  const exportedSvg = await m.exportRenderedLottieSvg(
    imported(advanced).scene,
    0.5,
    false,
  );
  assert.ok(exportedSvg.includes("linearGradient"));
  assert.ok(!exportedSvg.includes("NaN"));
  console.log("PASS SVG snapshot uses the same retained-content renderer");
  passed++;
  console.log(`${passed} Lottie checks passed.`);
} finally {
  for (const runtime of runtimes) runtime.destroy();
  win?.happyDOM.abort();
  console.info = info;
  console.warn = warn;
  await unlink(out).catch(() => {});
}
