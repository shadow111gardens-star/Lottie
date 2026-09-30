import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const compile = (path) =>
  ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
const modelUrl =
  "data:text/javascript;base64," +
  Buffer.from(compile("src/editor/model.ts")).toString("base64");
const model = await import(modelUrl);
const io = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      compile("src/editor/io.ts").replace(
        /["']\.\/model["']/,
        JSON.stringify(modelUrl),
      ),
    ).toString("base64")
);
const geometry = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      compile("src/editor/geometry.ts").replace(
        /["']\.\/model["']/,
        JSON.stringify(modelUrl),
      ),
    ).toString("base64")
);
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS " + name);
}
const key = (time, value, easing = "linear") => ({
  id: String(time),
  time,
  value,
  easing,
});
test("linear interpolation and boundary clamping", () => {
  const f = [key(2, 10), key(4, 30)];
  assert.equal(model.interpolate(f, 3, 0), 20);
  assert.equal(model.interpolate(f, -1, 0), 10);
  assert.equal(model.interpolate(f, 9, 0), 30);
});
test("ease and hold interpolation", () => {
  assert.equal(
    model.interpolate([key(0, 0, "ease"), key(1, 100)], 0.25, 0),
    15.625,
  );
  assert.equal(
    model.interpolate([key(0, 10, "hold"), key(1, 100)], 0.9, 0),
    10,
  );
});
test("unanimated property stays editable without creating a track", () => {
  const layer = model.makeLayer("rect");
  const next = model.setProperty(layer, "x", 200, 1, false);
  assert.equal(next.x, 200);
  assert.equal(next.tracks.x, undefined);
  assert.equal(layer.x, 320);
});
test("auto-key inserts and updates instead of duplicating", () => {
  let l = model.makeLayer("rect");
  l = model.setProperty(l, "x", 10, 0, true);
  l = model.setProperty(l, "x", 110, 2, true);
  l = model.setProperty(l, "x", 210, 2, false);
  assert.equal(l.tracks.x.length, 2);
  assert.equal(model.evaluate(l, 1).x, 110);
});
test("scene serialization round trip preserves animation", () => {
  const scene = model.initialScene();
  const copy = io.validateScene(JSON.parse(JSON.stringify(scene)));
  assert.deepEqual(
    model.evaluate(copy.layers[0], 0.5),
    model.evaluate(scene.layers[0], 0.5),
  );
});
test("project validation rejects invalid dimensions, keys and duplicate IDs", () => {
  const s = model.initialScene();
  assert.throws(() => io.validateScene({ ...s, width: -1 }));
  assert.throws(() => io.validateScene({ ...s, duration: 0 }));
  assert.throws(() =>
    io.validateScene({ ...s, layers: [s.layers[0], s.layers[0]] }),
  );
  const bad = structuredClone(s);
  bad.layers[0].tracks.x = [key(100, 0)];
  assert.throws(() => io.validateScene(bad));
});
test("snapshot exports evaluated geometry with escaped text", () => {
  const s = model.initialScene("A & B");
  s.layers[0].text = "<script> & test";
  const svg = io.exportSceneSvg(s, 1.5, false);
  assert.ok(svg.includes("A &amp; B"));
  assert.ok(svg.includes("&lt;script&gt; &amp; test"));
  assert.ok(!svg.includes("<animate"));
  assert.ok(svg.includes("translate(110 235)"));
});
test("animated SVG includes portable animation and excludes hidden layers", () => {
  const s = model.initialScene();
  s.layers[0].visible = false;
  const svg = io.exportSceneSvg(s, 0, true);
  assert.ok(svg.includes("<animateTransform"));
  assert.ok(svg.includes('repeatCount="indefinite"'));
  assert.ok(!svg.includes("Make ideas move."));
  assert.ok(svg.includes('attributeName="opacity"'));
});
test("hold changes exactly at its keyframe", () => {
  assert.equal(model.interpolate([key(0, 10, "hold"), key(1, 100)], 1, 0), 100);
});
test("legacy projects migrate scale without mutating the input", () => {
  const original = model.initialScene();
  for (const l of original.layers) {
    delete l.scaleX;
    delete l.scaleY;
  }
  const migrated = io.validateScene(original);
  assert.equal(migrated.layers[0].scaleX, 100);
  assert.equal(original.layers[0].scaleX, undefined);
});
test("rotated scaled resizing preserves the opposite anchor", () => {
  const l = model.makeLayer("rect", {
    x: 20,
    y: 30,
    width: 100,
    height: 60,
    scaleX: 200,
    scaleY: 50,
    rotation: 37,
  });
  const before = geometry.localToWorld(l, { x: l.width, y: l.height });
  const resized = { ...l, ...geometry.resizeLayer(l, { x: -40, y: 25 }, "nw") };
  const after = geometry.localToWorld(resized, {
    x: resized.width,
    y: resized.height,
  });
  assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1e-8);
});
test("rotation preserves scaled object center", () => {
  const l = model.makeLayer("rect", { scaleX: 150, rotation: 20 });
  const center = geometry.localToWorld(l, { x: l.width / 2, y: l.height / 2 });
  const next = {
    ...l,
    ...geometry.rotateLayer(
      l,
      { x: center.x, y: center.y - 100 },
      { x: center.x + 100, y: center.y },
    ),
  };
  const after = geometry.localToWorld(next, {
    x: next.width / 2,
    y: next.height / 2,
  });
  assert.ok(Math.hypot(center.x - after.x, center.y - after.y) < 1e-8);
  assert.equal(next.rotation, 110);
});
test("draw tools normalize reverse drags and pen produces editable curves", () => {
  const rect = geometry.drawLayer("rect", { x: 100, y: 80 }, { x: 20, y: 10 });
  assert.equal(rect.x, 20);
  assert.equal(rect.height, 70);
  const line = geometry.drawLayer("line", { x: 50, y: 50 }, { x: 20, y: 10 });
  assert.equal(line.width, 50);
  const path = geometry.penLayer(
    [
      { x: 10, y: 20, dx: 20, dy: 30 },
      { x: 100, y: 50, dx: 0, dy: 0 },
    ],
    true,
  );
  assert.ok(path.path.includes(" C "));
  assert.ok(path.path.endsWith(" Z"));
  assert.equal(geometry.fitZoom(20, 20, 960, 600), 0.1);
});
test("SVG snapshots and animated export include lines and scale", () => {
  const scene = model.initialScene();
  scene.layers = [model.makeLayer("line", { scaleX: 150, scaleY: 200 })];
  assert.ok(io.exportSceneSvg(scene, 0, false).includes("scale(1.5 2)"));
  assert.ok(io.exportSceneSvg(scene, 0, false).includes("<line"));
  assert.ok(io.exportSceneSvg(scene, 0, true).includes('type="scale"'));
});
console.log(`${passed} editor checks passed.`);
