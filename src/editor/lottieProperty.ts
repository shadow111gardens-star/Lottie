import { blendPath } from "./model";
type Node = Record<string, any>;
const num = (v: any, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const channel = (p: any, i: number, fallback: number) =>
  num(Array.isArray(p) ? (p[i] ?? p[0]) : p, fallback);
function ease(k: Node, t: number, component: number): number {
  if (k.h === 1) return 0;
  if (!k.o || !k.i) return t;
  const x1 = channel(k.o.x, component, 0),
    y1 = channel(k.o.y, component, 0);
  const x2 = channel(k.i.x, component, 1),
    y2 = channel(k.i.y, component, 1);
  if (x1 === y1 && x2 === y2) return t;
  const bezier = (u: number, a: number, b: number) =>
    3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  let lo = 0,
    hi = 1;
  for (let j = 0; j < 30; j++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, x1, x2) < t) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, y1, y2);
}
/** Temporal cubic easing, per-component easing, holds and spatial Beziers. */
export function readLottieProperty(p: any, frame: number, fallback: any): any {
  if (!p || p.k === undefined) return fallback;
  if (p.a !== 1 && !(Array.isArray(p.k) && p.k[0]?.t !== undefined)) return p.k;
  const keys: Node[] = p.k;
  if (!Array.isArray(keys) || !keys.length) return fallback;
  let j = 0;
  while (j + 1 < keys.length && frame >= keys[j + 1].t) j++;
  const k = keys[j],
    next = keys[j + 1];
  const a = k.s ?? keys[j - 1]?.e ?? keys[j - 1]?.s ?? fallback;
  if (!next || frame <= k.t || k.h === 1) return a;
  const b = next.s ?? k.e ?? a;
  const t = Math.max(0, Math.min(1, (frame - k.t) / (next.t - k.t)));
  if (Array.isArray(a) && a[0]?.v)
    return [blendPath(a[0], b[0] ?? a[0], ease(k, t, 0))];
  if (Array.isArray(a)) {
    if (k.to && k.ti && Array.isArray(b)) {
      // Spatial curves are traversed by arc length, as in standard Lottie players.
      const at = (u: number) =>
        a.map(
          (n: number, c: number) =>
            (1 - u) ** 3 * n +
            3 * (1 - u) ** 2 * u * (n + num(k.to[c])) +
            3 * (1 - u) * u * u * (b[c] + num(k.ti[c])) +
            u ** 3 * b[c],
        );
      const points = Array.from({ length: 101 }, (_, i) => at(i / 100));
      const lengths = [0];
      for (let i = 1; i < points.length; i++)
        lengths.push(
          lengths[i - 1] +
            Math.hypot(
              ...points[i].map((n: number, c: number) => n - points[i - 1][c]),
            ),
        );
      const distance = ease(k, t, 0) * lengths[100];
      let index = 1;
      while (index < 100 && lengths[index] < distance) index++;
      const u =
        (index -
          1 +
          (distance - lengths[index - 1]) /
            (lengths[index] - lengths[index - 1] || 1)) /
        100;
      return at(u);
    }
    return a.map(
      (n: number, c: number) => n + (num(b[c], n) - n) * ease(k, t, c),
    );
  }
  return num(a) + (num(b, num(a)) - num(a)) * ease(k, t, 0);
}
