import svgpath from "svgpath";
import colorString from "color-string";
import {
  evaluate,
  type BezierPath,
  type Layer,
  type Property,
  type Scene,
} from "./model";

type Node = Record<string, any>;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export { readLottieProperty } from "./lottieProperty";
export { importLottie } from "./lottieDocument";
import { serializeLottie } from "./lottieDocument";

/** Normalize all SVG path commands (including arcs and quadratics) into Lottie cubic paths. */
export function svgToLottiePaths(d: string): BezierPath[] {
  const normalized = svgpath(d).abs().unshort().unarc();
  if ((normalized as any).err)
    throw new Error(`Invalid SVG path: ${(normalized as any).err}`);
  const paths: BezierPath[] = [];
  let p: BezierPath = { v: [], i: [], o: [], c: false };
  normalized.iterate((segment, _index, x, y) => {
    const s = segment as any[];
    const add = (vx: number, vy: number, i = [0, 0]) => {
      p.v.push([vx, vy]);
      p.i.push(i);
      p.o.push([0, 0]);
    };
    if (s[0] === "M") {
      p = { v: [], i: [], o: [], c: false };
      paths.push(p);
      add(s[1], s[2]);
    } else if (s[0] === "Z" || s[0] === "z") {
      p.c = true;
      const last = p.v.length - 1;
      if (
        last > 0 &&
        Math.hypot(p.v[last][0] - p.v[0][0], p.v[last][1] - p.v[0][1]) < 1e-8
      ) {
        p.i[0] = p.i.pop()!;
        p.v.pop();
        p.o.pop();
      }
    } else if (s[0] === "C") {
      p.o[p.o.length - 1] = [s[1] - x, s[2] - y];
      add(s[5], s[6], [s[3] - s[5], s[4] - s[6]]);
    } else if (s[0] === "Q") {
      p.o[p.o.length - 1] = [((s[1] - x) * 2) / 3, ((s[2] - y) * 2) / 3];
      add(s[3], s[4], [((s[1] - s[3]) * 2) / 3, ((s[2] - s[4]) * 2) / 3]);
    } else if (s[0] === "L") add(s[1], s[2]);
    else if (s[0] === "H") add(s[1], y);
    else if (s[0] === "V") add(x, s[1]);
  });
  return paths.filter((p) => p.v.length > 1);
}
const staticValue = (k: any) => ({ a: 0, k });
function exportTrack(
  l: Layer,
  prop: Property,
  fps: number,
  offset: number,
  convert = (n: number) => n,
): Node {
  const keys = [...(l.tracks[prop] || [])].sort((a, b) => a.time - b.time);
  if (!keys?.length) return staticValue(convert(l[prop]));
  return {
    a: 1,
    k: keys.map((key, i) => ({
      t: offset + key.time * fps,
      s: [convert(key.value)],
      ...(i < keys.length - 1
        ? {
            e: [convert(keys[i + 1].value)],
            ...(key.easing === "hold"
              ? { h: 1 }
              : {
                  o: { x: 1 / 3, y: key.easing === "ease" ? 0 : 1 / 3 },
                  i: { x: 2 / 3, y: key.easing === "ease" ? 1 : 2 / 3 },
                }),
          }
        : {}),
    })),
  };
}
export function exportLottie(scene: Scene): Node {
  if (scene.lottie) return serializeLottie(scene, exportLottie);
  const fps = scene.fps ?? 60,
    ip = scene.frameStart ?? 0,
    op = ip + scene.duration * fps;
  if (scene.duration * fps > 36000)
    throw new Error("Lottie export supports up to 36,000 frames.");
  const layers: Node[] = [];
  const assets: Node[] = [];
  let hasText = false;
  for (const l of scene.layers) {
    if (!l.visible) continue;
    const times = new Set<number>([0, scene.duration]);
    for (let f = 1; f < scene.duration * fps; f++) times.add(f / fps);
    for (const keys of Object.values(l.tracks))
      for (const k of keys || []) {
        times.add(k.time);
        if (k.easing === "hold") {
          const next = keys!.find((n) => n.time > k.time);
          if (next && next.time > 1e-7) times.add(next.time - 1e-7);
        }
      }
    const ordered = [...times].sort((a, b) => a - b),
      samples = ordered.map((t) =>
        evaluate({ ...l, startTime: undefined, endTime: undefined }, t),
      );
    const sampled = (get: (s: Layer) => any, shape = false): Node => {
      const values = samples.map(get),
        first = JSON.stringify(values[0]);
      if (values.every((v) => JSON.stringify(v) === first))
        return staticValue(values[0]);
      return {
        a: 1,
        k: values.map((v, i) => ({
          t: ip + ordered[i] * fps,
          s: shape ? [v] : v,
          ...(i < values.length - 1
            ? {
                e: shape ? [values[i + 1]] : values[i + 1],
                o: { x: 1 / 3, y: 1 / 3 },
                i: { x: 2 / 3, y: 2 / 3 },
              }
            : {}),
        })),
      };
    };
    const base: Node = {
      ddd: 0,
      ind: layers.length + 1,
      ty: l.type === "text" ? 5 : 4,
      nm: l.name,
      _editorId: l.id,
      sr: 1,
      st: 0,
      ip: ip + (l.startTime ?? 0) * fps,
      op: ip + Math.min(scene.duration, l.endTime ?? scene.duration) * fps,
      bm: 0,
      ks: {
        a: staticValue([0, 0, 0]),
        p: {
          s: true,
          x: exportTrack(l, "x", fps, ip),
          y: exportTrack(l, "y", fps, ip),
        },
        s: sampled((s) => [s.scaleX, s.scaleY, 100]),
        r: exportTrack(l, "rotation", fps, ip),
        o: exportTrack(l, "opacity", fps, ip),
      },
    };
    if (l.media) {
      for (const frame of l.media.frames) {
        if (frame.vector?.status === 'ready') continue;
        const id = `media-${l.id}-${frame.id}`;
        assets.push({ id, w: l.media.width, h: l.media.height, u: "", p: frame.image, e: 1 });
        layers.push({ ...base, ind: layers.length + 1, ty: 2, nm: `${l.name} frame ${frame.number}`, refId: id,
          ip: ip + ((l.startTime ?? 0) + frame.timestamp) * fps,
          op: ip + Math.min(scene.duration, l.endTime ?? scene.duration, (l.startTime ?? 0) + frame.timestamp + frame.duration) * fps,
          ks: { ...base.ks, s: sampled(s => [s.scaleX * s.width / l.media!.width, s.scaleY * s.height / l.media!.height, 100]), sk: exportTrack(l, "skewX", fps, ip, n => -n), sa: staticValue(0) },
        });
      }
      continue;
    }
    const paintCache = new Map<string, number[]>();
    const paint = (value: string): number[] => {
      const cached = paintCache.get(value);
      if (cached) return cached;
      let rgba = colorString.get.rgb(value);
      if (!rgba) {
        const hsl = colorString.get.hsl(value);
        if (hsl) {
          const [h, s, l, alpha] = hsl,
            light = l / 100,
            amplitude = (s / 100) * Math.min(light, 1 - light);
          rgba = [0, 8, 4].map((n) => {
            const k = (n + h / 30) % 12;
            return (
              (light - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))) *
              255
            );
          });
          rgba.push(alpha);
        }
      }
      if (!rgba) throw new Error(`Unsupported paint "${value}" on ${l.name}.`);
      const normalized = [
        rgba[0] / 255,
        rgba[1] / 255,
        rgba[2] / 255,
        rgba[3] ?? 1,
      ];
      paintCache.set(value, normalized);
      return normalized;
    };
    const color = (value: string) => paint(value).slice(0, 3);
    const sampledNumber = (get: (s: Layer) => number) => {
      const property = sampled((s) => [get(s)]);
      if (!property.a) property.k = property.k[0];
      return property;
    };
    const style: Node[] = [];
    if (l.fill !== "none")
      style.push({
        ty: "fl",
        nm: "Fill",
        c: sampled((s) => color(s.fill)),
        o: sampledNumber((s) => s.fillOpacity * paint(s.fill)[3]),
        r: l.fillRule === "evenodd" ? 2 : 1,
        bm: 0,
      });
    if (
      l.stroke !== "none" &&
      (l.strokeWidth > 0 || l.tracks.strokeWidth?.length)
    )
      style.push({
        ty: "st",
        nm: "Stroke",
        c: sampled((s) => color(s.stroke)),
        o: sampledNumber((s) => s.strokeOpacity * paint(s.stroke)[3]),
        w: exportTrack(l, "strokeWidth", fps, ip),
        lc: { butt: 1, round: 2, square: 3 }[l.lineCap || "butt"],
        lj: { miter: 1, round: 2, bevel: 3 }[l.lineJoin || "miter"],
        ml: 4,
        bm: 0,
      });
    const tr: Node = {
      ty: "tr",
      p: staticValue([0, 0]),
      a: staticValue([0, 0]),
      s: sampled((s) => [s.scaleX, s.scaleY]),
      r: staticValue(0),
      o: staticValue(100),
      sk: exportTrack(l, "skewX", fps, ip, (n) => -n),
      sa: staticValue(0),
    };
    let geometry: Node[] = [];
    if (l.type === "rect" || l.type === "ellipse")
      geometry = [
        {
          ty: l.type === "rect" ? "rc" : "el",
          d: 1,
          p: sampled((s) => [s.width / 2, s.height / 2]),
          s: sampled((s) => [s.width, s.height]),
          ...(l.type === "rect"
            ? { r: exportTrack(l, "radius", fps, ip) }
            : {}),
        },
      ];
    else if (l.type === "line")
      geometry = [
        {
          ty: "sh",
          ks: sampled(
            (s) => ({
              v: [
                [0, 0],
                [s.width, 0],
              ],
              i: [
                [0, 0],
                [0, 0],
              ],
              o: [
                [0, 0],
                [0, 0],
              ],
              c: false,
            }),
            true,
          ),
        },
      ];
    else if (l.type === "path") {
      const vb = (l.pathViewBox || "0 0 200 100")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (vb.length !== 4 || !vb.every(finite) || vb[2] <= 0 || vb[3] <= 0)
        throw new Error(`Invalid path viewBox on ${l.name}.`);
      const paths = samples.map((s) =>
        svgToLottiePaths(s.path).map((p) => ({
          c: p.c,
          v: p.v.map((v) => [v[0] - vb[0], v[1] - vb[1]]),
          i: p.i,
          o: p.o,
        })),
      );
      tr.s = sampled((s) => [
        (s.scaleX * s.width) / vb[2],
        (s.scaleY * s.height) / vb[3],
      ]);
      for (let j = 0; j < (paths[0]?.length || 0); j++) {
        if (paths.some((p) => !p[j] || p[j].v.length !== paths[0][j].v.length))
          throw new Error(
            `Animated path topology changes on ${l.name}; use matching path vertices.`,
          );
        let index = 0;
        geometry.push({ ty: "sh", ks: sampled(() => paths[index++][j], true) });
      }
    } else {
      hasText = true;
      base.t = {
        d: {
          k: ordered.map((t, i) => ({
            t: ip + t * fps,
            s: {
              t: l.text,
              f: "Arial-Bold",
              s: samples[i].height,
              j: 0,
              tr: 0,
              lh: samples[i].height * 1.2,
              ls: 0,
              ...(samples[i].fill === "none"
                ? {}
                : { fc: color(samples[i].fill) }),
              sc: color(
                samples[i].stroke === "none" ? "#000000" : samples[i].stroke,
              ),
              sw: samples[i].stroke === "none" ? 0 : samples[i].strokeWidth,
              of: true,
            },
          })),
        },
        a: [
          {
            a: {
              fo: sampledNumber(
                (s) =>
                  s.fillOpacity * (s.fill === "none" ? 0 : paint(s.fill)[3]),
              ),
              so: sampledNumber(
                (s) =>
                  s.strokeOpacity *
                  (s.stroke === "none" ? 0 : paint(s.stroke)[3]),
              ),
            },
            s: {
              t: 0,
              s: staticValue(0),
              e: staticValue(100),
              o: staticValue(0),
              a: staticValue(100),
              r: 1,
              sh: 1,
              b: 1,
            },
          },
        ],
      };
      // The editor uses SVG textLength; a text-group transform applies the equivalent horizontal fit.
      base.t.m = { g: 1, a: staticValue([0, 0]) };
      base.t.p = {};
      base.ks.a = sampled((s) => [0, -s.height * 0.82, 0]);
      const ctx =
        typeof document !== "undefined"
          ? document.createElement("canvas").getContext("2d")
          : null;
      const measure = (s: Layer) => {
        if (ctx) {
          ctx.font = `700 ${s.height}px Arial`;
          return ctx.measureText(s.text).width || 1;
        }
        return Math.max(1, s.text.length * s.height * 0.6);
      };
      base.ks.s = sampled((s) => [
        (s.scaleX * s.width) / measure(s),
        s.scaleY,
        100,
      ]);
      base.ks.sk = exportTrack(l, "skewX", fps, ip, (n) => -n);
      base.ks.sa = staticValue(0);
    }
    if (l.type !== "text") {
      base.ks.s = staticValue([100, 100, 100]);
      base.shapes = [
        {
          ty: "gr",
          nm: l.name,
          it: [...geometry, ...style, tr],
          np: geometry.length,
          cix: 2,
          bm: 0,
        },
      ];
    }
    layers.push(base);
  }
  if (scene.background !== "transparent")
    layers.push({
      ddd: 0,
      ind: layers.length + 1,
      ty: 1,
      nm: "Background",
      sw: scene.width,
      sh: scene.height,
      sc: scene.background,
      ks: {
        p: staticValue([0, 0, 0]),
        a: staticValue([0, 0, 0]),
        s: staticValue([100, 100, 100]),
        r: staticValue(0),
        o: staticValue(100),
      },
      ip,
      op,
      st: 0,
      sr: 1,
      bm: 0,
    });
  return {
    v: "5.12.2",
    fr: fps,
    ip,
    op,
    w: scene.width,
    h: scene.height,
    nm: scene.name,
    ddd: 0,
    assets,
    layers,
    markers: [],
    ...(hasText
      ? {
          fonts: {
            list: [
              {
                fName: "Arial-Bold",
                fFamily: "Arial",
                fStyle: "Bold",
                ascent: 82,
              },
            ],
          },
        }
      : {}),
  };
}
