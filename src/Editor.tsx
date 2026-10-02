import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from './lib/firebase';
import { loadProject, saveProject, preserveDraft, frameSvg } from './projects/store';
import { dataUrl } from './projects/storage';
import { vectorizeMedia, frameIsActive, isEditableVector } from './editor/vectorize';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Hand,
  Lock,
  Unlock,
  Minus,
  MousePointer2,
  Move,
  Slash,
  Pause,
  Play,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  PenTool,
  Diamond,
  SkipBack,
  Repeat2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Canvas from "./editor/Canvas";
import {
  clamp,
  evaluate,
  makeLayer,
  properties,
  transformProperties,
  setProperty,
  uid,
  type Layer,
  type Property,
  type Scene,
} from "./editor/model";
import "./editor/editor.css";
import { exportSceneSvg, validateScene } from "./editor/io";
import { importSvg } from "./editor/importSvg";
import { importLottie, exportLottie } from "./editor/lottie";
import { exportRenderedLottieSvg } from "./editor/lottieRenderer";
import { duplicateLottieNode } from "./editor/lottieDocument";
import { importMedia } from "./editor/media";

function Button({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      className={`ke-icon ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = -10000,
  max = 10000,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const [draftValue, setDraftValue] = useState(
    String(Math.round(value * 100) / 100),
  );
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraftValue(String(Math.round(value * 100) / 100));
  }, [value]);
  return (
    <label className="ke-number">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        step="any"
        value={draftValue}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setDraftValue(String(Math.round(value * 100) / 100));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        min={min}
        max={max}
        onChange={(e) => {
          setDraftValue(e.target.value);
          if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber))
            onChange(clamp(e.target.valueAsNumber, min, max));
        }}
      />
    </label>
  );
}
export default function Editor() {
  const { projectId = "1" } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<{ id: string; owner: string; scene: Scene } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false, generation = 0;
    let unsubscribe: (() => void) | undefined;
    setLoaded(null); setError('');
    try { unsubscribe = onAuthStateChanged(getFirebaseAuth(), user => {
      const version = ++generation; setLoaded(null);
      if (!user) { navigate('/', { replace: true }); return; }
      void loadProject(projectId).then(scene => { if (!disposed && version === generation) setLoaded({ id: projectId, owner: user.uid, scene }); })
        .catch(error => { if (!disposed && version === generation) setError(error instanceof Error ? error.message : 'Could not open project.'); });
    }); } catch (error) { setError(error instanceof Error ? error.message : 'Authentication is unavailable.'); }
    return () => { disposed = true; unsubscribe?.(); };
  }, [projectId, navigate]);
  if (!loaded || loaded.id !== projectId) return <div className="ke-editor"><div className="ke-toast" role={error ? 'alert' : 'status'}>{error || 'Loading project…'}{error && <Link to="/dashboard">Workspace</Link>}</div></div>;
  return <Workspace key={`${loaded.owner}:${projectId}`} projectId={projectId} initial={loaded.scene} ownerId={loaded.owner} />;
}
export function Workspace({ projectId, initial, ownerId }: { projectId: string; initial: Scene; ownerId: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Kinetic — Vector animation editor";
    return () => {
      document.title = previousTitle;
    };
  }, []);
  const [scene, setScene] = useState<Scene>(initial);
  const [selected, setSelected] = useState<string | null>(initial.editorView?.selected ?? null);
  const [time, setTime] = useState(initial.editorView?.time ?? 0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [zoom, setZoom] = useState(initial.editorView?.zoom ?? 0.55);
  const [tool, setTool] = useState("select");
  const [preview, setPreview] = useState(false);
  const [autoKey, setAutoKey] = useState(false);
  const [saved, setSaved] = useState("Saved");
  const [expanded, setExpanded] = useState<string[]>(
    initial.editorView?.expanded ?? [scene.layers[0]?.id, scene.layers[1]?.id].filter(Boolean),
  );
  const [history, setHistory] = useState<Scene[]>([]);
  const [future, setFuture] = useState<Scene[]>([]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [message, setMessage] = useState(() =>
    window.location.search.includes("import=1")
      ? "Use Import in the toolbar to choose an SVG or Kinetic project."
      : "",
  );
  const input = useRef<HTMLInputElement>(null);
  const importKind = useRef<"auto" | "lottie" | "media">("auto");
  const importingMedia = useRef(false);
  const mediaAbort = useRef<AbortController | null>(null);
  useEffect(() => () => mediaAbort.current?.abort(), []);
  const [mediaSelection, setMediaSelection] = useState<{layer:string;frame:string;time:number} | null>(null);
  const [importMenu, setImportMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [importReport, setImportReport] = useState<string[]>([]);
  const chooseImport = (kind: "auto" | "lottie" | "media") => {
    importKind.current = kind;
    if (input.current)
      input.current.accept =
        kind === "lottie" ? ".json,application/json" : kind === "media" ? "video/*,image/gif,.mp4,.mov,.webm,.mkv,.avi,.gif" : ".svg,.json";
    setImportMenu(false);
    input.current?.click();
  };
  const [keySelection, setKeySelection] = useState<{
    layer: string;
    prop: Property;
    id: string;
  } | null>(null);
  const select = (id: string | null) => {
    setSelected(id);
    setKeySelection(null);
    if (id) setExpanded((list) => (list.includes(id) ? list : [...list, id]));
  };
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const keyDrag = useRef<{
    id: string;
    pointer: number;
    x: number;
    scene: Scene;
    changed: boolean;
  } | null>(null);
  useEffect(() => {
    if (selected && !scene.layers.some((l) => l.id === selected)) select(null);
  }, [scene.layers, selected]);
  const [timelineHeight, setTimelineHeight] = useState(initial.editorView?.timelineHeight ?? 290);
  const layer = scene.layers.find((l) => l.id === selected);
  const value = layer && evaluate(layer, time);
  const begin = () => {
    const snapshot = sceneRef.current;
    setHistory((h) => [...h.slice(-79), snapshot]);
    setFuture([]);
  };
  const commit = (next: Scene) => {
    if (JSON.stringify(next) === JSON.stringify(sceneRef.current)) return;
    begin();
    sceneRef.current = next;
    setScene(next);
  };
  const patch = (id: string, changes: Partial<Layer>, record = true) => {
    if (!sceneRef.current.layers.some((l) => l.id === id && !l.locked)) return;
    setPlaying(false);
    if (record) begin();
    setScene((s) => ({
      ...s,
      layers: s.layers.map((l) => {
        if (l.id !== id || l.locked) return l;
        let next = { ...l };
        for (const [key, v] of Object.entries(changes)) {
          if (
            (key === "fill" || key === "stroke") &&
            typeof v === "string" &&
            /^#[0-9a-f]{6}$/i.test(v)
          ) {
            next = setProperty(
              next,
              `${key}Color`,
              parseInt(v.slice(1), 16),
              time,
              autoKey,
            );
            next = { ...next, [key]: v };
            continue;
          }
          if (key === "path") {
            next.pathData = undefined;
            next.tracks = { ...next.tracks };
            delete next.tracks.pathProgress;
          }
          if (properties.includes(key as Property))
            next = setProperty(
              next,
              key as Property,
              v as number,
              time,
              autoKey,
            );
          else next = { ...next, [key]: v };
        }
        return next;
      }),
    }));
  };
  const undo = () => {
    if (!history.length) return;
    setPlaying(false);
    setKeySelection(null);
    setFuture((f) => [scene, ...f]);
    const restored = history[history.length - 1];
    setScene(restored);
    sceneRef.current = restored;
    setTime((t) => Math.min(t, restored.duration));
    setHistory((h) => h.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setHistory((h) => [...h, scene]);
    setPlaying(false);
    setKeySelection(null);
    setScene(future[0]);
    sceneRef.current = future[0];
    setTime((t) => Math.min(t, future[0].duration));
    setFuture((f) => f.slice(1));
  };
  const create = (l: Layer) => {
    commit({ ...sceneRef.current, layers: [l, ...sceneRef.current.layers] });
    select(l.id);
    setTool("select");
    setPlaying(false);
  };
  const add = (
    type: Layer["type"],
    x = scene.width / 2 - 100,
    y = scene.height / 2 - 60,
  ) => {
    create(
      makeLayer(type, {
        x,
        y,
        ...(type === "text" ? { height: 48, width: 400, fill: "#151923" } : {}),
      }),
    );
    if (type === "text")
      requestAnimationFrame(() =>
        (
          document.querySelector(
            '[aria-label="Text content"]',
          ) as HTMLTextAreaElement | null
        )?.focus(),
      );
  };
  const remove = () => {
    if (keySelection) {
      const k = keySelection;
      commit({
        ...scene,
        layers: scene.layers.map((l) =>
          l.id === k.layer && !l.locked
            ? {
                ...l,
                tracks: {
                  ...l.tracks,
                  [k.prop]: l.tracks[k.prop]?.filter((f) => f.id !== k.id),
                },
              }
            : l,
        ),
      });
      setKeySelection(null);
    } else if (layer && !layer.locked) {
      commit({
        ...scene,
        layers: scene.layers.filter((l) => {
          let current: Layer | undefined = l;
          while (current) {
            if (current.id === selected) return false;
            current = scene.layers.find(
              (p) => p.id === current?.lottie?.parentId,
            );
          }
          return true;
        }),
      });
      select(null);
    }
  };
  const duplicate = () => {
    if (!layer) return;
    if (layer.lottie) {
      const result = duplicateLottieNode(scene, layer.id);
      commit(result.scene);
      select(result.selected);
      return;
    }
    const l = structuredClone(layer);
    l.id = uid();
    l.name += " copy";
    l.x += 20;
    l.y += 20;
    l.locked = false;
    for (const prop of properties) {
      const keys = l.tracks[prop];
      if (!keys) continue;
      l.tracks[prop] = keys.map((k) => ({
        ...k,
        id: uid(),
        value: k.value + (prop === "x" || prop === "y" ? 20 : 0),
      }));
    }
    commit({ ...scene, layers: [l, ...scene.layers] });
    select(l.id);
  };
  const viewRef = useRef({ time, zoom, selected, expanded, timelineHeight });
  viewRef.current = { time, zoom, selected, expanded, timelineHeight };
  const savingVersion = useRef(0);
  const [saveRequest, setSaveRequest] = useState(0);
  const persistedTime = playing ? null : time;
  useEffect(() => {
    const version = ++savingVersion.current;
    const snapshot = { ...scene, editorView: viewRef.current };
    setSaved('Unsaved changes');
    void preserveDraft(projectId, snapshot, ownerId).catch(() => {});
    const timer = setTimeout(() => {
      setSaved('Saving…');
      void saveProject(projectId, snapshot, ownerId).then(() => { if (version === savingVersion.current) setSaved('Saved'); })
        .catch(error => { if (version === savingVersion.current) { setSaved('Not saved · retry'); setMessage(error instanceof Error ? error.message : 'Save failed. Your local changes are preserved.'); } });
    }, 1200);
    return () => clearTimeout(timer);
  }, [scene, projectId, ownerId, saveRequest, persistedTime, zoom, selected, expanded, timelineHeight]);
  useEffect(() => {
    const retry = () => setSaveRequest(value => value + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
  useEffect(() => {
    const flush = () => { void preserveDraft(projectId, { ...sceneRef.current, editorView: viewRef.current }, ownerId).catch(() => {}); };
    window.addEventListener('pagehide', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); };
  }, [projectId, ownerId]);
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    if (!playing) return;
    const startTime = timeRef.current,
      started = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const next = startTime + (now - started) / 1000;
      if (next >= scene.duration && !loop) {
        setTime(scene.duration);
        setPlaying(false);
        return;
      }
      setTime(loop ? next % scene.duration : next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, scene.duration, loop]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") {
        e.preventDefault();
        if (time >= scene.duration) setTime(0);
        setPlaying((v) => !v);
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault(); setSaveRequest(value => value + 1);
      } else if (mod && e.key === "d") {
        e.preventDefault();
        duplicate();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      } else if (e.key === "Escape") {
        select(null);
        setPreview(false);
        setKeySelection(null);
        setTool("select");
        setImportMenu(false);
        setExportMenu(false);
      } else if (
        !mod &&
        {
          v: "select",
          h: "hand",
          m: "move",
          l: "line",
          r: "rect",
          o: "ellipse",
          t: "text",
          p: "path",
        }[e.key]
      )
        setTool(
          (
            {
              v: "select",
              h: "hand",
              m: "move",
              l: "line",
              r: "rect",
              o: "ellipse",
              t: "text",
              p: "path",
            } as Record<string, string>
          )[e.key],
        );
      else if (
        layer &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const prop =
          e.key === "ArrowLeft" || e.key === "ArrowRight" ? "x" : "y";
        patch(layer.id, {
          [prop]:
            evaluate(layer, time)[prop] +
            (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) *
              (e.shiftKey ? 10 : 1),
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const download = (text: string, type: string, extension: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scene.name}.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportJson = async () => {
    try {
      const json = JSON.stringify(exportLottie(scene), null, 2);
      const next = { ...scene, files: { ...scene.files, lottie: json } };
      commit(next);
      download(
        json,
        "application/json",
        "lottie.json",
      );
      setExportMenu(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not export Lottie.",
      );
    }
  };
  const exportSvgFile = async (animated: boolean) => {
    try {
      const text = scene.lottie
        ? await exportRenderedLottieSvg(scene, time, animated)
        : exportSceneSvg(scene, time, animated);
      commit({ ...scene, files: { ...scene.files, svg: text } });
      download(text, "image/svg+xml", animated ? "animated.svg" : "svg");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SVG export failed.");
    }
  };
  const exportSvg = () => {
    void exportSvgFile(false);
  };
  const reportRenderDiagnostic = (
    id: string,
    property: string,
    message: string,
  ) => {
    setScene((s) => {
      const layer = s.layers.find((l) => l.id === id);
      if (
        !layer?.lottie ||
        layer.lottie.diagnostics.some(
          (d) => d.unsupportedProperty === property && d.message === message,
        )
      )
        return s;
      const diagnostic = {
        nodeId: id,
        layerType: layer.lottie.source.ty,
        layerName: layer.name,
        shapeType:
          layer.lottie.kind === "shape"
            ? String(layer.lottie.source.ty)
            : undefined,
        sourcePath: layer.lottie.sourcePath,
        unsupportedProperty: property,
        message,
      };
      return {
        ...s,
        lottie: s.lottie
          ? { ...s.lottie, diagnostics: [...s.lottie.diagnostics, diagnostic] }
          : undefined,
        layers: s.layers.map((l) =>
          l.id === id
            ? {
                ...l,
                type: "unsupported",
                name: l.name.startsWith("Unsupported")
                  ? l.name
                  : `Unsupported ? ${l.name}`,
                lottie: {
                  ...l.lottie!,
                  status: "unsupported",
                  diagnostics: [...l.lottie!.diagnostics, diagnostic],
                },
              }
            : l,
        ),
      };
    });
  };
  const addKey = (id: string, prop: Property) => {
    const l = scene.layers.find((l) => l.id === id)!;
    if (l.locked) return;
    commit({
      ...scene,
      layers: scene.layers.map((item) =>
        item.id === id
          ? setProperty(item, prop, evaluate(item, time)[prop], time, true)
          : item,
      ),
    });
  };
  const reorder = (direction: number) => {
    if (!layer || layer.locked) return;
    const layers = [...scene.layers];
    const index = layers.indexOf(layer);
    const next = clamp(index + direction, 0, layers.length - 1);
    [layers[index], layers[next]] = [layers[next], layers[index]];
    commit({ ...scene, layers });
  };
  const selectedKey =
    keySelection &&
    scene.layers
      .find((l) => l.id === keySelection.layer)
      ?.tracks[keySelection.prop]?.find((k) => k.id === keySelection.id);
  return (
    <div className="ke-editor">
      <header className="ke-header">
        <div className="ke-brand">
          <Link className="ke-back" to="/dashboard">
            <ArrowLeft size={13} /> Workspace
          </Link>
        </div>
        <div className="ke-toolbar">
          <Button
            label={playing ? "Pause" : "Play"}
            active
            onClick={() => {
              if (time >= scene.duration) setTime(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <i />
          {[
            { id: "select", label: "Select (V)", Icon: MousePointer2 },
            { id: "move", label: "Move (M)", Icon: Move },
            { id: "hand", label: "Pan (H)", Icon: Hand },
            { id: "rect", label: "Rectangle (R)", Icon: Square },
            { id: "ellipse", label: "Ellipse (O)", Icon: Circle },
            { id: "line", label: "Line (L)", Icon: Slash },
            { id: "text", label: "Text (T)", Icon: Type },
            { id: "path", label: "Pen (P)", Icon: PenTool },
          ].map(({ id, label, Icon }) => (
            <Button
              key={id}
              label={label}
              active={tool === id}
              onClick={() => setTool(id)}
            >
              <Icon />
            </Button>
          ))}
          <i />
          <Button
            label="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={!history.length}
          >
            <Undo2 />
          </Button>
          <Button
            label="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!future.length}
          >
            <Redo2 />
          </Button>
          <i />
          <div className="ke-menu-wrap">
            <Button
              label="Import"
              onClick={() => {
                setImportMenu(!importMenu);
                setExportMenu(false);
              }}
            >
              <Upload />
            </Button>
            {importMenu && (
              <div
                className="ke-file-menu"
                role="menu"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setImportMenu(false);
                }}
              >
                <button role="menuitem" onClick={() => chooseImport("lottie")}>
                  Import Lottie JSON
                </button>
                <button role="menuitem" onClick={() => chooseImport("auto")}>
                  Import SVG or project
                </button>
                <button role="menuitem" onClick={() => chooseImport("media")}>
                  Import video or GIF (up to 10s)
                </button>
              </div>
            )}
          </div>
          <div className="ke-menu-wrap">
            <Button
              label="Export"
              onClick={() => {
                setExportMenu(!exportMenu);
                setImportMenu(false);
              }}
            >
              <Download />
            </Button>
            {exportMenu && (
              <div
                className="ke-file-menu"
                role="menu"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setExportMenu(false);
                }}
              >
                <button role="menuitem" onClick={exportJson}>
                  Export Lottie JSON
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    exportSvg();
                    setExportMenu(false);
                  }}
                >
                  SVG snapshot
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    void exportSvgFile(true);
                    setExportMenu(false);
                  }}
                >
                  Animated SVG
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    download(
                      JSON.stringify(scene, null, 2),
                      "application/json",
                      "kinetic.json",
                    );
                    setExportMenu(false);
                  }}
                >
                  Save editable project
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="ke-save" role="button" tabIndex={0} title="Save project (Ctrl+S)" onClick={() => setSaveRequest(value => value + 1)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSaveRequest(value => value + 1); } }}>
          <span />
          {saved}
        </div>
      </header>
      <main className="ke-workspace">
        <aside className="ke-panel ke-layers">
          <div className="ke-panel-title">
            Layers
            <Button label="Add rectangle" onClick={() => add("rect")}>
              <Plus />
            </Button>
          </div>
          <button
            className={`ke-scene-row ${!selected ? "selected" : ""}`}
            onClick={() => {
              select(null);
              setKeySelection(null);
            }}
          >
            <ChevronDown size={14} />
            <Square size={15} />
            <span>{scene.name}</span>
            <small>{scene.layers.length}</small>
          </button>
          <div className="ke-layer-list">
            {scene.layers.filter(l => frameIsActive(scene, l, time, mediaSelection)).map((l) => (
              <div
                key={l.id}
                className={`ke-layer-row ${selected === l.id ? "selected" : ""}`}
                draggable={!l.locked && renaming !== l.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/kinetic-layer", l.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData(
                    "application/kinetic-layer",
                  );
                  const source = scene.layers.find((item) => item.id === id);
                  if (!source || source.locked || id === l.id) return;
                  const layers = scene.layers.filter((item) => item.id !== id);
                  layers.splice(
                    scene.layers.findIndex((item) => item.id === l.id),
                    0,
                    source,
                  );
                  commit({ ...scene, layers });
                }}
              >
                <button
                  className="ke-layer-name"
                  onDoubleClick={() => {
                    if (!l.locked) {
                      setRenaming(l.id);
                      setRenameValue(l.name);
                    }
                  }}
                  onClick={() => {
                    select(l.id);
                    setKeySelection(null);
                  }}
                >
                  {l.type === "text" ? (
                    <Type size={14} />
                  ) : l.type === "ellipse" ? (
                    <Circle size={14} />
                  ) : l.type === "path" ? (
                    <PenTool size={14} />
                  ) : (
                    <Square size={14} />
                  )}
                  {renaming === l.id ? (
                    <input
                      aria-label="Rename layer"
                      autoFocus
                      value={renameValue}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim() && renameValue !== l.name)
                          patch(l.id, { name: renameValue.trim() });
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          setRenaming(null);
                        }
                      }}
                    />
                  ) : (
                    <span>{l.name}</span>
                  )}
                </button>
                <Button
                  label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                  onClick={() =>
                    commit({
                      ...scene,
                      layers: scene.layers.map((x) =>
                        x.id === l.id ? { ...x, visible: !x.visible } : x,
                      ),
                    })
                  }
                >
                  {l.visible ? <Eye /> : <EyeOff />}
                </Button>
                <Button
                  label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`}
                  onClick={() =>
                    commit({
                      ...scene,
                      layers: scene.layers.map((x) =>
                        x.id === l.id ? { ...x, locked: !x.locked } : x,
                      ),
                    })
                  }
                >
                  {l.locked ? <Lock /> : <Unlock />}
                </Button>
              </div>
            ))}
          </div>
          <div className="ke-layer-footer">
            <Button
              label="Move layer up"
              onClick={() => reorder(-1)}
              disabled={
                !layer || layer.locked || scene.layers[0]?.id === layer.id
              }
            >
              <ArrowUp />
            </Button>
            <Button
              label="Move layer down"
              onClick={() => reorder(1)}
              disabled={
                !layer ||
                layer.locked ||
                scene.layers[scene.layers.length - 1]?.id === layer.id
              }
            >
              <ArrowDown />
            </Button>
            <Button
              label="Duplicate layer"
              onClick={duplicate}
              disabled={!layer}
            >
              <Copy />
            </Button>
            <Button
              label="Delete selected"
              onClick={remove}
              disabled={!layer && !keySelection}
            >
              <Trash2 />
            </Button>
          </div>
          <p className="ke-hint">
            Create with the toolbar.
            <br />
            Select a layer to make it move.
          </p>
        </aside>
        <section className="ke-canvas-area">
          <Canvas
            mediaSelection={playing ? null : mediaSelection}
            onDiagnostic={reportRenderDiagnostic}
            scene={scene}
            time={time}
            selected={selected}
            select={(id) => {
              select(id);
              setKeySelection(null);
            }}
            zoom={zoom}
            setZoom={setZoom}
            tool={tool}
            preview={preview}
            begin={begin}
            create={create}
            stop={() => setPlaying(false)}
            change={(id, changes) => patch(id, changes, false)}
            add={add}
          />
          <div className="ke-view-controls">
            <Button
              label="Zoom out"
              onClick={() => setZoom((z) => clamp(z - 0.1, 0.1, 3))}
            >
              <Minus />
            </Button>
            <span>{Math.round(zoom * 100)}%</span>
            <Button
              label="Zoom in"
              onClick={() => setZoom((z) => clamp(z + 0.1, 0.1, 3))}
            >
              <Plus />
            </Button>
            <i />
            <button
              className={preview ? "selected" : ""}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Exit preview" : "Preview"}
            </button>
            <span className="ke-muted">{scene.layers.some(l => isEditableVector(l) && frameIsActive(scene, l, time, mediaSelection)) ? 'SVG · Vector' : scene.layers.some(l => l.media) ? 'Source frame' : 'SVG'}</span>
          </div>
        </section>
        <aside className="ke-panel ke-inspector">
          <div className="ke-panel-title">
            {layer ? "Layer properties" : "Scene properties"}
            <span className="ke-badge">{layer?.type || "Frame"}</span>
          </div>
          <input
            className="ke-name-input"
            aria-label={layer ? "Layer name" : "Scene name"}
            value={layer?.name ?? scene.name}
            disabled={layer?.locked}
            onChange={(e) =>
              layer
                ? patch(layer.id, { name: e.target.value })
                : commit({ ...scene, name: e.target.value })
            }
          />
          {value && layer ? (
            <>
              <div className="ke-section-label">
                Transform{" "}
                <span>{layer.locked ? "Locked" : "Editable vector"}</span>
              </div>
              <fieldset disabled={layer.locked}>
                <div className="ke-fields">
                  {transformProperties.map((prop) => (
                    <div className="ke-animated-field" key={prop}>
                      <NumberField
                        label={prop}
                        value={value[prop]}
                        min={
                          prop === "opacity"
                            ? 0
                            : prop === "width" || prop === "height"
                              ? 1
                              : -10000
                        }
                        max={prop === "opacity" ? 100 : 10000}
                        onChange={(n) => patch(layer.id, { [prop]: n })}
                      />
                      <Button
                        label={`Add ${prop} keyframe`}
                        active={!!layer.tracks[prop]?.length}
                        onClick={() => addKey(layer.id, prop)}
                      >
                        <Diamond />
                      </Button>
                    </div>
                  ))}
                </div>
                {(layer.startTime !== undefined ||
                  layer.endTime !== undefined) && (
                  <div className="ke-fields">
                    <NumberField
                      label="In point"
                      min={0}
                      max={layer.endTime ?? scene.duration}
                      value={layer.startTime ?? 0}
                      onChange={(n) => patch(layer.id, { startTime: n })}
                    />
                    <NumberField
                      label="Out point"
                      min={layer.startTime ?? 0}
                      max={scene.duration}
                      value={layer.endTime ?? scene.duration}
                      onChange={(n) => patch(layer.id, { endTime: n })}
                    />
                  </div>
                )}
                <div className="ke-section-label">Appearance</div>
                <label className="ke-color">
                  Fill
                  <input
                    aria-label="Fill color"
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(value.fill)
                        ? value.fill
                        : "#151923"
                    }
                    onChange={(e) => patch(layer.id, { fill: e.target.value })}
                  />
                  <span>{value.fill.toUpperCase()}</span>
                </label>
                <label className="ke-color">
                  Stroke
                  <input
                    aria-label="Stroke color"
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(value.stroke)
                        ? value.stroke
                        : "#151923"
                    }
                    onChange={(e) =>
                      patch(layer.id, { stroke: e.target.value })
                    }
                  />
                  <NumberField
                    label="Stroke width"
                    value={value.strokeWidth}
                    min={0}
                    max={50}
                    onChange={(n) => patch(layer.id, { strokeWidth: n })}
                  />
                </label>
                {layer.type === "rect" && (
                  <NumberField
                    label="Corner radius"
                    value={value.radius}
                    min={0}
                    onChange={(n) => patch(layer.id, { radius: n })}
                  />
                )}
                {layer.type === "text" && (
                  <label className="ke-text-label">
                    Text
                    <textarea
                      aria-label="Text content"
                      value={layer.text}
                      onChange={(e) =>
                        patch(layer.id, { text: e.target.value })
                      }
                    />
                  </label>
                )}
                {layer.type === "path" && (
                  <label className="ke-text-label">
                    SVG path · {layer.pathViewBox || "0 0 200 100"}
                    <textarea
                      aria-label="SVG path data"
                      value={value.path}
                      onChange={(e) =>
                        patch(layer.id, { path: e.target.value })
                      }
                    />
                  </label>
                )}
              </fieldset>
              <p className="ke-hint">
                Drag to move. Use handles to resize or rotate. Shift snaps
                rotation. Diamonds add keyframes at the playhead. Animated
                values update the current keyframe.
              </p>
            </>
          ) : (
            <>
              <div className="ke-section-label">
                Frame <span>Custom</span>
              </div>
              <div className="ke-fields">
                <NumberField
                  label="W"
                  value={scene.width}
                  min={100}
                  max={4096}
                  onChange={(n) => commit({ ...scene, width: n })}
                />
                <NumberField
                  label="H"
                  value={scene.height}
                  min={100}
                  max={4096}
                  onChange={(n) => commit({ ...scene, height: n })}
                />
              </div>
              <label className="ke-color">
                Background
                <input
                  aria-label="Background color"
                  type="color"
                  value={scene.background}
                  onChange={(e) =>
                    commit({ ...scene, background: e.target.value })
                  }
                />
                <span>{scene.background.toUpperCase()}</span>
              </label>
              <label className="ke-toggle">
                Clip content
                <input
                  type="checkbox"
                  checked={scene.clip}
                  onChange={(e) => commit({ ...scene, clip: e.target.checked })}
                />
              </label>
              <p className="ke-hint">
                {scene.layers.some(l => l.media) ? 'Select a traced path to edit this frame. ' : 'Your scene is a real SVG. '}Add shapes, text, or import vectors.
                Select a layer to edit its appearance and animate its
                properties.
              </p>
              <div className="ke-shortcuts">
                <span>
                  Play / pause<kbd>Space</kbd>
                </span>
                <span>
                  Select / pan<kbd>V / H</kbd>
                </span>
                <span>
                  Duplicate<kbd>Ctrl D</kbd>
                </span>
                <span>
                  Undo<kbd>Ctrl Z</kbd>
                </span>
                <span>
                  Zoom<kbd>Ctrl + scroll</kbd>
                </span>
              </div>
            </>
          )}
          {selectedKey && keySelection && (
            <div className="ke-key-editor">
              <div className="ke-section-label">Selected keyframe</div>
              {keySelection.prop.endsWith("Color") ? (
                <label className="ke-color">
                  Keyframe color
                  <input
                    aria-label="Keyframe color"
                    type="color"
                    value={
                      "#" +
                      Math.round(selectedKey.value)
                        .toString(16)
                        .padStart(6, "0")
                    }
                    onChange={(e) => {
                      const n = parseInt(e.target.value.slice(1), 16);
                      commit({
                        ...scene,
                        layers: scene.layers.map((l) =>
                          l.id === keySelection.layer && !l.locked
                            ? {
                                ...l,
                                tracks: {
                                  ...l.tracks,
                                  [keySelection.prop]: l.tracks[
                                    keySelection.prop
                                  ]?.map((k) =>
                                    k.id === selectedKey.id
                                      ? { ...k, value: n }
                                      : k,
                                  ),
                                },
                              }
                            : l,
                        ),
                      });
                    }}
                  />
                </label>
              ) : (
                <NumberField
                  label="Keyframe value"
                  min={
                    keySelection.prop === "opacity"
                      ? 0
                      : ["width", "height"].includes(keySelection.prop)
                        ? 1
                        : -10000
                  }
                  max={keySelection.prop === "opacity" ? 100 : 10000}
                  value={selectedKey.value}
                  onChange={(n) =>
                    commit({
                      ...scene,
                      layers: scene.layers.map((l) =>
                        l.id === keySelection.layer && !l.locked
                          ? {
                              ...l,
                              tracks: {
                                ...l.tracks,
                                [keySelection.prop]: l.tracks[
                                  keySelection.prop
                                ]?.map((k) =>
                                  k.id === selectedKey.id
                                    ? { ...k, value: n }
                                    : k,
                                ),
                              },
                            }
                          : l,
                      ),
                    })
                  }
                />
              )}
              <NumberField
                label="Keyframe time"
                min={0}
                max={scene.duration}
                value={selectedKey.time}
                onChange={(n) => {
                  commit({
                    ...scene,
                    layers: scene.layers.map((l) =>
                      l.id === keySelection.layer && !l.locked
                        ? {
                            ...l,
                            tracks: {
                              ...l.tracks,
                              [keySelection.prop]: l.tracks[keySelection.prop]
                                ?.filter(
                                  (k) =>
                                    k.id === selectedKey.id ||
                                    Math.abs(k.time - n) > 1e-9,
                                )
                                .map((k) =>
                                  k.id === selectedKey.id
                                    ? { ...k, time: n }
                                    : k,
                                )
                                .sort((a, b) => a.time - b.time),
                            },
                          }
                        : l,
                    ),
                  });
                }}
              />
              <select
                aria-label="Keyframe easing"
                value={selectedKey.easing}
                onChange={(e) =>
                  commit({
                    ...scene,
                    layers: scene.layers.map((l) =>
                      l.id === keySelection.layer && !l.locked
                        ? {
                            ...l,
                            tracks: {
                              ...l.tracks,
                              [keySelection.prop]: l.tracks[
                                keySelection.prop
                              ]?.map((k) =>
                                k.id === selectedKey.id
                                  ? {
                                      ...k,
                                      easing: e.target.value as
                                        "linear" | "ease" | "hold",
                                    }
                                  : k,
                              ),
                            },
                          }
                        : l,
                    ),
                  })
                }
              >
                <option value="linear">Linear</option>
                <option value="ease">Ease in / out</option>
                <option value="hold">Hold</option>
              </select>
              <button onClick={remove}>Delete keyframe</button>
            </div>
          )}
          <div className="ke-export">
            <div className="ke-section-label">
              Export{" "}
              <span>
                {scene.width} × {scene.height}
              </span>
            </div>
            <button onClick={() => void exportSvgFile(true)}>
              <Download size={14} /> Animated SVG
            </button>
            <button onClick={exportJson}>Export Lottie JSON</button>
            <button aria-label="Export SVG snapshot" onClick={exportSvg}>
              SVG snapshot
            </button>
            <button
              onClick={() =>
                download(
                  JSON.stringify(scene, null, 2),
                  "application/json",
                  "kinetic.json",
                )
              }
            >
              Save editable project
            </button>
          </div>
        </aside>
      </main>
      <section
        className="ke-timeline ke-panel"
        style={{ height: timelineHeight }}
      >
        <div
          className="ke-resize-timeline"
          title="Resize timeline"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.buttons)
              setTimelineHeight(
                clamp(
                  window.innerHeight - e.clientY - 14,
                  180,
                  window.innerHeight * 0.6,
                ),
              );
          }}
        />
        <div className="ke-transport">
          <Button
            label="Stop playback"
            onClick={() => {
              setTime(0);
              setPlaying(false);
            }}
          >
            <SkipBack />
          </Button>
          <Button
            label={playing ? "Pause playback" : "Start playback"}
            active
            onClick={() => {
              if (time >= scene.duration) setTime(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button
            label="Loop playback"
            active={loop}
            onClick={() => setLoop(!loop)}
          >
            <Repeat2 />
          </Button>
          <Button
            label="Auto keyframe"
            active={autoKey}
            onClick={() => setAutoKey(!autoKey)}
          >
            <Diamond />
          </Button>
          <span className="ke-time">
            {time.toFixed(2)} <span>/ {scene.duration.toFixed(2)} s</span>
          </span>
          <span className="ke-timeline-tip">
            Double-click a track to add a keyframe · drag diamonds to retime
          </span>
          <NumberField
            label="Duration"
            value={scene.duration}
            min={1 / (scene.fps ?? 60)}
            max={600}
            onChange={(n) => {
              const latest = Math.max(
                0,
                ...scene.layers.flatMap((l) =>
                  Object.values(l.tracks).flatMap(
                    (keys) => keys?.map((k) => k.time) || [],
                  ),
                ),
              );
              const duration = Math.max(n, latest, ...scene.layers.map(l => l.media ? (l.startTime ?? 0) + l.media.duration : 0));
              if (n < latest)
                setMessage(
                  "Move or delete later keyframes before shortening the duration.",
                );
              commit({ ...scene, duration });
              setTime((t) => Math.min(t, duration));
            }}
          />
        </div>
        <div className="ke-tracks">
          <div className="ke-ruler-row">
            <div className="ke-track-label">
              Layers <span>{scene.layers.some(l => l.media) ? "Source timing" : `${scene.fps ?? 60} fps`}</span>
            </div>
            <div
              className="ke-ruler"
              onPointerDown={(e) => {
                setMediaSelection(null);
                e.currentTarget.setPointerCapture(e.pointerId);
                setPlaying(false);
                const r = e.currentTarget.getBoundingClientRect();
                setTime(
                  clamp(
                    ((e.clientX - r.left) / r.width) * scene.duration,
                    0,
                    scene.duration,
                  ),
                );
              }}
              onPointerMove={(e) => {
                if (e.buttons) {
                  const r = e.currentTarget.getBoundingClientRect();
                  setTime(
                    clamp(
                      ((e.clientX - r.left) / r.width) * scene.duration,
                      0,
                      scene.duration,
                    ),
                  );
                }
              }}
            >
              {Array.from(
                { length: Math.min(24, Math.ceil(scene.duration)) + 1 },
                (_, i) => (
                  <span
                    key={i}
                    style={{
                      left: `${(i / Math.min(24, Math.ceil(scene.duration))) * 100}%`,
                    }}
                  >
                    {(
                      (i / Math.min(24, Math.ceil(scene.duration))) *
                      scene.duration
                    ).toFixed(scene.duration > 24 ? 0 : 1)}
                    s
                  </span>
                ),
              )}
              <div
                className="ke-playhead-head"
                style={{ left: `${(time / scene.duration) * 100}%` }}
              />
            </div>
          </div>
          {scene.layers.filter(l => !l.sourceFrame).map((l) => (
            <div key={l.id}>
              {l.media && <div className="ke-track-row ke-media-row">
                <div className="ke-track-label">{l.media.frames.length} source frames</div>
                <div className="ke-media-frames" aria-label={`Frames for ${l.name}`}>
                  {l.media.frames.map(f => <button key={f.id}
                    aria-label={`${l.name} frame ${f.number} at ${f.timestamp}s`}
                    aria-pressed={mediaSelection?.layer === l.id && mediaSelection.frame === f.id && mediaSelection.time === time && !playing}
                    title={`Frame ${f.number} · ${f.timestamp}s · duration ${f.duration}s · PTS ${f.pts} × ${l.media!.timeBase}`}
                    onClick={() => {
                      const t=(l.startTime ?? 0)+f.timestamp; setPlaying(false); setTime(t);
                      select(scene.layers.find(path => path.sourceFrame?.frame === f.id && isEditableVector(path))?.id ?? l.id);
                      setMediaSelection({layer:l.id,frame:f.id,time:t});
                      if (f.vector?.status === 'error') setMessage(f.vector.error);
                      // Hydration has already loaded all saved SVGs from R2; this verifies
                      // the selected asset without replacing newer, unsaved path edits.
                      void frameSvg(projectId, l.id, f.id).catch(error => setMessage(error instanceof Error ? error.message : 'Could not load this frame’s SVG.'));
                    }}>
                    <img src={f.image} alt={`Frame ${f.number}`} loading="lazy" />
                    <span>#{f.number} · {f.timestamp}s</span>
                  </button>)}
                </div>
              </div>}
              <div
                className={`ke-track-row ${selected === l.id ? "selected" : ""}`}
              >
                <div className="ke-track-label">
                  <button
                    aria-label={`Expand ${l.name}`}
                    onClick={() =>
                      setExpanded((x) =>
                        x.includes(l.id)
                          ? x.filter((id) => id !== l.id)
                          : [...x, l.id],
                      )
                    }
                  >
                    {expanded.includes(l.id) ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </button>
                  <button onClick={() => select(l.id)}>
                    {l.type === "text" ? (
                      <Type size={13} />
                    ) : (
                      <Square size={13} />
                    )}
                    {l.name}
                  </button>
                </div>
                <div className="ke-track">
                  <div
                    className="ke-clip"
                    style={{
                      left: `${(100 * (l.startTime ?? 0)) / scene.duration}%`,
                      width: `${(100 * Math.max(0, (l.endTime ?? scene.duration) - (l.startTime ?? 0))) / scene.duration}%`,
                      right: "auto",
                    }}
                    onClick={() => select(l.id)}
                  />
                  <div
                    className="ke-playhead"
                    style={{ left: `${(time / scene.duration) * 100}%` }}
                  />
                </div>
              </div>
              {expanded.includes(l.id) &&
                properties
                  .filter(
                    (prop) =>
                      transformProperties.includes(
                        prop as (typeof transformProperties)[number],
                      ) || l.tracks[prop]?.length,
                  )
                  .map((prop) => (
                    <div key={prop} className="ke-property-row">
                      <div className="ke-track-label">
                        <span>{prop}</span>
                        <Button
                          label={`Key ${l.name} ${prop}`}
                          onClick={() => addKey(l.id, prop)}
                        >
                          <Diamond />
                        </Button>
                      </div>
                      <div
                        className="ke-track"
                        onDoubleClick={(e) => {
                          if (l.locked) return;
                          const r = e.currentTarget.getBoundingClientRect();
                          const t = clamp(
                            Math.round(
                              clamp(
                                ((e.clientX - r.left) / r.width) *
                                  scene.duration,
                                0,
                                scene.duration,
                              ) * (scene.fps ?? 60),
                            ) / (scene.fps ?? 60),
                            0,
                            scene.duration,
                          );
                          setPlaying(false);
                          setTime(t);
                          select(l.id);
                          commit({
                            ...scene,
                            layers: scene.layers.map((item) =>
                              item.id === l.id
                                ? setProperty(
                                    item,
                                    prop,
                                    evaluate(item, t)[prop],
                                    t,
                                    true,
                                  )
                                : item,
                            ),
                          });
                        }}
                      >
                        <div
                          className="ke-playhead"
                          style={{ left: `${(time / scene.duration) * 100}%` }}
                        />
                        {l.tracks[prop]?.map((k) => (
                          <button
                            key={k.id}
                            aria-label={`${l.name} ${prop} keyframe at ${k.time.toFixed(2)} seconds`}
                            className={`ke-key ${keySelection?.id === k.id ? "active" : ""}`}
                            style={{
                              left: `${(k.time / scene.duration) * 100}%`,
                            }}
                            onClick={() => {
                              select(l.id);
                              setKeySelection({ layer: l.id, prop, id: k.id });
                              setTime(k.time);
                              setPlaying(false);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              select(l.id);
                              setKeySelection({ layer: l.id, prop, id: k.id });
                              setTime(k.time);
                              setPlaying(false);
                              if (l.locked) return;
                              keyDrag.current = {
                                id: k.id,
                                pointer: e.pointerId,
                                x: e.clientX,
                                scene: sceneRef.current,
                                changed: false,
                              };
                              e.currentTarget.setPointerCapture(e.pointerId);
                            }}
                            onPointerUp={() => {
                              keyDrag.current = null;
                            }}
                            onPointerCancel={() => {
                              keyDrag.current = null;
                            }}
                            onPointerMove={(e) => {
                              const gesture = keyDrag.current;
                              if (
                                !gesture ||
                                gesture.id !== k.id ||
                                gesture.pointer !== e.pointerId ||
                                l.locked
                              )
                                return;
                              if (
                                !gesture.changed &&
                                Math.abs(e.clientX - gesture.x) < 2
                              )
                                return;
                              if (!gesture.changed) {
                                begin();
                                gesture.changed = true;
                              }
                              const r =
                                e.currentTarget.parentElement!.getBoundingClientRect();
                              const t = clamp(
                                Math.round(
                                  clamp(
                                    ((e.clientX - r.left) / r.width) *
                                      scene.duration,
                                    0,
                                    scene.duration,
                                  ) * (scene.fps ?? 60),
                                ) / (scene.fps ?? 60),
                                0,
                                scene.duration,
                              );
                              setTime(t);
                              setScene((s) => ({
                                ...s,
                                layers: gesture.scene.layers.map((item) =>
                                  item.id === l.id
                                    ? {
                                        ...item,
                                        tracks: {
                                          ...item.tracks,
                                          [prop]: item.tracks[prop]
                                            ?.filter(
                                              (f) =>
                                                f.id === k.id ||
                                                Math.abs(f.time - t) > 1e-9,
                                            )
                                            .map((f) =>
                                              f.id === k.id
                                                ? { ...f, time: t }
                                                : f,
                                            )
                                            .sort((a, b) => a.time - b.time),
                                        },
                                      }
                                    : item,
                                ),
                              }));
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
            </div>
          ))}
        </div>
      </section>
      <input
        ref={input}
        type="file"
        accept=".svg,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const element = e.currentTarget;
          if (importingMedia.current) { setMessage("A media import is already in progress."); element.value=""; return; }
          try {
            if (importKind.current === "media" || file.type?.startsWith("video/") || /\.(gif|mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
              importingMedia.current = true;
              const before = sceneRef.current;
              mediaAbort.current = new AbortController();
              const extracted = await importMedia(file, setMessage, mediaAbort.current.signal);
              const source = { ...extracted, files: { source: [{ name: file.name, data: await dataUrl(file) }] } };
              if (sceneRef.current !== before) throw new Error("The project changed during media extraction. Import again to replace it with the extracted frames.");
              // Preserve extraction immediately, even if tracing or remote storage fails.
              commit(source); setTime(0); setPlaying(false); setMediaSelection(null); setExpanded([]);
              const result = await vectorizeMedia(source, setMessage, mediaAbort.current.signal);
              if (sceneRef.current !== source) throw new Error('The project changed during vectorization. Extracted frames and local edits are preserved.');
              const data = result.scene;
              commit(data); select(data.layers.find(isEditableVector)?.id ?? data.layers.find(l => l.media)?.id ?? null); setImportReport(result.errors);
              setMessage(`Processed every source frame. ${result.errors.length ? `${result.errors.length} frame(s) failed; see the report.` : 'All frames have editable SVG paths.'} Saving project…`);
              return;
            }
            const fileLimit = /\.kinetic\.json$/i.test(file.name) ? 768 : 25;
            if (file.size > fileLimit * 1024 * 1024)
              throw new Error(`Import files up to ${fileLimit} MB.`);
            const text = await file.text();
            if (/\.json$/i.test(file.name)) {
              const raw = JSON.parse(text);
              const result =
                importKind.current === "lottie" || raw?.fr !== undefined
                  ? importLottie(raw, file.name)
                  : null;
              const data = result?.scene ?? validateScene(raw);
              if (result) data.files = { ...data.files, lottie: text };
              setImportReport(result?.warnings ?? []);
              setMessage(
                result
                  ? `Imported ${data.layers.length} editable layers at ${data.fps} fps.${result.warnings.length ? " See the import report for unsupported features." : ""}`
                  : "Project imported.",
              );
              setPlaying(false);
              setExpanded(data.layers.slice(0, 2).map((l) => l.id));
              commit(data);
              select(null);
              setTime(0);
            } else {
              const layers = importSvg(text, file.name);
              commit({
                ...scene,
                layers: [...layers.reverse(), ...scene.layers],
              });
              select(layers[0].id);
              setMessage(
                "Imported basic SVG shapes. Transforms, gradients, masks and CSS styles are not supported.",
              );
            }
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not import this file.",
            );
          } finally {
            importingMedia.current = false;
            element.value = "";
          }
        }}
      />
      {importReport.length > 0 && (
        <div className="ke-import-report" role="status">
          <details open>
            <summary>Lottie import report ({importReport.length})</summary>
            <ul>
              {importReport.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
          <button
            aria-label="Dismiss import report"
            onClick={() => setImportReport([])}
          >
            ?
          </button>
        </div>
      )}
      {message && (
        <div className="ke-toast" role="status">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
    </div>
  );
}
