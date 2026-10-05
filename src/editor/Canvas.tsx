import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import LottieCanvas from "./LottieCanvas";
import { clamp, evaluate, type Layer, type Scene } from "./model";
import { frameIsActive } from './vectorize';

import {
  drawLayer,
  fitZoom,
  localToWorld,
  penLayer,
  resizeLayer,
  rotateLayer,
  type PenNode,
  type Point,
} from "./geometry";

export function Shape({ layer: l }: { layer: Layer }) {
  if (l.type === "media") return l.frameImage ? <image href={l.frameImage} width={l.width} height={l.height} preserveAspectRatio="none" /> : null;
  const style = {
    fill: l.fill,
    stroke: l.stroke,
    strokeWidth: l.strokeWidth,
    fillOpacity: l.fillOpacity / 100,
    strokeOpacity: l.strokeOpacity / 100,
    fillRule: l.fillRule,
    strokeLinecap: l.lineCap,
    strokeLinejoin: l.lineJoin,
  };
  if (l.type === "line")
    return <line x1={0} y1={0} x2={l.width} y2={0} {...style} />;
  if (l.type === "rect")
    return <rect width={l.width} height={l.height} rx={l.radius} {...style} />;
  if (l.type === "ellipse")
    return (
      <ellipse
        cx={l.width / 2}
        cy={l.height / 2}
        rx={l.width / 2}
        ry={l.height / 2}
        {...style}
      />
    );
  if (l.type === "text")
    return (
      <text
        y={l.height * 0.82}
        fontSize={l.height}
        textLength={l.width}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        {...style}
      >
        {l.text}
      </text>
    );
  return (
    <svg
      width={l.width}
      height={l.height}
      viewBox={l.pathViewBox || "0 0 200 100"}
      preserveAspectRatio="none"
      overflow="visible"
    >
      <path d={l.path} {...style} />
    </svg>
  );
}
type Props = {
  mediaSelection?: { layer: string; frame: string; time: number } | null;
  scene: Scene;
  onDiagnostic?: (id: string, property: string, message: string) => void;
  time: number;
  selected: string | null;
  select: (id: string | null) => void;
  zoom: number;
  setZoom: (n: number) => void;
  tool: string;
  preview: boolean;
  begin: () => void;
  change: (id: string, values: Partial<Layer>) => void;
  create: (layer: Layer) => void;
  stop: () => void;
  add: (type: Layer["type"], x: number, y: number) => void;
};
type Gesture = {
  mode: "pan" | "move" | "resize" | "rotate" | "draw" | "pen" | "lineEnd";
  pointer: number;
  start: Point;
  screen: Point;
  pan: Point;
  layer?: Layer;
  handle?: string;
  type?: "rect" | "ellipse" | "line";
  changed: boolean;
};
const transform = (l: Layer) =>
  `translate(${l.x} ${l.y}) rotate(${l.rotation}) skewX(${l.skewX || 0}) scale(${l.scaleX / 100} ${l.scaleY / 100})`;
export default function Canvas(p: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Gesture | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [draft, setDraft] = useState<Layer | null>(null);
  const [nodes, setNodes] = useState<PenNode[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const latest = useRef(p);
  latest.current = p;
  const point = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / p.zoom,
      y: (e.clientY - r.top) / p.zoom,
    };
  };
  const fit = () => {
    const r = stage.current?.getBoundingClientRect();
    if (r) {
      setPan({ x: 0, y: 0 });
      p.setZoom(fitZoom(r.width, r.height, p.scene.width, p.scene.height));
    }
  };
  useEffect(() => {
    fit();
    const element = stage.current;
    if (!element) return;
    if (!window.ResizeObserver) {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const observer = new window.ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [p.scene.width, p.scene.height]);
  useEffect(() => {
    const element = stage.current;
    const prevent = (event: Event) => event.preventDefault();
    element?.addEventListener("wheel", prevent, { passive: false });
    return () => element?.removeEventListener("wheel", prevent);
  }, []);
  const finishPen = (closed = false) => {
    const points = nodesRef.current;
    if (points.length >= 2) latest.current.create(penLayer(points, closed));
    setNodes([]);
    nodesRef.current = [];
    setDraft(null);
    drag.current = null;
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === "Enter" && nodesRef.current.length) {
        e.preventDefault();
        finishPen();
      }
      if (e.key === "Escape") {
        setNodes([]);
        nodesRef.current = [];
        setDraft(null);
        drag.current = null;
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    setNodes([]);
    nodesRef.current = [];
    setDraft(null);
    drag.current = null;
  }, [p.tool, p.preview]);
  const start = (e: PointerEvent, id?: string, handle?: string) => {
    if (p.preview || (e.button !== 0 && e.button !== 1)) return;
    e.stopPropagation();
    e.preventDefault();
    const pos = point(e);
    const base: Gesture = {
      mode: "move",
      pointer: e.pointerId,
      start: pos,
      screen: { x: e.clientX, y: e.clientY },
      pan,
      changed: false,
    };
    if (e.button === 1 || p.tool === "hand")
      drag.current = { ...base, mode: "pan" };
    else if (id && ["select", "move"].includes(p.tool)) {
      p.select(id);
      p.stop();
      const l = p.scene.layers.find((item) => item.id === id)!;
      if (l.locked) return;
      drag.current = {
        ...base,
        layer: evaluate(l, p.time),
        handle,
        mode:
          handle === "rotate"
            ? "rotate"
            : handle === "lineEnd"
              ? "lineEnd"
              : handle
                ? "resize"
                : "move",
      };
    } else if (["rect", "ellipse", "line"].includes(p.tool)) {
      p.stop();
      const type = p.tool as "rect" | "ellipse" | "line";
      drag.current = { ...base, mode: "draw", type };
      const l = drawLayer(type, pos, pos);
      setDraft(l);
      draftRef.current = l;
    } else if (p.tool === "path") {
      p.stop();
      const current = nodesRef.current;
      if (
        current.length > 2 &&
        Math.hypot(pos.x - current[0].x, pos.y - current[0].y) * p.zoom < 10
      ) {
        finishPen(true);
        return;
      }
      if (
        current.length > 1 &&
        Math.hypot(
          pos.x - current[current.length - 1].x,
          pos.y - current[current.length - 1].y,
        ) *
          p.zoom <
          2
      ) {
        finishPen();
        return;
      }
      if (e.detail > 1) {
        finishPen();
        return;
      }
      const next = [...current, { ...pos, dx: 0, dy: 0 }];
      setNodes(next);
      nodesRef.current = next;
      drag.current = { ...base, mode: "pen" };
    } else if (p.tool === "text") {
      p.stop();
      p.add("text", pos.x, pos.y);
    } else p.select(null);
    stage.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const end = point(e);
    const delta = { x: end.x - d.start.x, y: end.y - d.start.y };
    if (d.mode === "pan") {
      setPan({
        x: d.pan.x + e.clientX - d.screen.x,
        y: d.pan.y + e.clientY - d.screen.y,
      });
      return;
    }
    if (d.mode === "draw") {
      const l = drawLayer(d.type!, d.start, end, e.shiftKey);
      setDraft(l);
      draftRef.current = l;
      d.changed = true;
      return;
    }
    if (d.mode === "pen") {
      const next = nodesRef.current.map((n, i, all) =>
        i === all.length - 1 ? { ...n, dx: delta.x, dy: delta.y } : n,
      );
      setNodes(next);
      nodesRef.current = next;
      return;
    }
    if (
      !d.layer ||
      (Math.hypot(e.clientX - d.screen.x, e.clientY - d.screen.y) < 2 &&
        !d.changed)
    )
      return;
    if (!d.changed) {
      p.begin();
      d.changed = true;
    }
    const l = d.layer;
    let changes: Partial<Layer>;
    if (d.mode === "rotate") changes = rotateLayer(l, d.start, end, e.shiftKey);
    else if (d.mode === "resize") changes = resizeLayer(l, delta, d.handle!);
    else if (d.mode === "lineEnd") {
      const angle = (Math.atan2(end.y - l.y, end.x - l.x) * 180) / Math.PI;
      changes = {
        width: Math.max(
          1,
          Math.hypot(end.x - l.x, end.y - l.y) / (l.scaleX / 100 || 0.000001),
        ),
        rotation: e.shiftKey ? Math.round(angle / 15) * 15 : angle,
      };
    } else changes = { x: l.x + delta.x, y: l.y + delta.y };
    p.change(l.id, changes);
  };
  const end = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (d.mode === "draw" && draftRef.current && d.changed)
      p.create(draftRef.current);
    drag.current = null;
    setDraft(null);
    draftRef.current = null;
    if (stage.current?.hasPointerCapture(e.pointerId))
      stage.current.releasePointerCapture(e.pointerId);
  };
  const selected = p.scene.layers.find((l) => l.id === p.selected);
  const l = selected && evaluate(selected, p.time);
  const drawingPath = nodes.length > 1 ? penLayer(nodes, false) : null;
  const handles: [string, number, number][] = l
    ? [
        ["nw", 0, 0],
        ["n", l.width / 2, 0],
        ["ne", l.width, 0],
        ["e", l.width, l.height / 2],
        ["se", l.width, l.height],
        ["s", l.width / 2, l.height],
        ["sw", 0, l.height],
        ["w", 0, l.height / 2],
      ]
    : [];
  return (
    <div
      ref={stage}
      className={`ke-stage ${p.tool === "hand" ? "panning" : ""}`}
      onPointerDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (p.tool === "hand" || e.button === 1)
        )
          start(e);
        else if (
          e.target === e.currentTarget &&
          ["select", "move"].includes(p.tool)
        )
          p.select(null);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        drag.current = null;
        setDraft(null);
      }}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          const zoom = clamp(p.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.1, 3);
          const r = stage.current!.getBoundingClientRect();
          const cx = e.clientX - r.left - r.width / 2,
            cy = e.clientY - r.top - (r.height - 20) / 2;
          setPan({
            x: cx - ((cx - pan.x) * zoom) / p.zoom,
            y: cy - ((cy - pan.y) * zoom) / p.zoom,
          });
          p.setZoom(zoom);
        } else setPan((v) => ({ x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }}
    >
      <div
        className={`ke-artboard ${p.preview ? "preview" : ""}`}
        style={{
          width: p.scene.width * p.zoom,
          height: p.scene.height * p.zoom,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
      >
        {!p.preview && (
          <div className="ke-frame-label" onClick={() => p.select(null)}>
            {p.scene.name}
            <span>Scene 01</span>
          </div>
        )}
        <svg
          ref={svg}
          aria-label="Animation canvas"
          width="100%"
          height="100%"
          viewBox={`0 0 ${p.scene.width} ${p.scene.height}`}
          style={{
            background: p.scene.background,
            overflow: p.scene.clip ? "hidden" : "visible",
            cursor: ["rect", "ellipse", "line", "path"].includes(p.tool)
              ? "crosshair"
              : p.tool === "text"
                ? "text"
                : undefined,
          }}
          onPointerDown={(e) => {
            if (p.scene.lottie) {
              const id = (e.target as Element)
                .closest("[data-layer]")
                ?.getAttribute("data-layer");
              if (id && p.scene.layers.some((l) => l.id === id)) {
                start(e, id);
                return;
              }
            }
            start(e);
          }}
          onDoubleClick={(e) => {
            if (p.tool === "path") {
              e.preventDefault();
              finishPen();
            }
          }}
        >
          {p.scene.lottie && (
            <LottieCanvas
              scene={p.scene}
              time={p.time}
              onDiagnostic={p.onDiagnostic}
            />
          )}
          {[...(p.scene.lottie ? [] : p.scene.layers)]
            .reverse()
            .filter((item) => item.visible && frameIsActive(p.scene, item, p.time, p.mediaSelection))
            .map((item) => {
              const evaluated = evaluate(item, p.time);
              if (item.media && p.mediaSelection?.layer === item.id && p.mediaSelection.time === p.time) {
                const frame = item.media.frames.find(f => f.id === p.mediaSelection!.frame);
                if (frame) { evaluated.frameImage = frame.vector?.status === 'ready' ? undefined : frame.image; evaluated.opacity = evaluate({ ...item, startTime: undefined, endTime: undefined }, p.time).opacity; }
              }
              if (item.sourceFrame && frameIsActive(p.scene, item, p.time, p.mediaSelection)) evaluated.opacity = evaluate({ ...item, startTime: undefined, endTime: undefined }, p.time).opacity;
              return (
                <g
                  key={item.id}
                  data-layer={item.id}
                  transform={transform(evaluated)}
                  opacity={evaluated.opacity / 100}
                  onPointerDown={(e) => {
                    if (
                      ["select", "move", "hand"].includes(p.tool) ||
                      e.button === 1
                    )
                      start(e, item.id);
                  }}
                  onDoubleClick={() => {
                    if (
                      item.type === "text" &&
                      !item.locked &&
                      ["select", "move"].includes(p.tool)
                    )
                      (
                        document.querySelector(
                          '[aria-label="Text content"]',
                        ) as HTMLTextAreaElement | null
                      )?.focus();
                  }}
                  style={{
                    cursor: ["select", "move"].includes(p.tool)
                      ? item.locked
                        ? "not-allowed"
                        : "move"
                      : undefined,
                  }}
                >
                  <Shape layer={evaluated} />
                  {item.type === "line" && (
                    <line
                      x1={0}
                      y1={0}
                      x2={evaluated.width}
                      y2={0}
                      stroke="transparent"
                      strokeWidth={Math.max(12 / p.zoom, evaluated.strokeWidth)}
                      pointerEvents="stroke"
                    />
                  )}
                </g>
              );
            })}
          {draft && (
            <g transform={transform(draft)} opacity={0.65} pointerEvents="none">
              <Shape layer={draft} />
            </g>
          )}
          {drawingPath && (
            <g transform={transform(drawingPath)} pointerEvents="none">
              <Shape layer={drawingPath} />
            </g>
          )}
          {nodes.map((n, i) => (
            <g key={i} pointerEvents="none">
              <line
                x1={n.x - n.dx}
                y1={n.y - n.dy}
                x2={n.x + n.dx}
                y2={n.y + n.dy}
                stroke="#087bff"
                strokeWidth={1 / p.zoom}
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={4 / p.zoom}
                fill="white"
                stroke="#087bff"
                strokeWidth={1 / p.zoom}
              />
            </g>
          ))}
        </svg>
        {!p.preview && l?.visible && ["select", "move"].includes(p.tool) && (
          <svg
            aria-label="Selection handles"
            viewBox={`0 0 ${p.scene.width} ${p.scene.height}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <g transform={transform(l)}>
              <rect
                width={l.width}
                height={l.height}
                fill="none"
                stroke="#087bff"
                strokeWidth={1 / p.zoom}
                vectorEffect="non-scaling-stroke"
              />
            </g>
            {!l.locked && (
              <>
                {(l.type === "line"
                  ? [["lineEnd", l.width, 0] as [string, number, number]]
                  : handles
                ).map(([name, x, y]) => {
                  const pt = localToWorld(l, { x, y });
                  return (
                    <rect
                      key={name}
                      aria-label={`Resize ${name}`}
                      x={pt.x - 4 / p.zoom}
                      y={pt.y - 4 / p.zoom}
                      width={8 / p.zoom}
                      height={8 / p.zoom}
                      fill="white"
                      stroke="#087bff"
                      strokeWidth={1 / p.zoom}
                      style={{
                        pointerEvents: "all",
                        cursor:
                          name === "lineEnd" ? "crosshair" : `${name}-resize`,
                      }}
                      onPointerDown={(e) => start(e, l.id, name)}
                    />
                  );
                })}
                {(() => {
                  const top = localToWorld(l, { x: l.width / 2, y: 0 });
                  const handle = localToWorld(l, {
                    x: l.width / 2,
                    y: -28 / p.zoom / (l.scaleY / 100 || 1),
                  });
                  return (
                    <>
                      <line
                        x1={top.x}
                        y1={top.y}
                        x2={handle.x}
                        y2={handle.y}
                        stroke="#087bff"
                        strokeWidth={1 / p.zoom}
                      />
                      <circle
                        aria-label="Rotate object"
                        cx={handle.x}
                        cy={handle.y}
                        r={5 / p.zoom}
                        fill="white"
                        stroke="#087bff"
                        strokeWidth={1 / p.zoom}
                        style={{ pointerEvents: "all", cursor: "grab" }}
                        onPointerDown={(e) => start(e, l.id, "rotate")}
                      />
                    </>
                  );
                })()}
              </>
            )}
          </svg>
        )}
      </div>
      <button className="ke-reset-view" onClick={fit}>
        Fit canvas
      </button>
      {nodes.length > 0 && (
        <div className="ke-pen-help" role="status">
          Click for points · drag for curves · Enter to finish · click first
          point to close · Esc to cancel
        </div>
      )}
    </div>
  );
}
