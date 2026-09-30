import {
  evaluate,
  makeLayer,
  properties,
  type Layer,
  type Scene,
} from "./model";

export function validateScene(value: unknown): Scene {
  const raw = value as Scene;
  const s =
    raw && Array.isArray(raw.layers)
      ? {
          ...raw,
          layers: raw.layers.map(
            (l) =>
              l && {
                ...makeLayer(l.type),
                ...l,
                scaleX: l.scaleX ?? 100,
                scaleY: l.scaleY ?? 100,
              },
          ),
        }
      : raw;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  if (
    !s ||
    s.version !== 1 ||
    typeof s.name !== "string" ||
    !finite(s.width) ||
    s.width < 1 ||
    s.width > 8192 ||
    !finite(s.height) ||
    s.height < 1 ||
    s.height > 8192 ||
    !finite(s.duration) ||
    s.duration <= 0 ||
    s.duration > 600 ||
    (s.fps !== undefined && (!finite(s.fps) || s.fps <= 0 || s.fps > 240)) ||
    (s.frameStart !== undefined && !finite(s.frameStart)) ||
    !(s.background === "transparent" || /^#[0-9a-f]{6}$/i.test(s.background)) ||
    typeof s.clip !== "boolean" ||
    !Array.isArray(s.layers) ||
    s.layers.length > (s.lottie ? 10000 : 500)
  )
    throw new Error("Choose a valid Kinetic project (up to 500 layers).");
  const ids = new Set<string>();
  for (const l of s.layers) {
    if (
      l?.pathViewBox !== undefined &&
      (typeof l.pathViewBox !== "string" ||
        !/^[\d.eE+\-\s]+$/.test(l.pathViewBox))
    )
      throw new Error("Invalid vector coordinate system.");
    if (
      !l ||
      typeof l.id !== "string" ||
      ids.has(l.id) ||
      typeof l.name !== "string" ||
      ![
        "rect",
        "ellipse",
        "path",
        "text",
        "line",
        "lottie",
        "unsupported",
        "media",
      ].includes(l.type) ||
      !properties.every((p) => finite(l[p])) ||
      l.width <= 0 ||
      l.height <= 0 ||
      l.opacity < 0 ||
      l.opacity > 100 ||
      !finite(l.radius) ||
      !finite(l.strokeWidth) ||
      typeof l.text !== "string" ||
      typeof l.path !== "string" ||
      typeof l.fill !== "string" ||
      typeof l.stroke !== "string" ||
      typeof l.locked !== "boolean" ||
      typeof l.visible !== "boolean" ||
      !l.tracks ||
      typeof l.tracks !== "object"
    )
      throw new Error("The project contains an invalid layer.");
    if (
      l.lottie &&
      (!l.lottie.source ||
        typeof l.lottie.source !== "object" ||
        !l.lottie.baseline ||
        !l.lottie.clock ||
        !finite(l.lottie.clock.offset) ||
        !finite(l.lottie.clock.rate) ||
        !["layer", "shape", "mask", "issue"].includes(l.lottie.kind))
    )
      throw new Error("Invalid retained Lottie node.");
    ids.add(l.id);
    if (l.type === "media") {
      const m = l.media;
      if (!m || !["video", "gif"].includes(m.kind) || !finite(m.duration) || m.duration < 0 || m.duration > 10 || !finite(m.width) || !finite(m.height) || m.width <= 0 || m.height <= 0 || m.width > 8192 || m.height > 8192 || !/^\d+\/[1-9]\d*$/.test(m.timeBase) || !Array.isArray(m.frames) || !m.frames.length || m.width * m.height * m.frames.length > 128 * 1024 * 1024)
        throw new Error("Invalid source media sequence.");
      const frameIds = new Set<string>();
      for (let i = 0; i < m.frames.length; i++) {
        const f = m.frames[i];
        if (!f || typeof f.id !== "string" || frameIds.has(f.id) || f.number !== i + 1 || !finite(f.timestamp) || f.timestamp < 0 || !finite(f.duration) || f.duration < 0 || f.timestamp + f.duration > m.duration + 1e-9 || (i > 0 && f.timestamp < m.frames[i-1].timestamp) || !/^-?\d+$/.test(f.pts) || !/^\d+$/.test(f.durationTicks) || typeof f.image !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(f.image))
          throw new Error(`Invalid source frame ${i + 1}.`);
        frameIds.add(f.id);
      }
    }
    if ([l.startTime, l.endTime].some((v) => v !== undefined && !finite(v)))
      throw new Error("Invalid layer timing.");
    if (
      l.pathData &&
      (!Array.isArray(l.pathData) ||
        l.pathData.length > 36001 ||
        l.pathData.some(
          (paths) =>
            !Array.isArray(paths) ||
            paths.some(
              (p) =>
                !p ||
                typeof p.c !== "boolean" ||
                !Array.isArray(p.v) ||
                p.v.length > 10000 ||
                ![p.v, p.i, p.o].every(
                  (points) =>
                    Array.isArray(points) &&
                    points.length === p.v.length &&
                    points.every(
                      (point) =>
                        Array.isArray(point) &&
                        point.length === 2 &&
                        point.every(finite),
                    ),
                ),
            ),
        ))
    )
      throw new Error("Invalid animated path.");
    for (const [prop, keys] of Object.entries(l.tracks)) {
      if (
        !properties.includes(prop as (typeof properties)[number]) ||
        !Array.isArray(keys) ||
        keys.length > 36001
      )
        throw new Error("Invalid animation track.");
      const times = new Set<number>();
      for (const k of keys) {
        if (
          !k ||
          typeof k.id !== "string" ||
          !finite(k.time) ||
          k.time < 0 ||
          k.time > s.duration ||
          !finite(k.value) ||
          !["linear", "ease", "hold"].includes(k.easing) ||
          times.has(k.time)
        )
          throw new Error("Invalid or duplicate keyframe.");
        times.add(k.time);
      }
    }
  }
  if (s.lottie) {
    if (
      !s.lottie.header ||
      !Array.isArray(s.lottie.assets) ||
      !Array.isArray(s.lottie.diagnostics)
    )
      throw new Error("Invalid retained Lottie document.");
    for (const l of s.layers)
      if (l.lottie?.parentId && !ids.has(l.lottie.parentId))
        throw new Error("Missing Lottie hierarchy parent.");
  }
  return s;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Sample the same interpolation engine used by the canvas for portable SVG playback. */
export function exportSceneSvg(
  scene: Scene,
  time: number,
  animated: boolean,
): string {
  if (scene.lottie)
    throw new Error(
      "Use the retained Lottie SVG renderer to export this scene.",
    );
  const count = Math.min(36000, Math.ceil(scene.duration * (scene.fps ?? 60)));
  const times = Array.from(
    { length: count + 1 },
    (_, i) => (i / count) * scene.duration,
  );
  const attrs = `dur="${scene.duration}s" repeatCount="indefinite" calcMode="linear"`;
  const output = scene.layers
    .filter((l) => l.visible)
    .reverse()
    .map((layer) => {
      const timedLayer = animated
        ? { ...layer, startTime: undefined, endTime: undefined }
        : layer;
      const l = evaluate(timedLayer, animated ? 0 : time);
      const samples = animated ? times.map((t) => evaluate(timedLayer, t)) : [];
      const inPoint = Math.max(
        0,
        Math.min(scene.duration, layer.startTime ?? 0),
      );
      const outPoint = Math.max(
        inPoint,
        Math.min(scene.duration, layer.endTime ?? scene.duration),
      );
      const visibilityTimes = [
        ...new Set([0, inPoint, outPoint, scene.duration]),
      ].sort((a, b) => a - b);
      const visibility =
        animated &&
        (layer.startTime !== undefined || layer.endTime !== undefined)
          ? `<animate attributeName="visibility" dur="${scene.duration}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${visibilityTimes.map((t) => t / scene.duration).join(";")}" values="${visibilityTimes.map((t) => (t >= inPoint && t < outPoint ? "visible" : "hidden")).join(";")}"/>`
          : "";
      const anim = (attribute: string, read: (v: Layer) => number) =>
        animated
          ? `<animate attributeName="${attribute}" values="${samples.map((v) => n(read(v))).join(";")}" ${attrs}/>`
          : "";
      const transform = (type: string, read: (v: Layer) => string) =>
        animated
          ? `<animateTransform attributeName="transform" type="${type}" values="${samples.map(read).join(";")}" ${attrs}/>`
          : "";
      const paint = `fill="${escape(l.fill)}" stroke="${escape(l.stroke)}" stroke-width="${l.strokeWidth}" fill-opacity="${l.fillOpacity / 100}" stroke-opacity="${l.strokeOpacity / 100}" fill-rule="${l.fillRule === "evenodd" ? "evenodd" : "nonzero"}"`;
      let shape: string;
      if (l.type === "media" && l.media) {
        const image = (href: string) => `<image href="${escape(href)}" width="${n(l.width)}" height="${n(l.height)}" preserveAspectRatio="none"/>`;
        shape = animated ? l.media.frames.map(f => {
          const start = Math.max(0, (l.startTime ?? 0) + f.timestamp), end = Math.min(scene.duration, start + f.duration);
          if (end <= start) return "";
          const points = [...new Set([0,start,end,scene.duration])].sort((a,b)=>a-b);
          return `<g visibility="hidden"><animate attributeName="visibility" dur="${scene.duration}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${points.map(t=>t/scene.duration).join(';')}" values="${points.map(t=>t>=start && t<end ? 'visible' : 'hidden').join(';')}"/>${image(f.image)}</g>`;
        }).join('') : l.frameImage ? image(l.frameImage) : '';
      } else if (l.type === "line")
        shape = `<line x1="0" y1="0" x2="${n(l.width)}" y2="0" ${paint}>${anim("x2", (v) => v.width)}</line>`;
      else if (l.type === "rect")
        shape = `<rect width="${n(l.width)}" height="${n(l.height)}" rx="${n(l.radius)}" ${paint}>${anim("width", (v) => v.width)}${anim("height", (v) => v.height)}</rect>`;
      else if (l.type === "ellipse")
        shape = `<ellipse cx="${n(l.width / 2)}" cy="${n(l.height / 2)}" rx="${n(l.width / 2)}" ry="${n(l.height / 2)}" ${paint}>${anim("cx", (v) => v.width / 2)}${anim("cy", (v) => v.height / 2)}${anim("rx", (v) => v.width / 2)}${anim("ry", (v) => v.height / 2)}</ellipse>`;
      else if (l.type === "text")
        shape = `<text y="${n(l.height * 0.82)}" font-size="${n(l.height)}" font-family="Arial,sans-serif" font-weight="700" textLength="${n(l.width)}" lengthAdjust="spacingAndGlyphs" ${paint}>${escape(l.text)}${anim("textLength", (v) => v.width)}${anim("y", (v) => v.height * 0.82)}${anim("font-size", (v) => v.height)}</text>`;
      else
        shape = `<svg width="${n(l.width)}" height="${n(l.height)}" viewBox="${escape(l.pathViewBox || "0 0 200 100")}" preserveAspectRatio="none" overflow="visible">${anim("width", (v) => v.width)}${anim("height", (v) => v.height)}<path d="${escape(l.path)}" ${paint}/></svg>`;
      const paintAnimations = animated
        ? [
            "fill",
            "stroke",
            "path",
            "radius",
            "strokeWidth",
            "fillOpacity",
            "strokeOpacity",
          ]
            .map((prop) => {
              const attr =
                (
                  {
                    path: "d",
                    radius: "rx",
                    strokeWidth: "stroke-width",
                    fillOpacity: "fill-opacity",
                    strokeOpacity: "stroke-opacity",
                  } as Record<string, string>
                )[prop] || prop;
              const values = samples.map((v) => {
                const val = v[prop as keyof Layer];
                return escape(
                  String(prop.endsWith("Opacity") ? Number(val) / 100 : val),
                );
              });
              if (
                (prop === "path" && l.type !== "path") ||
                (prop === "radius" && l.type !== "rect")
              )
                return "";
              return `<animate attributeName="${attr}" values="${values.join(";")}" ${attrs}/>`;
            })
            .join("")
        : "";
      shape = shape
        .replace(/<\/(rect|ellipse|line|text|path)>/, `${paintAnimations}</$1>`)
        .replace(/<path ([^>]+)\/>/, `<path $1>${paintAnimations}</path>`);
      return `<g transform="translate(${n(l.x)} ${n(l.y)})" opacity="${n(l.opacity / 100)}">${transform("translate", (v) => `${n(v.x)} ${n(v.y)}`)}${anim("opacity", (v) => v.opacity / 100)}${visibility}<g transform="rotate(${n(l.rotation)})">${transform("rotate", (v) => n(v.rotation))}<g transform="skewX(${n(l.skewX)})">${transform("skewX", (v) => n(v.skewX))}${`<g transform="scale(${n(l.scaleX / 100)} ${n(l.scaleY / 100)})">${transform("scale", (v) => `${n(v.scaleX / 100)} ${n(v.scaleY / 100)}`)}${shape}</g>`}</g></g></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" overflow="${scene.clip ? "hidden" : "visible"}"><title>${escape(scene.name)}</title><rect width="100%" height="100%" fill="${escape(scene.background)}"/>${output}</svg>`;
}
