import { makeLayer, type Layer } from "./model";

/** Parse data only: no imported markup, scripts, URLs or event handlers enter the live document. */
export function importSvg(text: string, filename: string): Layer[] {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw new Error("Invalid SVG file.");
  const shapes = [
    ...doc.querySelectorAll(
      "path,rect,circle,ellipse,text,polygon,polyline,line",
    ),
  ].filter((el) => !el.closest("defs,clipPath,mask,symbol"));
  if (!shapes.length) throw new Error("No editable vector shapes found.");
  if (shapes.length > 500)
    throw new Error("Import up to 500 shapes at a time.");
  const ns = "http://www.w3.org/2000/svg";
  const measurement = document.createElementNS(ns, "svg");
  measurement.style.cssText =
    "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(measurement);
  try {
    return shapes.map((el) => {
      const num = (attr: string, fallback = 0) => {
        const n = parseFloat(el.getAttribute(attr) || "");
        return Number.isFinite(n) ? n : fallback;
      };
      const inherited = (name: string, fallback: string) => {
        let node: Element | null = el;
        while (node && node.localName !== "svg") {
          const value = node.getAttribute(name);
          if (value) return value;
          node = node.parentElement;
        }
        return doc.documentElement.getAttribute(name) || fallback;
      };
      const fill = inherited("fill", "#151923");
      const stroke = inherited("stroke", "none");
      const safeColor = (color: string) =>
        /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i.test(
          color,
        )
          ? color
          : "#151923";
      const type: Layer["type"] = ["circle", "ellipse"].includes(el.localName)
        ? "ellipse"
        : el.localName === "text"
          ? "text"
          : el.localName === "rect"
            ? "rect"
            : "path";
      let width =
        type === "ellipse"
          ? 2 * num(el.localName === "circle" ? "r" : "rx", 50)
          : num("width", 200);
      let height =
        type === "ellipse"
          ? 2 * num(el.localName === "circle" ? "r" : "ry", 50)
          : type === "text"
            ? num("font-size", 40)
            : num("height", 100);
      let x = type === "ellipse" ? num("cx") - width / 2 : num("x");
      let y =
        type === "ellipse"
          ? num("cy") - height / 2
          : num("y") - (type === "text" ? height * 0.82 : 0);
      let path = el.getAttribute("d") || "";
      let pathViewBox: string | undefined;
      if (el.localName === "polygon" || el.localName === "polyline")
        path =
          "M " +
          (el.getAttribute("points") || "") +
          (el.localName === "polygon" ? " Z" : "");
      if (el.localName === "line")
        path = `M ${num("x1")} ${num("y1")} L ${num("x2")} ${num("y2")}`;
      if (type === "path") {
        const probe = document.createElementNS(ns, "path");
        probe.setAttribute("d", path);
        measurement.appendChild(probe);
        const bounds = probe.getBBox();
        x = bounds.x;
        y = bounds.y;
        width = Math.max(1, bounds.width);
        height = Math.max(1, bounds.height);
        pathViewBox = `${x} ${y} ${width} ${height}`;
        probe.remove();
      }
      return makeLayer(type, {
        name: el.getAttribute("id") || `${filename} · ${el.localName}`,
        x,
        y,
        width: Math.max(1, width),
        height: Math.max(1, height),
        fill: safeColor(fill),
        stroke: safeColor(stroke),
        strokeWidth: stroke === "none" ? 0 : num("stroke-width", 1),
        radius: num("rx"),
        opacity: Math.max(0, Math.min(100, num("opacity", 1) * 100)),
        text: el.textContent || "",
        path,
        pathViewBox,
      });
    });
  } finally {
    measurement.remove();
  }
}
