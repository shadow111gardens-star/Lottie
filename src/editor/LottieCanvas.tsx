import { useEffect, useRef } from "react";
import type { Scene } from "./model";
import { createLottieRenderer, type LottieRenderer } from "./lottieRenderer";

export default function LottieCanvas({
  scene,
  time,
  onDiagnostic,
}: {
  scene: Scene;
  time: number;
  onDiagnostic?: (id: string, property: string, message: string) => void;
}) {
  const host = useRef<SVGGElement>(null),
    runtime = useRef<LottieRenderer | null>(null),
    latestTime = useRef(time),
    diagnostics = useRef(onDiagnostic);
  latestTime.current = time;
  diagnostics.current = onDiagnostic;
  useEffect(() => {
    const element = host.current!;
    let cancelled = false;
    const mount = document.createElementNS("http://www.w3.org/2000/svg", "g");
    element.append(mount);
    createLottieRenderer(mount, scene, {
      onDiagnostic: (...args) => diagnostics.current?.(...args),
    })
      .then((renderer) => {
        if (cancelled) {
          renderer.destroy();
          mount.remove();
          return;
        }
        runtime.current = renderer;
        const seek = () => renderer.seek(latestTime.current);
        renderer.player.addEventListener("DOMLoaded", seek);
        seek();
      })
      .catch((error) => {
        console.error("[Lottie canvas]", error);
        const root = scene.layers.find(
          (l) => l.lottie?.kind === "layer" && !l.lottie.parentId,
        );
        if (!cancelled && root)
          diagnostics.current?.(root.id, "renderer", String(error));
      });
    return () => {
      cancelled = true;
      runtime.current?.destroy();
      runtime.current = null;
      mount.remove();
    };
  }, [scene]);
  useEffect(() => {
    runtime.current?.seek(time);
  }, [time]);
  return <g ref={host} data-lottie-canvas="true" />;
}
