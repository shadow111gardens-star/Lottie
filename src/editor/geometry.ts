import { clamp, makeLayer, type Layer } from "./model";
export type Point = { x: number; y: number };
export type PenNode = Point & { dx: number; dy: number };
export function vector(point: Point, rotation: number): Point {
  const r = (rotation * Math.PI) / 180;
  return {
    x: point.x * Math.cos(r) - point.y * Math.sin(r),
    y: point.x * Math.sin(r) + point.y * Math.cos(r),
  };
}
export function localToWorld(l: Layer, p: Point): Point {
  const v = vector(
    {
      x:
        (p.x * l.scaleX) / 100 +
        (Math.tan(((l.skewX || 0) * Math.PI) / 180) * p.y * l.scaleY) / 100,
      y: (p.y * l.scaleY) / 100,
    },
    l.rotation,
  );
  return { x: l.x + v.x, y: l.y + v.y };
}
export function resizeLayer(
  l: Layer,
  delta: Point,
  handle: string,
): Partial<Layer> {
  const d = vector(delta, -l.rotation);
  const dx =
      (d.x - Math.tan(((l.skewX || 0) * Math.PI) / 180) * d.y) /
      (l.scaleX / 100 || 0.000001),
    dy = d.y / (l.scaleY / 100 || 0.000001);
  const left = handle.includes("w"),
    top = handle.includes("n");
  const width =
    handle.includes("w") || handle.includes("e")
      ? Math.max(1, l.width + (left ? -dx : dx))
      : l.width;
  const height =
    handle.includes("n") || handle.includes("s")
      ? Math.max(1, l.height + (top ? -dy : dy))
      : l.height;
  const origin = localToWorld(l, {
    x: left ? l.width - width : 0,
    y: top ? l.height - height : 0,
  });
  return { ...origin, width, height };
}
export function rotateLayer(
  l: Layer,
  start: Point,
  end: Point,
  snap = false,
): Partial<Layer> {
  const center = localToWorld(l, { x: l.width / 2, y: l.height / 2 });
  let rotation =
    l.rotation +
    ((Math.atan2(end.y - center.y, end.x - center.x) -
      Math.atan2(start.y - center.y, start.x - center.x)) *
      180) /
      Math.PI;
  if (snap) rotation = Math.round(rotation / 15) * 15;
  const offset = vector(
    {
      x:
        (l.width * l.scaleX) / 200 +
        (Math.tan(((l.skewX || 0) * Math.PI) / 180) * l.height * l.scaleY) /
          200,
      y: (l.height * l.scaleY) / 200,
    },
    rotation,
  );
  return { rotation, x: center.x - offset.x, y: center.y - offset.y };
}
export function drawLayer(
  type: "rect" | "ellipse" | "line",
  start: Point,
  end: Point,
  constrain = false,
): Layer {
  let dx = end.x - start.x,
    dy = end.y - start.y;
  if (type === "line") {
    let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (constrain) rotation = Math.round(rotation / 15) * 15;
    return makeLayer("line", {
      ...start,
      width: Math.max(1, Math.hypot(dx, dy)),
      height: 1,
      rotation,
    });
  }
  if (constrain) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  return makeLayer(type, {
    x: start.x + Math.min(0, dx),
    y: start.y + Math.min(0, dy),
    width: Math.max(1, Math.abs(dx)),
    height: Math.max(1, Math.abs(dy)),
  });
}
export function penLayer(nodes: PenNode[], closed: boolean): Layer {
  const all = nodes.flatMap((n) => [
    n,
    { x: n.x + n.dx, y: n.y + n.dy },
    { x: n.x - n.dx, y: n.y - n.dy },
  ]);
  const x = Math.min(...all.map((n) => n.x)),
    y = Math.min(...all.map((n) => n.y));
  const width = Math.max(1, Math.max(...all.map((n) => n.x)) - x),
    height = Math.max(1, Math.max(...all.map((n) => n.y)) - y);
  const p = (point: Point) => `${point.x - x} ${point.y - y}`;
  let path = `M ${p(nodes[0])}`;
  for (let i = 1; i < nodes.length + (closed ? 1 : 0); i++) {
    const a = nodes[i - 1],
      b = nodes[i % nodes.length];
    path +=
      a.dx || a.dy || b.dx || b.dy
        ? ` C ${p({ x: a.x + a.dx, y: a.y + a.dy })} ${p({ x: b.x - b.dx, y: b.y - b.dy })} ${p(b)}`
        : ` L ${p(b)}`;
  }
  if (closed) path += " Z";
  return makeLayer("path", {
    x,
    y,
    width,
    height,
    path,
    pathViewBox: `0 0 ${width} ${height}`,
    fill: closed ? "#1769ff" : "none",
    strokeWidth: 2,
  });
}
export const fitZoom = (
  width: number,
  height: number,
  sceneWidth: number,
  sceneHeight: number,
) =>
  clamp(
    Math.min((width - 100) / sceneWidth, (height - 120) / sceneHeight, 1),
    0.1,
    3,
  );
