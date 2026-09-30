import {
  makeLayer,
  properties,
  uid,
  type Layer,
  type Scene,
  type Property,
  type LottieDiagnostic,
  type LottieNode,
} from "./model";
import { readLottieProperty as read } from "./lottieProperty";

type Data = Record<string, any>;
const clone = <T>(v: T): T => structuredClone(v);
const finite = (v: any): v is number =>
  typeof v === "number" && Number.isFinite(v);
const number = (v: any, fallback = 0): number => (finite(v) ? v : fallback);
const scalar = (v: any, fallback = 0) =>
  number(Array.isArray(v) ? v[0] : v, fallback);
const val = (k: any) => ({ a: 0, k });
const identity = () => ({
  a: val([0, 0, 0]),
  p: val([0, 0, 0]),
  s: val([100, 100, 100]),
  r: val(0),
  o: val(100),
});
const shapeTypes = new Set([
  "gr",
  "sh",
  "rc",
  "el",
  "sr",
  "fl",
  "st",
  "gf",
  "gs",
  "tr",
  "tm",
  "rd",
  "pb",
  "rp",
  "zz",
  "op",
  "no",
]);
const layerTypes = new Set([0, 1, 2, 3, 4, 5]);
const rgb = (c: any) =>
  "#" +
  [0, 1, 2]
    .map((i) =>
      Math.round(Math.max(0, Math.min(1, number(c?.[i]))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const baselineFields = [
  ...properties,
  "fill",
  "stroke",
  "text",
  "path",
  "visible",
  "name",
  "startTime",
  "endTime",
] as const;
const snapshot = (l: Layer) =>
  Object.fromEntries([
    ...baselineFields.map((k) => [k, l[k]]),
    ["tracks", clone(l.tracks)],
  ]);
const animated = (p: any) =>
  p?.a === 1 || (Array.isArray(p?.k) && finite(p.k[0]?.t));
const knownLayerFields = new Set(
  "ddd ind ty nm sr ks ao parent ip op st bm tt td tp refId w h sw sh sc shapes masksProperties hasMask t hd ln cl ix mn ct cp tm ef sy mb isGuide bounds xt completed _editorId".split(
    " ",
  ),
);
const knownShapeFields = new Set(
  "ty nm mn ix hd ln cl bm d ks p s r pt sy ir is or os c o w lc lj ml ml2 d g t e h a sk sa it np cix m mm c s e o tr rz a2 ind fillEnabled _editorId".split(
    " ",
  ),
);
export type LottieImportOptions = {
  baseUrl?: string;
  assets?: Record<string, string>;
  diagnostics?: boolean;
};
export type LottieImport = {
  scene: Scene;
  warnings: string[];
  diagnostics: LottieDiagnostic[];
};

/** Resolve only real asset locations. Relative uploads do not resolve against the editor's URL. */
export function resolveLottieAsset(
  asset: Data,
  options: LottieImportOptions = {},
): string | null {
  const supplied =
    options.assets?.[asset.id] ??
    options.assets?.[`${asset.u || ""}${asset.p || ""}`] ??
    options.assets?.[asset.p];
  const path = supplied ?? (typeof asset.p === "string" ? asset.p : "");
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)(?:;|,)/i.test(path))
    return path;
  try {
    const base = /^https?:\/\//i.test(asset.u || "")
      ? asset.u
      : options.baseUrl;
    const url = new URL(
      supplied ??
        (/^https?:\/\//i.test(path) ? path : `${asset.u || ""}${path}`),
      base,
    );
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
/** Normalize legacy color ranges and path closure before mixing old source with new editor content. */
function normalize(input: Data): Data {
  const data = clone(input),
    version = String(data.v || "5.12.2")
      .split(".")
      .map(Number);
  const older = (target: number[]) => {
    for (let i = 0; i < 3; i++) {
      if ((version[i] || 0) !== target[i]) return (version[i] || 0) < target[i];
    }
    return false;
  };
  const walk = (v: any) => {
    if (!v || typeof v !== "object") return;
    if (typeof v.ty === "number" && ("ind" in v || "ks" in v || "ip" in v)) {
      v.sr ??= 1;
      v.st ??= 0;
      v.ip ??= data.ip;
      v.op ??= data.op;
      v.bm ??= 0;
      v.ks = { ...identity(), ...(v.ks || {}) };
      if (v.masksProperties?.length) v.hasMask = true;
      delete v.completed;
    }
    if (older([4, 1, 9]) && ["fl", "st"].includes(v.ty) && v.c?.k) {
      if (animated(v.c))
        for (const k of v.c.k) {
          if (k.s) k.s = k.s.map((n: number) => n / 255);
          if (k.e) k.e = k.e.map((n: number) => n / 255);
        }
      else v.c.k = v.c.k.map((n: number) => n / 255);
    }
    if (older([4, 4, 18]) && v.ty === "sh" && v.ks?.k) {
      if (animated(v.ks))
        for (const k of v.ks.k) {
          if (k.s?.[0]) k.s[0].c = !!v.closed;
          if (k.e?.[0]) k.e[0].c = !!v.closed;
        }
      else v.ks.k.c = !!v.closed;
    }
    if (v.ty === 5 && v.t?.d && !v.t.d.k) v.t.d = { k: [{ t: 0, s: v.t.d }] };
    if (v.ty === 5 && v.t) {
      v.t.a ??= [];
      v.t.p ??= {};
      v.t.m ??= { g: 1, a: val([0, 0]) };
    }
    if (v.ty === 5 && v.t?.p)
      for (const key of ["a", "p", "r"])
        if (finite(v.t.p[key])) v.t.p[key] = val(v.t.p[key]);
    Object.values(v).forEach(walk);
  };
  walk(data);
  data.v = "5.12.2";
  delete data.__complete;
  return data;
}
function transformSource(
  source: Data,
  kind: LottieNode["kind"],
): Data | undefined {
  if (kind === "layer") return source.ks;
  if (source.ty === "gr") return source.it?.find((s: Data) => s.ty === "tr");
  if (source.ty === "tr") return source;
}
function firstPaint(source: Data, ty: string): Data | undefined {
  if (source.ty === ty) return source;
  for (const child of source.it || source.shapes || []) {
    const paint = firstPaint(child, ty);
    if (paint) return paint;
  }
}
function seedTracks(
  l: Layer,
  source: Data,
  kind: LottieNode["kind"],
  duration: number,
  fps: number,
) {
  const binding = l.lottie!,
    clock = binding.clock,
    ks = transformSource(source, kind);
  const recipes: Partial<Record<Property, (f: number) => number>> = {};
  const sources: Partial<Record<Property, any[]>> = {};
  const add = (prop: Property, ps: any[], fn: (frame: number) => number) => {
    recipes[prop] = fn;
    sources[prop] = ps;
  };
  if (ks) {
    add("x", [ks.p?.s ? ks.p.x : ks.p], (f) =>
      ks.p?.s ? scalar(read(ks.p.x, f, 0)) : number(read(ks.p, f, [0, 0])[0]),
    );
    add("y", [ks.p?.s ? ks.p.y : ks.p], (f) =>
      ks.p?.s ? scalar(read(ks.p.y, f, 0)) : number(read(ks.p, f, [0, 0])[1]),
    );
    add("scaleX", [ks.s], (f) => number(read(ks.s, f, [100, 100])[0], 100));
    add("scaleY", [ks.s], (f) => number(read(ks.s, f, [100, 100])[1], 100));
    add("rotation", [ks.r ?? ks.rz], (f) => scalar(read(ks.r ?? ks.rz, f, 0)));
    add("opacity", [ks.o], (f) => scalar(read(ks.o, f, 100)));
  }
  if (["rc", "el"].includes(source.ty)) {
    add("width", [source.s], (f) =>
      Math.max(0.000001, number(read(source.s, f, [100, 100])[0], 100)),
    );
    add("height", [source.s], (f) =>
      Math.max(0.000001, number(read(source.s, f, [100, 100])[1], 100)),
    );
    add(
      "x",
      [source.p, source.s],
      (f) => number(read(source.p, f, [0, 0])[0]) - recipes.width!(f) / 2,
    );
    add(
      "y",
      [source.p, source.s],
      (f) => number(read(source.p, f, [0, 0])[1]) - recipes.height!(f) / 2,
    );
    if (source.ty === "rc")
      add("radius", [source.r], (f) => scalar(read(source.r, f, 0)));
  }
  for (const [paint, key] of [
    ["fill", "fl"],
    ["stroke", "st"],
  ] as const) {
    const style = firstPaint(source, key);
    if (style?.c) {
      add(`${paint}Color`, [style.c], (f) =>
        parseInt(rgb(read(style.c, f, [0, 0, 0])).slice(1), 16),
      );
      add(`${paint}Opacity`, [style.o], (f) => scalar(read(style.o, f, 100)));
      l[paint] = rgb(read(style.c, clock.offset, [0, 0, 0]));
      if (paint === "stroke")
        add("strokeWidth", [style.w], (f) => scalar(read(style.w, f, 1)));
    }
  }
  if (source.ty === 1) {
    l.width = Math.max(1, number(source.sw, 100));
    l.height = Math.max(1, number(source.sh, 100));
    l.fill = source.sc || "none";
  }
  if (source.ty === 5) {
    const doc = source.t?.d?.k?.[0]?.s;
    if (doc) {
      l.text = String(doc.t || "");
      l.height = Math.max(1, number(doc.s, 48));
      l.fill = doc.fc ? rgb(doc.fc) : "none";
    }
  }
  for (const prop of Object.keys(recipes) as Property[]) {
    const sample = recipes[prop]!;
    l[prop] = sample(clock.offset);
    if (!(sources[prop] || []).some(animated)) continue;
    const times = new Set<number>([0, duration]);
    for (let f = 1; f < duration * fps; f++) times.add(f / fps);
    for (const p of sources[prop] || [])
      if (animated(p))
        for (const k of p.k) {
          const t = (k.t - clock.offset) / clock.rate;
          if (t > 0 && t < duration) times.add(t);
        }
    const keys = [...times]
      .sort((a, b) => a - b)
      .map((time) => ({
        id: uid(),
        time,
        value: sample(clock.offset + time * clock.rate),
        easing: "linear" as const,
      }));
    // Constant properties stay static. Source curves remain intact in the retained node.
    if (keys.some((k) => Math.abs(k.value - keys[0].value) > 1e-8))
      l.tracks[prop] = keys;
  }
}

export function importLottie(
  input: unknown,
  filename = "Lottie animation",
  options: LottieImportOptions = {},
): LottieImport {
  const raw = input as Data;
  if (
    !raw ||
    !Array.isArray(raw.layers) ||
    ![raw.w, raw.h, raw.fr, raw.ip, raw.op].every(finite) ||
    raw.w < 1 ||
    raw.h < 1 ||
    raw.w > 8192 ||
    raw.h > 8192 ||
    raw.fr <= 0 ||
    raw.fr > 240 ||
    raw.op <= raw.ip
  )
    throw new Error(
      "Choose a valid Lottie JSON with layers, dimensions, FPS and in/out frames.",
    );
  if ((raw.op - raw.ip) / raw.fr > 600 || raw.op - raw.ip > 36000)
    throw new Error(
      "Lottie import supports up to 600 seconds and 36,000 frames.",
    );
  let complexity = 0;
  const check = (v: any, depth = 0) => {
    if (++complexity > 1500000 || depth > 100)
      throw new Error("Lottie file is too complex to import safely.");
    if (v && typeof v === "object")
      for (const child of Object.values(v)) check(child, depth + 1);
  };
  check(raw);
  const data = normalize(raw),
    header = clone(data);
  delete header.layers;
  delete header.assets;
  const assets: Data[] = Array.isArray(data.assets) ? data.assets : [];
  const sourceAssets = new Map(assets.map((a) => [String(a.id), a]));
  const diagnostics: LottieDiagnostic[] = [];
  const scene: Scene = {
    version: 1,
    name: String(data.nm || filename.replace(/\.json$/i, "")),
    width: data.w,
    height: data.h,
    background: "transparent",
    clip: true,
    duration: (data.op - data.ip) / data.fr,
    fps: data.fr,
    frameStart: data.ip,
    layers: [],
    lottie: { header, assets: clone(assets), diagnostics },
  };
  for (const asset of scene.lottie!.assets)
    if (!asset.layers && asset.p) {
      const resolved = resolveLottieAsset(asset, options);
      if (resolved) {
        asset.p = resolved;
        asset.u = "";
        asset.e = 1;
      }
    }
  let sampleBudget = 0;
  const log = (l: Layer, owner: Data) => {
    if (options.diagnostics !== false)
      console.info("[Lottie parse]", {
        nodeId: l.id,
        layerType: owner.ty,
        layerName: owner.nm || "Unnamed",
        shapeType: l.lottie!.kind === "shape" ? l.lottie!.source.ty : undefined,
        sourcePath: l.lottie!.sourcePath,
        status: l.lottie!.status,
      });
  };
  function unsupported(
    l: Layer,
    owner: Data,
    property: string,
    message: string,
    whole = false,
  ) {
    const d: LottieDiagnostic = {
      nodeId: l.id,
      layerType: owner.ty,
      layerName: String(owner.nm || "Unnamed"),
      shapeType:
        l.lottie!.kind === "shape" ? String(l.lottie!.source.ty) : undefined,
      unsupportedProperty: property,
      sourcePath: l.lottie!.sourcePath,
      message,
    };
    diagnostics.push(d);
    l.lottie!.diagnostics.push(d);
    if (options.diagnostics !== false) console.warn("[Lottie unsupported]", d);
    if (whole) {
      l.lottie!.status = "unsupported";
      l.type = "unsupported";
      l.name = `Unsupported · ${l.name}`;
      return;
    }
    const issue = makeLayer("unsupported", {
      name: `Unsupported · ${l.name} / ${property}`,
      x: 12,
      y: 12 + 28 * (diagnostics.length - 1),
      width: 130,
      height: 24,
      fill: "#fff0f6",
      stroke: "#cc286b",
      strokeWidth: 1,
    });
    issue.lottie = {
      kind: "issue",
      source: { ty: "unsupported-property", property },
      parentId: l.id,
      field: "issues",
      sourcePath: `${l.lottie!.sourcePath}.${property}`,
      clock: l.lottie!.clock,
      status: "unsupported",
      diagnostics: [{ ...d, nodeId: issue.id }],
      baseline: {},
    };
    issue.lottie.baseline = snapshot(issue);
    scene.layers.push(issue);
  }
  const create = (
    source: Data,
    kind: LottieNode["kind"],
    field: LottieNode["field"],
    path: string,
    parent: Layer | undefined,
    owner: Data,
    clock: { offset: number; rate: number },
  ): Layer => {
    if (scene.layers.length >= 10000)
      throw new Error("Lottie import exceeds 10,000 retained nodes.");
    const ownName = String(
      source.nm ||
        (kind === "layer"
          ? `Layer ${source.ind ?? ""} (${source.ty})`
          : `${source.ty ?? kind}`),
    );
    const l = makeLayer(
      kind === "layer" && source.ty === 5 ? "text" : "lottie",
      {
        name: parent ? `${parent.name} / ${ownName}` : ownName,
        x: 0,
        y: 0,
        width: scene.width,
        height: scene.height,
        fill: "none",
        stroke: "none",
        radius: 0,
        strokeWidth: 0,
        visible: !source.hd,
      },
    );
    l.lottie = {
      kind,
      source: clone(source),
      parentId: parent?.id,
      field,
      sourcePath: path,
      clock,
      status: "supported",
      diagnostics: [],
      baseline: {},
    };
    scene.layers.push(l);
    try {
      seedTracks(l, source, kind, scene.duration, data.fr);
    } catch (error) {
      unsupported(l, owner, "animated property", String(error), true);
    }
    sampleBudget += Object.values(l.tracks).reduce(
      (sum, k) => sum + (k?.length || 0),
      0,
    );
    if (sampleBudget > 2000000)
      throw new Error(
        "Lottie animation exceeds two million editable keyframes.",
      );
    if (kind === "layer") {
      l.startTime = Math.max(
        0,
        (number(source.ip, data.ip) - clock.offset) / clock.rate,
      );
      l.endTime = Math.min(
        scene.duration,
        (number(source.op, data.op) - clock.offset) / clock.rate,
      );
      for (const [key, p] of Object.entries(source.ks || {})) {
        if (
          p &&
          typeof p === "object" &&
          !("k" in p) &&
          !(key === "p" && (p as Data).s)
        )
          unsupported(
            l,
            owner,
            `ks.${key}`,
            `Malformed transform property ks.${key}.`,
            true,
          );
      }
      if (!layerTypes.has(source.ty))
        unsupported(
          l,
          owner,
          "ty",
          `Layer type ${source.ty} has no SVG renderer.`,
          true,
        );
      if (source.ddd)
        unsupported(
          l,
          owner,
          "ddd",
          "3D transforms are retained; this SVG renderer shows their 2D projection.",
        );
      if (source.ty === 5) {
        if (!Array.isArray(source.t?.d?.k) || !source.t.d.k.length)
          unsupported(
            l,
            owner,
            "t.d.k",
            "Missing text document keyframes.",
            true,
          );
        else
          for (const [index, key] of source.t.d.k.entries()) {
            if (
              !key.s ||
              !data.fonts?.list?.some((font: Data) => font.fName === key.s.f)
            )
              unsupported(
                l,
                owner,
                `t.d.k[${index}].s.f`,
                `Unresolved text font ${key.s?.f ?? "(missing)"}.`,
                true,
              );
          }
      }
      for (const key of ["ef", "sy"])
        if (source[key]?.length)
          source[key].forEach((effect: Data, index: number) =>
            unsupported(
              l,
              owner,
              `${key}[${index}].ty`,
              `${key === "ef" ? "Effect" : "Layer style"} type ${effect.ty} (${effect.nm || "unnamed"}) is retained but not executed by the SVG light renderer.`,
            ),
          );
      for (const key of Object.keys(source))
        if (!knownLayerFields.has(key))
          unsupported(
            l,
            owner,
            key,
            `Unknown layer property ${key} is retained.`,
          );
    } else if (kind === "shape") {
      if (!shapeTypes.has(source.ty))
        unsupported(
          l,
          owner,
          "ty",
          `Shape type ${source.ty} has no SVG renderer.`,
          true,
        );
      for (const key of Object.keys(source))
        if (!knownShapeFields.has(key) && key !== "closed")
          unsupported(
            l,
            owner,
            key,
            `Unknown shape property ${key} is retained.`,
          );
      const required: Record<string, string[]> = {
        sh: ["ks"],
        rc: ["p", "s", "r"],
        el: ["p", "s"],
        fl: ["c", "o"],
        st: ["c", "o", "w"],
        gf: ["g", "s", "e", "o"],
        gs: ["g", "s", "e", "o", "w"],
        tm: ["s", "e", "o"],
        sr: ["p", "pt", "r", "or", "os"],
        rp: ["c", "o", "tr"],
        rd: ["r"],
        pb: ["a"],
        zz: ["s", "r", "pt"],
        op: ["a", "lj", "ml"],
      };
      for (const key of required[source.ty] || [])
        if (source[key] === undefined)
          unsupported(
            l,
            owner,
            key,
            `Missing required ${source.ty}.${key}; no black/default geometry was substituted.`,
            true,
          );
      if (
        ["gf", "gs"].includes(source.ty) &&
        (!finite(source.g?.p) || source.g.p < 1 || !source.g.k)
      )
        unsupported(
          l,
          owner,
          "g",
          "Gradient is missing its stop count or animated stops.",
          true,
        );
      if (source.ty === "sh") {
        const values = animated(source.ks)
          ? source.ks.k.flatMap((k: Data) => [...(k.s || []), ...(k.e || [])])
          : [source.ks?.k];
        if (
          values.some(
            (p: any) =>
              !p ||
              !Array.isArray(p.v) ||
              !Array.isArray(p.i) ||
              !Array.isArray(p.o) ||
              p.i.length !== p.v.length ||
              p.o.length !== p.v.length ||
              ![p.v, p.i, p.o].every((points) =>
                points.every(
                  (point: any) =>
                    Array.isArray(point) &&
                    point.length >= 2 &&
                    point.slice(0, 2).every(finite),
                ),
              ),
          )
        )
          unsupported(
            l,
            owner,
            "ks",
            "Malformed path vertices/tangents.",
            true,
          );
      }
    } else if (kind === "mask") {
      if (!source.pt?.k)
        unsupported(l, owner, "pt", "Missing mask path.", true);
      if (!["a", "s", "i", "n"].includes(source.mode))
        unsupported(
          l,
          owner,
          "mode",
          `Mask mode ${source.mode} is unsupported.`,
          true,
        );
      if (source.f)
        unsupported(
          l,
          owner,
          "f",
          "Mask feathering is not implemented by the SVG renderer.",
        );
    }
    const expressions = (v: any, path = "") => {
      if (!v || typeof v !== "object") return;
      for (const [key, value] of Object.entries(v)) {
        if (["shapes", "it", "masksProperties"].includes(key)) continue;
        if (key === "x" && typeof value === "string")
          unsupported(
            l,
            owner,
            `${path}x`,
            "Expressions are retained but never executed; authored keyframes are rendered.",
          );
        else if (value && typeof value === "object")
          expressions(value, `${path}${key}.`);
      }
    };
    expressions(source);
    log(l, owner);
    return l;
  };
  function shapes(
    items: Data[],
    parent: Layer,
    path: string,
    owner: Data,
    clock: { offset: number; rate: number },
  ) {
    for (let i = 0; i < items.length; i++) {
      const source =
        items[i] && typeof items[i] === "object"
          ? items[i]
          : { ty: "invalid", value: items[i] };
      const l = create(
        source,
        "shape",
        parent.lottie!.kind === "layer" ? "shapes" : "it",
        `${path}[${i}]`,
        parent,
        owner,
        clock,
      );
      if (source.ty === "gr") {
        if (Array.isArray(source.it))
          shapes(source.it, l, `${path}[${i}].it`, owner, clock);
        else
          unsupported(l, owner, "it", "Group has no valid child array.", true);
      }
      delete l.lottie!.source.it;
      l.lottie!.baseline = snapshot(l);
    }
  }
  function composition(
    layers: Data[],
    parent: Layer | undefined,
    path: string,
    clock: { offset: number; rate: number },
    ancestry: string[],
  ) {
    const siblings: Layer[] = [];
    for (let i = 0; i < layers.length; i++) {
      const source =
          layers[i] && typeof layers[i] === "object"
            ? layers[i]
            : { ty: "invalid", value: layers[i] },
        p = `${path}[${i}]`;
      const l = create(source, "layer", "layers", p, parent, source, clock);
      siblings.push(l);
      if (source.ty === 4)
        shapes(
          Array.isArray(source.shapes) ? source.shapes : [],
          l,
          `${p}.shapes`,
          source,
          clock,
        );
      for (let j = 0; j < (source.masksProperties?.length || 0); j++) {
        const mask = create(
          source.masksProperties[j],
          "mask",
          "masksProperties",
          `${p}.masksProperties[${j}]`,
          l,
          source,
          clock,
        );
        mask.lottie!.baseline = snapshot(mask);
      }
      if (source.ty === 0) {
        const asset = sourceAssets.get(String(source.refId));
        if (!asset || !Array.isArray(asset.layers))
          unsupported(
            l,
            source,
            "refId",
            `Missing precomposition asset ${source.refId}.`,
            true,
          );
        else if (
          ancestry.includes(String(source.refId)) ||
          ancestry.length >= 20
        )
          unsupported(
            l,
            source,
            "refId",
            `Cyclic or overly deep precomposition ${source.refId}.`,
            true,
          );
        else {
          const assetId = `comp-${l.id}`;
          l.lottie!.assetId = assetId;
          l.lottie!.source.refId = assetId;
          const assetHeader = clone(asset);
          delete assetHeader.layers;
          assetHeader.id = assetId;
          scene.lottie!.assets.push(assetHeader);
          l.lottie!.source.w = source.w ?? asset.w ?? data.w;
          l.lottie!.source.h = source.h ?? asset.h ?? data.h;
          const stretch = number(source.sr, 1) || 1;
          composition(
            asset.layers,
            l,
            `${p}.asset(${source.refId}).layers`,
            {
              offset: (clock.offset - number(source.st)) / stretch,
              rate: clock.rate / stretch,
            },
            [...ancestry, String(source.refId)],
          );
        }
      }
      if (source.ty === 2) {
        const asset = sourceAssets.get(String(source.refId));
        if (!asset)
          unsupported(
            l,
            source,
            "refId",
            `Missing image asset ${source.refId}.`,
            true,
          );
        else if (!resolveLottieAsset(asset, options))
          unsupported(
            l,
            source,
            "refId",
            `Unresolved image ${source.refId}: ${asset.u || ""}${asset.p || ""}. A relative file needs a base URL or an asset mapping.`,
            true,
          );
        else {
          l.width = Math.max(1, number(asset.w, data.w));
          l.height = Math.max(1, number(asset.h, data.h));
        }
      }
      delete l.lottie!.source.shapes;
      delete l.lottie!.source.masksProperties;
      l.lottie!.baseline = snapshot(l);
    }
    for (const l of siblings)
      if (l.lottie!.source.parent !== undefined) {
        const p = siblings.find(
          (s) => s.lottie!.source.ind === l.lottie!.source.parent,
        );
        if (p) l.lottie!.transformParentId = p.id;
        else
          unsupported(
            l,
            l.lottie!.source,
            "parent",
            `Missing transform parent ${l.lottie!.source.parent}.`,
          );
      }
    for (let i = 0; i < siblings.length; i++) {
      const l = siblings[i],
        source = l.lottie!.source;
      if (source.tt) {
        const matte =
          source.tp !== undefined
            ? siblings.find((s) => s.lottie!.source.ind === source.tp)
            : siblings[i - 1];
        if (!matte)
          unsupported(
            l,
            source,
            "tt",
            `Missing matte source for matte type ${source.tt}.`,
          );
      }
    }
    for (const l of siblings) {
      const seen = new Set<string>();
      let p: Layer | undefined = l;
      while (p?.lottie?.transformParentId) {
        if (seen.has(p.id)) {
          unsupported(
            l,
            l.lottie!.source,
            "parent",
            "Cyclic transform parenting.",
          );
          break;
        }
        seen.add(p.id);
        p = siblings.find((x) => x.id === p!.lottie!.transformParentId);
      }
    }
  }
  composition(
    data.layers,
    undefined,
    "layers",
    { offset: data.ip, rate: data.fr },
    [],
  );
  return {
    scene,
    warnings: diagnostics.map(
      (d) => `${d.sourcePath}.${d.unsupportedProperty}: ${d.message}`,
    ),
    diagnostics,
  };
}

const changed = (l: Layer, key: string) =>
  JSON.stringify((l as any)[key]) !== JSON.stringify(l.lottie!.baseline[key]);
const trackChanged = (l: Layer, p: Property) =>
  changed(l, p) ||
  JSON.stringify(l.tracks[p]) !==
    JSON.stringify(l.lottie!.baseline.tracks?.[p]);
function scalarProperty(
  l: Layer,
  p: Property,
  convert = (n: number) => n,
): Data {
  const clock = l.lottie!.clock,
    keys = [...(l.tracks[p] || [])].sort((a, b) => a.time - b.time);
  if (!keys.length) return val(convert(l[p]));
  return {
    a: 1,
    k: keys.map((k, i) => ({
      t: clock.offset + k.time * clock.rate,
      s: [convert(k.value)],
      ...(i < keys.length - 1
        ? {
            e: [convert(keys[i + 1].value)],
            ...(k.easing === "hold"
              ? { h: 1 }
              : {
                  o: { x: 1 / 3, y: k.easing === "ease" ? 0 : 1 / 3 },
                  i: { x: 2 / 3, y: k.easing === "ease" ? 1 : 2 / 3 },
                }),
          }
        : {}),
    })),
  };
}
function vectorProperty(
  l: Layer,
  props: Property[],
  get: (time: number) => number[],
): Data {
  const times = new Set<number>([0]);
  for (const p of props) for (const k of l.tracks[p] || []) times.add(k.time);
  const sorted = [...times].sort((a, b) => a - b),
    clock = l.lottie!.clock;
  if (sorted.length === 1 && props.every((p) => !l.tracks[p]?.length))
    return val(get(0));
  return {
    a: 1,
    k: sorted.map((t, i) => ({
      t: clock.offset + t * clock.rate,
      s: get(t),
      ...(i < sorted.length - 1
        ? {
            e: get(sorted[i + 1]),
            o: { x: 1 / 3, y: 1 / 3 },
            i: { x: 2 / 3, y: 2 / 3 },
          }
        : {}),
    })),
  };
}
import { evaluate } from "./model";
function overrideNode(l: Layer, source: Data): Data {
  const binding = l.lottie!;
  if (changed(l, "name")) source.nm = l.name;
  if (changed(l, "visible")) source.hd = !l.visible;
  if (binding.kind === "layer") {
    if (changed(l, "startTime"))
      source.ip =
        binding.clock.offset + (l.startTime ?? 0) * binding.clock.rate;
    if (changed(l, "endTime"))
      source.op =
        binding.clock.offset + (l.endTime ?? Infinity) * binding.clock.rate;
  }
  const ks = transformSource(source, binding.kind);
  if (ks) {
    if (trackChanged(l, "x") || trackChanged(l, "y"))
      ks.p = {
        s: true,
        x: trackChanged(l, "x")
          ? scalarProperty(l, "x")
          : ks.p?.s
            ? ks.p.x
            : vectorComponent(ks.p, 0),
        y: trackChanged(l, "y")
          ? scalarProperty(l, "y")
          : ks.p?.s
            ? ks.p.y
            : vectorComponent(ks.p, 1),
      };
    if (trackChanged(l, "scaleX") || trackChanged(l, "scaleY"))
      ks.s = vectorProperty(l, ["scaleX", "scaleY"], (t) => {
        const v = evaluate(l, t);
        return [v.scaleX, v.scaleY, 100];
      });
    if (trackChanged(l, "rotation")) ks.r = scalarProperty(l, "rotation");
    if (trackChanged(l, "opacity")) ks.o = scalarProperty(l, "opacity");
  }
  if (["rc", "el"].includes(source.ty)) {
    if (["width", "height"].some((p) => trackChanged(l, p as Property)))
      source.s = vectorProperty(l, ["width", "height"], (t) => {
        const v = evaluate(l, t);
        return [v.width, v.height];
      });
    if (
      ["x", "y", "width", "height"].some((p) => trackChanged(l, p as Property))
    )
      source.p = vectorProperty(l, ["x", "y", "width", "height"], (t) => {
        const v = evaluate(l, t);
        return [v.x + v.width / 2, v.y + v.height / 2];
      });
    if (source.ty === "rc" && trackChanged(l, "radius"))
      source.r = scalarProperty(l, "radius");
  }
  for (const [paint, ty] of [
    ["fill", "fl"],
    ["stroke", "st"],
  ] as const) {
    const colorProp = `${paint}Color` as const,
      opacityProp = `${paint}Opacity` as const;
    const apply = (s: Data) => {
      if (s.ty === ty || s.ty === (paint === "fill" ? "gf" : "gs")) {
        if (changed(l, paint) || trackChanged(l, colorProp)) {
          if (l[paint] === "none") s.hd = true;
          else {
            s.ty = ty;
            delete s.g;
            delete s.t;
            delete s.s;
            delete s.e;
            delete s.h;
            delete s.a;
            s.c = vectorProperty(l, [colorProp], (t) => {
              const color = evaluate(l, t)[paint];
              return [1, 3, 5].map(
                (i) => parseInt(color.slice(i, i + 2), 16) / 255,
              );
            });
          }
        }
        if (trackChanged(l, opacityProp)) s.o = scalarProperty(l, opacityProp);
        if (paint === "stroke" && trackChanged(l, "strokeWidth"))
          s.w = scalarProperty(l, "strokeWidth");
      }
      for (const child of s.it || s.shapes || []) apply(child);
    };
    apply(source);
  }
  if (source.ty === 5) {
    for (const key of source.t?.d?.k || [])
      if (key.s) {
        if (changed(l, "text")) key.s.t = l.text;
        if (changed(l, "height")) key.s.s = l.height;
        if (changed(l, "fill"))
          key.s.fc = [1, 3, 5].map(
            (i) => parseInt(l.fill.slice(i, i + 2), 16) / 255,
          );
      }
  }
  if (source.ty === 1) {
    if (changed(l, "fill")) source.sc = l.fill;
    if (changed(l, "width")) source.sw = l.width;
    if (changed(l, "height")) source.sh = l.height;
  }
  // Baseline is immutable: playback alone must never overwrite authored curves.
  return source;
}
function vectorComponent(p: Data | undefined, index: number): Data {
  if (!p) return val(0);
  if (!animated(p)) return val(number(p.k?.[index]));
  return {
    a: 1,
    k: p.k.map((k: Data) => ({
      ...clone(k),
      ...(k.s ? { s: [k.s[index]] } : {}),
      ...(k.e ? { e: [k.e[index]] } : {}),
      ...(k.o
        ? {
            o: {
              x: Array.isArray(k.o.x) ? (k.o.x[index] ?? k.o.x[0]) : k.o.x,
              y: Array.isArray(k.o.y) ? (k.o.y[index] ?? k.o.y[0]) : k.o.y,
            },
          }
        : {}),
      ...(k.i
        ? {
            i: {
              x: Array.isArray(k.i.x) ? (k.i.x[index] ?? k.i.x[0]) : k.i.x,
              y: Array.isArray(k.i.y) ? (k.i.y[index] ?? k.i.y[0]) : k.i.y,
            },
          }
        : {}),
    })),
  };
}
/** Rebuild arrays from retained records, preserving parentage, order, assets and current edits. */
export function serializeLottie(
  scene: Scene,
  nativeExport: (scene: Scene) => Data,
): Data {
  if (!scene.lottie) throw new Error("Scene has no retained Lottie document.");
  const document: Data = {
    ...clone(scene.lottie.header),
    nm: scene.name,
    w: scene.width,
    h: scene.height,
    fr: scene.fps ?? 60,
    ip: scene.frameStart ?? 0,
    op: (scene.frameStart ?? 0) + scene.duration * (scene.fps ?? 60),
    assets: clone(scene.lottie.assets),
    layers: [] as Data[],
  };
  const children = new Map<string, Layer[]>();
  for (const l of scene.layers)
    if (l.lottie?.parentId) {
      const list = children.get(l.lottie.parentId) || [];
      list.push(l);
      children.set(l.lottie.parentId, list);
    }
  const build = (l: Layer): Data => {
    const binding = l.lottie!,
      s = clone(binding.source);
    s._editorId = l.id;
    const child = children.get(l.id) || [];
    for (const field of ["shapes", "it", "masksProperties"] as const) {
      const list = child.filter((c) => c.lottie!.field === field);
      if (
        list.length ||
        (field === "shapes" && s.ty === 4) ||
        (field === "it" && s.ty === "gr")
      )
        s[field] = list.map(build);
    }
    if (binding.assetId) {
      const asset = document.assets.find((a: Data) => a.id === binding.assetId);
      if (asset)
        asset.layers = child
          .filter((c) => c.lottie!.field === "layers")
          .map(build);
    }
    return overrideNode(l, s);
  };
  const native = scene.layers.filter((l) => !l.lottie);
  const nativeData = native.length
    ? nativeExport({
        ...scene,
        lottie: undefined,
        background: "transparent",
        layers: native,
      })
    : { layers: [] };
  const nativeMap = new Map<string, Data>(
    nativeData.layers.map((l: Data, i: number) => [native[i].id, l]),
  );
  if (nativeData.fonts)
    document.fonts = {
      list: [...(document.fonts?.list || []), ...nativeData.fonts.list],
    };
  let nextIndex =
    Math.max(
      0,
      ...scene.layers
        .filter((l) => l.lottie?.kind === "layer" && !l.lottie.parentId)
        .map((l) => number(l.lottie!.source.ind)),
    ) + 1;
  for (const l of scene.layers) {
    if (l.lottie) {
      if (l.lottie.kind === "layer" && !l.lottie.parentId)
        document.layers.push(build(l));
    } else {
      const n = nativeMap.get(l.id);
      if (n) {
        n.ind = nextIndex++;
        document.layers.push(n);
      }
    }
  }
  if (scene.background !== "transparent")
    document.layers.push({
      ty: 1,
      ind: nextIndex++,
      nm: "Background",
      sw: scene.width,
      sh: scene.height,
      sc: scene.background,
      ks: identity(),
      ip: document.ip,
      op: document.op,
      st: 0,
      sr: 1,
    });
  document.assets = document.assets.filter(
    (asset: Data) =>
      asset.layers || asset.p || !String(asset.id).startsWith("comp-"),
  );
  // Referenced instance assets own their retained layers; original unused assets remain in the file for round trips.
  return document;
}

export function unsupportedShape(id: string): Data {
  return {
    ty: "gr",
    nm: "Unsupported",
    _editorId: id,
    it: [
      { ty: "rc", p: val([45, 16]), s: val([90, 32]), r: val(3) },
      { ty: "fl", c: val([1, 0.9, 0.95]), o: val(100), r: 1 },
      {
        ty: "st",
        c: val([0.8, 0.1, 0.4]),
        o: val(100),
        w: val(2),
        lc: 1,
        lj: 1,
        ml: 4,
      },
      { ty: "tr", ...identity() },
    ],
  };
}
/** Rendering substitutions are explicit placeholders. Export retains the original unsupported payload. */
export function prepareLottieRenderData(scene: Scene, document: Data): Data {
  const data = clone(document),
    byId = new Map(scene.layers.map((l) => [l.id, l]));
  const layerPlaceholder = (l: Layer, source: Data, index: number) => ({
    ...source,
    ty: 4,
    ddd: 0,
    ks: l.lottie?.diagnostics.some((d) =>
      d.unsupportedProperty.startsWith("ks."),
    )
      ? identity()
      : source.ks || { ...identity(), p: val([l.x, l.y, 0]) },
    shapes: [
      ...(source.ty === 4 ? source.shapes || [] : []),
      unsupportedShape(`${l.id}:placeholder`),
    ],
    refId: undefined,
    tm: undefined,
    ip: source.ip ?? data.ip,
    op: source.op ?? data.op,
    st: source.st ?? 0,
    sr: source.sr ?? 1,
    ind: source.ind ?? index,
    _editorId: l.id,
    nm: l.name,
    ef: [],
    sy: [],
    masksProperties: [],
    tt: 0,
    td: 0,
  });
  const shapes = (items: Data[]): Data[] =>
    items.map((s) => {
      const l = byId.get(s._editorId);
      if (l?.lottie?.status === "unsupported") return unsupportedShape(l.id);
      if (s.ty === "gr") s.it = shapes(s.it || []);
      return s;
    });
  const process = (layers: Data[]) =>
    layers.map((source, index) => {
      const l = byId.get(source._editorId);
      if (l?.lottie?.status === "unsupported") {
        const placeholder = layerPlaceholder(l, source, index + 1);
        placeholder.shapes = shapes(placeholder.shapes);
        return placeholder;
      }
      delete source.ef;
      delete source.sy;
      source.ddd = 0;
      if (
        l?.lottie?.diagnostics.some((d) => d.unsupportedProperty === "parent")
      )
        delete source.parent;
      if (l?.lottie?.diagnostics.some((d) => d.unsupportedProperty === "tt"))
        delete source.tt;
      if (source.shapes) source.shapes = shapes(source.shapes);
      if (source.masksProperties)
        source.masksProperties = source.masksProperties.map((s: Data) =>
          byId.get(s._editorId)?.lottie?.status === "unsupported"
            ? {
                ...s,
                mode: "n",
                pt: val({ v: [[0, 0]], i: [[0, 0]], o: [[0, 0]], c: false }),
                o: val(0),
              }
            : s,
        );
      return source;
    });
  data.layers = process(data.layers);
  for (const asset of data.assets)
    if (asset.layers) asset.layers = process(asset.layers);
  let index = Math.max(0, ...data.layers.map((l: Data) => number(l.ind))) + 1;
  for (const l of scene.layers)
    if (
      (l.lottie?.kind === "issue" ||
        (l.lottie?.kind === "mask" && l.lottie.status === "unsupported")) &&
      l.visible
    )
      data.layers.unshift(layerPlaceholder(l, {}, index++));
  // Avoid loading unused image assets, while keeping every referenced asset intact.
  const used = new Set<string>();
  const collect = (layers: Data[]) => {
    for (const l of layers)
      if (l.refId && !used.has(l.refId)) {
        used.add(l.refId);
        const asset = data.assets.find((a: Data) => a.id === l.refId);
        if (asset?.layers) collect(asset.layers);
      }
  };
  collect(data.layers);
  data.assets = data.assets.filter((a: Data) => used.has(a.id));
  return data;
}

/** Duplicate a retained subtree without aliasing source IDs or precomposition instances. */
export function duplicateLottieNode(
  scene: Scene,
  id: string,
): { scene: Scene; selected: string } {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of scene.layers)
      if (l.lottie?.parentId && ids.has(l.lottie.parentId) && !ids.has(l.id)) {
        ids.add(l.id);
        changed = true;
      }
  }
  const original = scene.layers.filter((l) => ids.has(l.id)),
    clones = clone(original),
    mapping = new Map(original.map((l) => [l.id, uid()]));
  let nextIndex =
    Math.max(0, ...scene.layers.map((l) => number(l.lottie?.source.ind))) + 1;
  const assets = clone(scene.lottie!.assets);
  for (const l of clones) {
    const oldId = l.id;
    l.id = mapping.get(oldId)!;
    l.locked = false;
    if (l.lottie) {
      if (l.lottie.parentId)
        l.lottie.parentId = mapping.get(l.lottie.parentId) || l.lottie.parentId;
      if (l.lottie.transformParentId)
        l.lottie.transformParentId =
          mapping.get(l.lottie.transformParentId) || l.lottie.transformParentId;
      if (l.lottie.kind === "layer") l.lottie.source.ind = nextIndex++;
      if (l.lottie.assetId) {
        const asset = assets.find((a) => a.id === l.lottie!.assetId);
        if (asset) {
          const copy = clone(asset);
          copy.id = `comp-${l.id}`;
          assets.push(copy);
          l.lottie.assetId = copy.id;
          l.lottie.source.refId = copy.id;
        }
      }
      for (const diagnostic of l.lottie.diagnostics) diagnostic.nodeId = l.id;
    }
    for (const keys of Object.values(l.tracks))
      for (const k of keys || []) k.id = uid();
    if (oldId === id) {
      l.name += " copy";
      l.x += 20;
      l.y += 20;
      for (const p of ["x", "y"] as const)
        for (const k of l.tracks[p] || []) k.value += 20;
    }
  }
  for (const l of clones)
    if (l.lottie?.transformParentId) {
      const parent = clones.find((p) => p.id === l.lottie!.transformParentId);
      if (parent) l.lottie.source.parent = parent.lottie!.source.ind;
    }
  const layers = [...scene.layers],
    index = layers.findIndex((l) => l.id === id);
  layers.splice(index, 0, ...clones);
  return {
    scene: { ...scene, layers, lottie: { ...scene.lottie!, assets } },
    selected: mapping.get(id)!,
  };
}
