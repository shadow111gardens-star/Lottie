export const transformProperties = [
  "x",
  "y",
  "width",
  "height",
  "scaleX",
  "scaleY",
  "rotation",
  "opacity",
] as const;
export const properties = [
  ...transformProperties,
  "skewX",
  "radius",
  "strokeWidth",
  "fillOpacity",
  "strokeOpacity",
  "fillColor",
  "strokeColor",
  "pathProgress",
] as const;
export type Property = (typeof properties)[number];
export type Keyframe = {
  id: string;
  time: number;
  value: number;
  easing: "linear" | "ease" | "hold";
};
export type LottieDiagnostic = {
  nodeId: string;
  layerType: number | string;
  layerName: string;
  shapeType?: string;
  unsupportedProperty: string;
  sourcePath: string;
  message: string;
};
export type LottieNode = {
  kind: "layer" | "shape" | "mask" | "issue";
  source: Record<string, any>;
  parentId?: string;
  transformParentId?: string;
  field: "layers" | "shapes" | "it" | "masksProperties" | "issues";
  sourcePath: string;
  assetId?: string;
  clock: { offset: number; rate: number };
  status: "supported" | "unsupported";
  diagnostics: LottieDiagnostic[];
  baseline: Record<string, any>;
};
export type LottieDocument = {
  header: Record<string, any>;
  assets: Record<string, any>[];
  diagnostics: LottieDiagnostic[];
};
export type Layer = {
  id: string;
  name: string;
  type:
    "rect" | "ellipse" | "text" | "path" | "line" | "lottie" | "unsupported" | "media";
  media?: MediaSequence;
  sourceFrame?: { layer: string; frame: string };
  frameImage?: string;
  lottie?: LottieNode;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  skewX: number;
  fillOpacity: number;
  strokeOpacity: number;
  fillColor: number;
  strokeColor: number;
  pathProgress: number;
  pathData?: BezierPath[][];
  startTime?: number;
  endTime?: number;
  fillRule?: "nonzero" | "evenodd";
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  text: string;
  path: string;
  pathViewBox?: string;
  visible: boolean;
  locked: boolean;
  tracks: Partial<Record<Property, Keyframe[]>>;
};
export type MediaFrame = {
  id: string;
  number: number;
  timestamp: number;
  duration: number;
  /** Original integer PTS/duration and rational time base, without FPS rounding. */
  pts: string;
  durationTicks: string;
  packetDurationTicks?: string;
  image: string;
  vector?: { status: 'ready'; svg: string } | { status: 'error'; error: string };
};
export type MediaSequence = {
  sourceName: string;
  kind: "video" | "gif";
  width: number;
  height: number;
  timeBase: string;
  duration: number;
  frames: MediaFrame[];
};
export function mediaFrameAt(media: MediaSequence, time: number): MediaFrame | undefined {
  let lo = 0, hi = media.frames.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (media.frames[mid].timestamp <= time) lo = mid + 1;
    else hi = mid;
  }
  const frame = media.frames[lo - 1];
  return frame && time < frame.timestamp + frame.duration ? frame : undefined;
}
export type Scene = {
  version: 1;
  name: string;
  width: number;
  height: number;
  background: string;
  clip: boolean;
  duration: number;
  fps?: number;
  frameStart?: number;
  lottie?: LottieDocument;
  layers: Layer[];
};
export const uid = () => crypto.randomUUID();
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export function makeLayer(
  type: Layer["type"],
  overrides: Partial<Layer> = {},
): Layer {
  return {
    id: uid(),
    name:
      type === "text"
        ? "New text"
        : type === "ellipse"
          ? "Ellipse"
          : type === "line"
            ? "Line"
            : type === "path"
              ? "Vector path"
              : "Rectangle",
    type,
    x: 320,
    y: 220,
    width: 200,
    height: 120,
    scaleX: 100,
    scaleY: 100,
    rotation: 0,
    opacity: 100,
    skewX: 0,
    fillOpacity: 100,
    strokeOpacity: 100,
    fillColor: 0x1769ff,
    strokeColor: 0x111827,
    pathProgress: 0,
    fill: type === "line" ? "none" : "#1769ff",
    stroke: "#111827",
    strokeWidth: type === "line" ? 2 : 0,
    radius: 16,
    text: "Your next idea",
    path: "M 0 100 L 100 0 L 200 100 Z",
    visible: true,
    locked: false,
    tracks: {},
    ...overrides,
  };
}
const frames = (values: [number, number][]): Keyframe[] =>
  values.map(([time, value]) => ({ id: uid(), time, value, easing: "ease" }));
export function initialScene(name = "Ideas in motion"): Scene {
  return {
    version: 1,
    name,
    width: 960,
    height: 600,
    background: "#ffffff",
    clip: true,
    duration: 12,
    layers: [
      makeLayer("text", {
        name: "Headline",
        text: "Make ideas move.",
        x: 110,
        y: 235,
        width: 740,
        height: 82,
        fill: "#131720",
        tracks: {
          y: frames([
            [0, 265],
            [1.5, 235],
            [9, 235],
            [12, 265],
          ]),
          opacity: frames([
            [0, 0],
            [1, 100],
            [10, 100],
            [12, 0],
          ]),
        },
      }),
      makeLayer("text", {
        name: "Supporting text",
        text: "A little motion. A new perspective.",
        x: 114,
        y: 340,
        width: 700,
        height: 27,
        fill: "#7a8394",
        tracks: {
          opacity: frames([
            [0, 0],
            [1.5, 100],
            [10, 100],
            [12, 0],
          ]),
        },
      }),
      makeLayer("rect", {
        name: "Blue accent",
        x: 115,
        y: 205,
        width: 58,
        height: 7,
        radius: 3,
        tracks: {
          width: frames([
            [0, 12],
            [2, 58],
            [10, 58],
            [12, 12],
          ]),
        },
      }),
      makeLayer("ellipse", {
        name: "Orbit",
        x: 744,
        y: 100,
        width: 54,
        height: 54,
        fill: "#e8f0ff",
        tracks: {
          y: frames([
            [0, 100],
            [6, 145],
            [12, 100],
          ]),
        },
      }),
    ],
  };
}
const sortedTracks = new WeakMap<Keyframe[], Keyframe[]>();
const colorTracks = new WeakMap<Keyframe[], Keyframe[][]>();
export function interpolate(
  frames: Keyframe[] | undefined,
  time: number,
  fallback: number,
): number {
  if (!frames?.length) return fallback;
  let sorted = sortedTracks.get(frames);
  if (!sorted) {
    sorted = [...frames].sort((a, b) => a.time - b.time);
    sortedTracks.set(frames, sorted);
  }
  if (time <= sorted[0].time) return sorted[0].value;
  let low = 1,
    high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid].time < time) low = mid + 1;
    else high = mid;
  }
  if (low < sorted.length) {
    const a = sorted[low - 1],
      b = sorted[low];
    if (Math.abs(time - b.time) < 1e-9) return b.value;
    let t = (time - a.time) / (b.time - a.time);
    if (a.easing === "hold") t = 0;
    if (a.easing === "ease") t = t * t * (3 - 2 * t);
    return a.value + (b.value - a.value) * t;
  }
  return sorted[sorted.length - 1].value;
}
export function evaluate(layer: Layer, time: number): Layer {
  const result = { ...layer };
  for (const prop of properties)
    result[prop] = interpolate(layer.tracks[prop], time, layer[prop]);
  for (const paint of ["fill", "stroke"] as const) {
    const keys = layer.tracks[`${paint}Color`];
    if (keys?.length) {
      let tracks = colorTracks.get(keys);
      if (!tracks) {
        tracks = [16, 8, 0].map((shift) =>
          keys.map((k) => ({ ...k, value: (k.value >> shift) & 255 })),
        );
        colorTracks.set(keys, tracks);
      }
      const channels = tracks.map((track) =>
        Math.round(clamp(interpolate(track, time, 0), 0, 255)),
      );
      result[paint] =
        "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("");
      result[`${paint}Color`] = parseInt(result[paint].slice(1), 16);
    }
  }
  if (layer.pathData?.length) {
    const index = clamp(result.pathProgress, 0, layer.pathData.length - 1);
    const a = layer.pathData[Math.floor(index)],
      b = layer.pathData[Math.ceil(index)];
    result.path = a
      .map((p, i) => pathString(blendPath(p, b[i] ?? p, index % 1)))
      .join(" ");
  }
  if (time < (layer.startTime ?? 0) || time >= (layer.endTime ?? Infinity))
    result.opacity = 0;
  if (layer.media) result.frameImage = mediaFrameAt(layer.media, time - (layer.startTime ?? 0))?.image;
  return result;
}
export type BezierPath = {
  v: number[][];
  i: number[][];
  o: number[][];
  c: boolean;
};
export function blendPath(a: BezierPath, b: BezierPath, t: number): BezierPath {
  if (a.v.length !== b.v.length) return t < 1 ? a : b;
  const mix = (key: "v" | "i" | "o") =>
    a[key].map((p, j) => p.map((n, k) => n + (b[key][j][k] - n) * t));
  return { v: mix("v"), i: mix("i"), o: mix("o"), c: a.c };
}
export function pathString(p: BezierPath): string {
  if (!p.v.length) return "";
  let d = `M ${p.v[0].join(" ")}`;
  for (let j = 1; j < p.v.length + (p.c ? 1 : 0); j++) {
    const a = (j - 1) % p.v.length,
      b = j % p.v.length;
    d += ` C ${p.v[a].map((n, k) => n + p.o[a][k]).join(" ")} ${p.v[b].map((n, k) => n + p.i[b][k]).join(" ")} ${p.v[b].join(" ")}`;
  }
  return d + (p.c ? " Z" : "");
}
export function setProperty(
  layer: Layer,
  property: Property,
  value: number,
  time: number,
  autoKey: boolean,
): Layer {
  if (!autoKey && !layer.tracks[property]?.length)
    return { ...layer, [property]: value };
  const frames = [...(layer.tracks[property] || [])];
  const existing = frames.find((k) => Math.abs(k.time - time) < 1e-9);
  if (existing) frames[frames.indexOf(existing)] = { ...existing, value };
  else frames.push({ id: uid(), time, value, easing: "linear" });
  return {
    ...layer,
    tracks: {
      ...layer.tracks,
      [property]: frames.sort((a, b) => a.time - b.time),
    },
  };
}
