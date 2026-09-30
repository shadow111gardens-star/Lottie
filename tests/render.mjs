import { build } from "esbuild";
import { writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
const output = resolve("tests/.editor-render.mjs");
const result = await build({
  entryPoints: ["src/Editor.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  loader: { ".css": "empty" },
  write: false,
});
try {
  await writeFile(output, result.outputFiles[0].text);
  globalThis.localStorage = { getItem: () => null };
  globalThis.window = { location: { search: "" } };
  const { default: Editor } = await import(pathToFileURL(output));
  const render = (path) =>
    renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/editor/:projectId",
            element: React.createElement(Editor),
          }),
        ),
      ),
    );
  const demo = render("/editor/1");
  assert.ok(demo.includes("Make ideas move."));
  assert.ok(demo.includes("Animation canvas"));
  assert.ok(demo.includes("Animated SVG"));
  assert.ok(demo.includes("keyframe at"));
  assert.equal((demo.match(/data-layer=/g) || []).length, 4);
  const blank = render("/editor/new-test");
  assert.ok(blank.includes("Untitled scene"));
  assert.equal((blank.match(/data-layer=/g) || []).length, 0);
  console.log(
    "PASS React runtime rendering: sample scene, timeline controls, exports and empty new project.",
  );
} finally {
  await unlink(output).catch(() => {});
}
