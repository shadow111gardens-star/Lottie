import type { AnimationItem } from "lottie-web";
import type { Scene, LottieDiagnostic } from "./model";
import { exportLottie } from "./lottie";
import { prepareLottieRenderData } from "./lottieDocument";

type ObjectData = Record<string, any>;
export type RenderCoverage = {
  nodeId: string;
  sourcePath: string;
  layerType: number | string;
  shapeType?: string;
  name: string;
  rendered: boolean;
  role: string;
};
export type LottieRenderer = {
  player: AnimationItem;
  seek: (time: number) => void;
  destroy: () => void;
  coverage: () => RenderCoverage[];
};
export function auditLottieRendering(
  scene: Scene,
  player: AnimationItem,
): RenderCoverage[] {
  const objects = new Map<string, { object: any; elements: Element[] }>();
  const add = (
    data: any,
    object: any,
    elements: (Element | undefined | null)[],
  ) => {
    if (!data?._editorId || !object) return;
    const dom = elements.filter(
      (e): e is Element => !!e && typeof e.setAttribute === "function",
    );
    objects.set(data._editorId, { object, elements: dom });
    for (const el of dom) {
      if (!el.hasAttribute("data-layer"))
        el.setAttribute("data-layer", data._editorId);
      el.setAttribute("data-lottie-source", data.nm || data.ty || "node");
    }
  };
  const shapes = (data: any[], items: any[], container?: Element) => {
    for (let i = 0; i < (data?.length || 0); i++) {
      const s = data[i],
        item = items?.[i];
      add(s, item, [
        item?.gr,
        item?.style?.pElem,
        item?.transform?.container,
        ...(item?.styles || []).map((s: any) => s.pElem),
        ...(item?.shapes || []).flatMap((s: any) =>
          (s.shape?.styles || []).map((style: any) => style.pElem),
        ),
        container,
      ]);
      if (s.ty === "gr") shapes(s.it, item?.it, item?.gr);
    }
  };
  const composition = (elements: any[]) => {
    for (const element of elements || []) {
      if (!element || element === true) continue;
      add(element.data, element, [element.layerElement]);
      if (element.shapesData)
        shapes(element.shapesData, element.itemsData, element.layerElement);
      const masks = element.data.masksProperties || [];
      for (let i = 0; i < masks.length; i++)
        add(masks[i], element.maskManager?.viewData?.[i], [
          element.maskManager?.viewData?.[i]?.elem,
          element.maskManager?.maskElement,
        ]);
      if (element.elements) composition(element.elements);
    }
  };
  composition(player.renderer.elements);
  return scene.layers.map((l) => ({
    nodeId: l.id,
    sourcePath: l.lottie?.sourcePath || `editor:${l.id}`,
    layerType:
      l.lottie?.kind === "layer"
        ? l.lottie.source.ty
        : l.lottie?.kind || l.type,
    shapeType: l.lottie?.kind === "shape" ? l.lottie.source.ty : undefined,
    name: l.name,
    rendered: objects.has(l.id),
    role:
      l.lottie?.kind === "mask"
        ? "mask"
        : l.lottie?.source.ty === 3
          ? "transform parent"
          : l.lottie?.status === "unsupported"
            ? "visible placeholder"
            : "render object",
  }));
}
let playerModule: Promise<typeof import("lottie-web")> | undefined;
function engine() {
  return (playerModule ??=
    import("lottie-web/build/player/lottie_light.js") as Promise<
      typeof import("lottie-web")
    >);
}
export async function createLottieRenderer(
  container: Element,
  scene: Scene,
  options: {
    onDiagnostic?: (id: string, property: string, message: string) => void;
    log?: boolean;
  } = {},
): Promise<LottieRenderer> {
  const lottie = (await engine()).default;
  const data = prepareLottieRenderData(scene, exportLottie(scene));
  const records = new Map(scene.layers.map((l) => [l.id, l]));
  const report = (id: string, property: string, message: string) => {
    const l = records.get(id);
    const diagnostic: LottieDiagnostic = {
      nodeId: id,
      layerType: l?.lottie?.source.ty ?? l?.type ?? "unknown",
      layerName: l?.name || "Unknown",
      shapeType: l?.lottie?.kind === "shape" ? l.lottie.source.ty : undefined,
      sourcePath: l?.lottie?.sourcePath || "renderer",
      unsupportedProperty: property,
      message,
    };
    console.warn("[Lottie renderer]", diagnostic);
    options.onDiagnostic?.(id, property, message);
  };
  const onAssetError = (event: Event) => {
    const target = event.target as Element;
    const href =
      target?.getAttribute?.("href") ||
      target?.getAttributeNS?.("http://www.w3.org/1999/xlink", "href");
    if (!href) return;
    for (const l of scene.layers)
      if (l.lottie?.source.ty === 2) {
        const asset = data.assets.find(
          (a: ObjectData) => a.id === l.lottie!.source.refId,
        );
        if (asset?.p === href)
          report(l.id, "refId", `Image failed to load: ${href}`);
      }
  };
  container.addEventListener("error", onAssetError, true);
  let player: AnimationItem;
  try {
    player = lottie.loadAnimation({
      container: container as HTMLElement,
      renderer: "svg",
      loop: false,
      autoplay: false,
      animationData: data,
      rendererSettings: {
        progressiveLoad: false,
        hideOnTransparent: false,
        preserveAspectRatio: "none",
      },
    });
  } catch (error) {
    container.removeEventListener("error", onAssetError, true);
    throw error;
  }
  let destroyed = false;
  const seek = (time: number) => {
    if (destroyed) return;
    // Lottie goToAndStop takes composition-relative frames; do not add ip twice.
    player.goToAndStop(Math.max(0, time) * (scene.fps ?? 60), true);
  };
  const ready = () => {
    if (destroyed) return;
    const coverage = auditLottieRendering(scene, player);
    if (options.log !== false)
      console.info("[Lottie pipeline]", {
        parsedNodes: scene.layers.length,
        renderedObjects: coverage.filter((r) => r.rendered).length,
        missing: coverage.filter((r) => !r.rendered),
        nodes: coverage,
      });
    for (const row of coverage)
      if (!row.rendered) {
        const l = records.get(row.nodeId);
        if (l?.visible !== false)
          report(
            row.nodeId,
            "renderer",
            "Parsed node has no matching SVG renderer object.",
          );
      }
  };
  const failed = (event: any) => {
    const missing = auditLottieRendering(scene, player).filter(
      (r) => !r.rendered,
    );
    const first = missing[0] || { nodeId: scene.layers[0]?.id };
    if (first.nodeId)
      report(
        first.nodeId,
        "renderer",
        String(
          event?.nativeError?.message ||
            event?.message ||
            "Lottie SVG rendering failed",
        ),
      );
  };
  player.addEventListener("DOMLoaded", ready);
  player.addEventListener("error", failed);
  player.addEventListener("data_failed", failed);
  if (player.isLoaded) ready();
  return {
    player,
    seek,
    coverage: () => auditLottieRendering(scene, player),
    destroy() {
      destroyed = true;
      container.removeEventListener("error", onAssetError, true);
      player.destroy();
      container.replaceChildren();
    },
  };
}

/** Use the exact canvas engine for retained-content SVG exports, including masks and gradients. */
export async function exportRenderedLottieSvg(
  scene: Scene,
  time: number,
  animated: boolean,
): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-100000px;width:1px;height:1px;overflow:hidden";
  document.body.append(host);
  let renderer: LottieRenderer | undefined;
  try {
    renderer = await createLottieRenderer(host, scene, { log: false });
    const player = renderer.player;
    if (!player.isLoaded)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error("Lottie assets did not finish loading for SVG export."),
            ),
          15000,
        );
        player.addEventListener("DOMLoaded", () => {
          clearTimeout(timeout);
          resolve();
        });
        player.addEventListener("data_failed", () => {
          clearTimeout(timeout);
          reject(new Error("Lottie SVG export failed."));
        });
      });
    const capture = (t: number) => {
      renderer!.seek(t);
      const svg = host.querySelector("svg")!;
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("width", String(scene.width));
      svg.setAttribute("height", String(scene.height));
      return svg;
    };
    if (!animated) return capture(time).outerHTML;
    const frames = Math.ceil(scene.duration * (scene.fps ?? 60));
    if (frames > 3600)
      throw new Error(
        "Animated SVG export of retained Lottie content supports up to 3,600 frames. Use Lottie JSON for longer animations.",
      );
    const pieces: string[] = [];
    for (let i = 0; i < frames; i++) {
      const svg = capture(i / (scene.fps ?? 60)).cloneNode(
        true,
      ) as SVGSVGElement;
      const ids = [...svg.querySelectorAll("[id]")]
        .map((el) => el.id)
        .sort((a, b) => b.length - a.length);
      let text = svg.outerHTML;
      for (const id of ids) text = text.split(id).join(`frame${i}-${id}`);
      const start = i / frames,
        end = (i + 1) / frames;
      const keyTimes =
        i === 0 ? [0, end, 1] : end === 1 ? [0, start, 1] : [0, start, end, 1];
      const values =
        i === 0
          ? ["inline", "none", "none"]
          : end === 1
            ? ["none", "inline", "none"]
            : ["none", "inline", "none", "none"];
      pieces.push(
        `<g display="none"><animate attributeName="display" dur="${scene.duration}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes.join(";")}" values="${values.join(";")}"/>${text}</g>`,
      );
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">${pieces.join("")}</svg>`;
  } finally {
    renderer?.destroy();
    host.remove();
  }
}
