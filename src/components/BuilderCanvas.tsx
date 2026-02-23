"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BuilderNode, UISchema } from "@/builder/schema";
import { findNode } from "@/builder/schema";
import { createHistory, pushHistory, redo, undo, type HistoryState } from "@/builder/history";
import { removeNode, select, updateLayout } from "@/builder/mutations";
import ShadowScope from "@/components/ShadowScope";
import {
  MousePointer2, Hand, Square, Type, Image, Minus, Plus,
  Undo2, Redo2, AlignStartVertical, AlignEndVertical,
  AlignCenterHorizontal, AlignStartHorizontal, AlignEndHorizontal,
  AlignCenterVertical, Lock, Unlock,
} from "lucide-react";

type CanvasProps = {
  history: HistoryState;
  setHistory: React.Dispatch<React.SetStateAction<HistoryState>>;
  workspaceId?: string;
};

type DragMode =
  | { kind: "none" }
  | { kind: "move"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: "resize"; id: string; handle: string; startX: number; startY: number; originW: number; originH: number; originX: number; originY: number };

type CanvasTool = "select" | "hand" | "rectangle" | "text" | "image";

const RULER_SIZE = 24;
const SNAP_THRESHOLD = 6;

function renderNode(node: BuilderNode): JSX.Element {
  const Tag: React.ElementType = (() => {
    if (node.type === "heading") {
      const level = (node.props.level as number) || 1;
      return `h${Math.min(6, Math.max(1, level))}`;
    }
    if (node.type === "paragraph") return "p";
    if (node.type === "text") return "span";
    if (node.type === "link") return "a";
    if (node.type === "image") return "img";
    return node.type;
  })();

  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
  };

  const props: Record<string, unknown> = { ...node.props };
  const text = typeof props.text === "string" ? props.text : "";
  delete props.text;

  if (node.type === "image") {
    return <Tag style={style} {...props} />;
  }

  return (
    <Tag style={style} {...props}>
      {node.children.length === 0 ? text : node.children.map((c) => <div key={c.id}>{renderNode(c)}</div>)}
    </Tag>
  );
}

/* ── Ruler component ──────────────────────────────── */
function Ruler({ axis, zoom, pan, size }: { axis: "x" | "y"; zoom: number; pan: number; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = (axis === "x" ? size : RULER_SIZE) * dpr;
    canvas.height = (axis === "x" ? RULER_SIZE : size) * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, axis === "x" ? size : RULER_SIZE, axis === "x" ? RULER_SIZE : size);

    const step = zoom >= 0.5 ? (zoom >= 1 ? 50 : 100) : 200;
    const smallStep = step / 5;

    ctx.fillStyle = "#555";
    ctx.font = "9px monospace";
    ctx.textBaseline = axis === "x" ? "top" : "middle";

    const start = -Math.ceil(pan / (step * zoom)) * step - step * 2;
    const end = start + (size / zoom) + step * 4;

    for (let v = start; v <= end; v += smallStep) {
      const pos = v * zoom + pan;
      const isMajor = Math.abs(v % step) < 0.1;

      ctx.strokeStyle = isMajor ? "#444" : "#2a2a2a";
      ctx.lineWidth = 1;
      ctx.beginPath();

      if (axis === "x") {
        const tickH = isMajor ? RULER_SIZE : RULER_SIZE * 0.4;
        ctx.moveTo(pos, RULER_SIZE - tickH);
        ctx.lineTo(pos, RULER_SIZE);
        if (isMajor) ctx.fillText(String(Math.round(v)), pos + 3, 2);
      } else {
        const tickW = isMajor ? RULER_SIZE : RULER_SIZE * 0.4;
        ctx.moveTo(RULER_SIZE - tickW, pos);
        ctx.lineTo(RULER_SIZE, pos);
        if (isMajor) {
          ctx.save();
          ctx.translate(2, pos + 3);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(Math.round(v)), 0, 0);
          ctx.restore();
        }
      }
      ctx.stroke();
    }

    // Bottom/Right border
    ctx.strokeStyle = "#333";
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(0, RULER_SIZE - 0.5);
      ctx.lineTo(size, RULER_SIZE - 0.5);
    } else {
      ctx.moveTo(RULER_SIZE - 0.5, 0);
      ctx.lineTo(RULER_SIZE - 0.5, size);
    }
    ctx.stroke();
  }, [axis, zoom, pan, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: axis === "x" ? size : RULER_SIZE,
        height: axis === "x" ? RULER_SIZE : size,
        position: "absolute",
        [axis === "x" ? "left" : "top"]: RULER_SIZE,
        [axis === "x" ? "top" : "left"]: 0,
        zIndex: 15,
      }}
    />
  );
}

export default function BuilderCanvas({ history, setHistory, workspaceId }: CanvasProps) {
  const schema = history.present;
  const selectedId = schema.selectedId || null;

  const [stylesheets, setStylesheets] = useState<string[]>([]);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 800 });
  const [showGrid, setShowGrid] = useState(true);
  const [aspectLock, setAspectLock] = useState(false);
  const dragRef = useRef<DragMode>({ kind: "none" });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Snap guides
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const setSchema = useCallback(
    (next: UISchema) => {
      setHistory((prev) => pushHistory(prev, next));
    },
    [setHistory]
  );

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        setHistory((prev) => undo(prev));
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        setHistory((prev) => redo(prev));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setHistory]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) return;

    (async () => {
      try {
        const res = await fetch(`/api/devserver/meta?workspaceId=${encodeURIComponent(workspaceId)}`);
        const data = await res.json();
        const next = Array.isArray(data?.stylesheets) ? (data.stylesheets as string[]) : [];
        if (!cancelled) setStylesheets(next);
      } catch {
        if (!cancelled) setStylesheets([]);
      }
    })();

    return () => { cancelled = true; };
  }, [workspaceId]);

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const next = Math.min(4, Math.max(0.1, zoom + delta * 0.001));
      setZoom(next);
    } else if (tool === "hand" || e.shiftKey) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  // Compute snap guides for a given moving/resizing node.
  const computeGuides = useCallback((nodeId: string, nx: number, ny: number, nw: number, nh: number) => {
    const nodes = schema.root.children.filter((c) => c.id !== nodeId);
    const xSnaps: number[] = [];
    const ySnaps: number[] = [];

    const edges = [
      { pos: nx, dim: "x" }, { pos: nx + nw / 2, dim: "x" }, { pos: nx + nw, dim: "x" },
      { pos: ny, dim: "y" }, { pos: ny + nh / 2, dim: "y" }, { pos: ny + nh, dim: "y" },
    ];

    for (const other of nodes) {
      const ox = other.layout.x, oy = other.layout.y, ow = other.layout.w, oh = other.layout.h;
      const otherEdgesX = [ox, ox + ow / 2, ox + ow];
      const otherEdgesY = [oy, oy + oh / 2, oy + oh];

      for (const e of edges) {
        if (e.dim === "x") {
          for (const oe of otherEdgesX) {
            if (Math.abs(e.pos - oe) < SNAP_THRESHOLD / zoom) xSnaps.push(oe);
          }
        } else {
          for (const oe of otherEdgesY) {
            if (Math.abs(e.pos - oe) < SNAP_THRESHOLD / zoom) ySnaps.push(oe);
          }
        }
      }
    }

    setGuides({ x: [...new Set(xSnaps)], y: [...new Set(ySnaps)] });
  }, [schema.root.children, zoom]);

  const beginMove = (id: string, e: React.PointerEvent) => {
    if (tool !== "select") return;
    e.preventDefault();
    const node = findNode(schema.root, id);
    if (!node) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: node.layout.x,
      originY: node.layout.y,
    };
  };

  const beginResize = (id: string, handle: string, e: React.PointerEvent) => {
    if (tool !== "select") return;
    e.preventDefault();
    const node = findNode(schema.root, id);
    if (!node) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      originW: node.layout.w,
      originH: node.layout.h,
      originX: node.layout.x,
      originY: node.layout.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d.kind === "none") return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (d.kind === "move") {
      const nx = Math.round(d.originX + dx);
      const ny = Math.round(d.originY + dy);
      const node = findNode(schema.root, d.id);
      if (node) computeGuides(d.id, nx, ny, node.layout.w, node.layout.h);
      setHistory((prev) => {
        const nextSchema = updateLayout(prev.present, d.id, { x: nx, y: ny });
        return { ...prev, present: nextSchema };
      });
    } else if (d.kind === "resize") {
      let newW = Math.max(24, Math.round(d.originW + dx));
      let newH = Math.max(24, Math.round(d.originH + dy));
      if (aspectLock && d.originW > 0) {
        const ratio = d.originH / d.originW;
        newH = Math.round(newW * ratio);
      }
      computeGuides(d.id, d.originX, d.originY, newW, newH);
      setHistory((prev) => {
        const nextSchema = updateLayout(prev.present, d.id, { w: newW, h: newH });
        return { ...prev, present: nextSchema };
      });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (d.kind === "none") return;
    dragRef.current = { kind: "none" };
    setGuides({ x: [], y: [] });
    setHistory((prev) => pushHistory(prev, prev.present));
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (tool === "hand" || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      const origin = { ...pan };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        setPan({ x: origin.x + (ev.clientX - start.x), y: origin.y + (ev.clientY - start.y) });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }

    if (e.target === e.currentTarget) {
      setSchema(select(schema, null));
    }
  };

  const onDeleteSelected = () => {
    if (!selectedId) return;
    setSchema(removeNode(schema, selectedId));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        onDeleteSelected();
      }
      // Tool shortcuts
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "h" || e.key === "H") setTool("hand");
      if (e.key === "r" || e.key === "R") setTool("rectangle");
      if (e.key === "t" || e.key === "T") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") setTool("text");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectedNode = selectedId ? findNode(schema.root, selectedId) : null;
  const nodes = schema.root.children;

  const TOOLS: { key: CanvasTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { key: "select", icon: <MousePointer2 className="w-4 h-4" />, label: "Select", shortcut: "V" },
    { key: "hand", icon: <Hand className="w-4 h-4" />, label: "Hand", shortcut: "H" },
    { key: "rectangle", icon: <Square className="w-4 h-4" />, label: "Rectangle", shortcut: "R" },
    { key: "text", icon: <Type className="w-4 h-4" />, label: "Text", shortcut: "T" },
    { key: "image", icon: <Image className="w-4 h-4" />, label: "Image", shortcut: "I" },
  ];

  const content = (
    <div ref={containerRef} className="h-full w-full bg-[#1a1a1a] relative overflow-hidden flex flex-col">
      {/* ── Figma-style Toolbar ──────────────────────────── */}
      <div className="h-11 bg-[#0A0A0A] border-b border-white/10 flex items-center justify-between px-3 shrink-0 z-20">
        {/* Left: Tools */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              title={`${t.label} (${t.shortcut})`}
              className={`p-2 rounded-lg transition-all ${
                tool === t.key
                  ? "bg-indigo-500/20 text-indigo-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
            >
              {t.icon}
            </button>
          ))}

          <div className="w-px h-5 bg-white/10 mx-2" />

          {/* Undo / Redo */}
          <button
            onClick={() => setHistory((p) => undo(p))}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setHistory((p) => redo(p))}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Selected element info */}
        <div className="flex items-center gap-3 text-[11px]">
          {selectedNode ? (
            <>
              <span className="text-zinc-300 font-medium">{selectedNode.name}</span>
              <span className="text-zinc-600">·</span>
              <span className="font-mono text-zinc-500">
                {selectedNode.layout.w} × {selectedNode.layout.h}
              </span>
            </>
          ) : (
            <span className="text-zinc-500">No selection</span>
          )}
        </div>

        {/* Right: Zoom + Grid + Aspect Lock */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAspectLock((p) => !p)}
            title="Lock aspect ratio"
            className={`p-2 rounded-lg transition-colors ${aspectLock ? "text-indigo-400 bg-indigo-500/15" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
          >
            {aspectLock ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.15))}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors min-w-[44px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.15))}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Canvas Area with Rulers ─────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Corner square */}
        <div className="absolute top-0 left-0 z-20" style={{ width: RULER_SIZE, height: RULER_SIZE, background: "#0A0A0A", borderRight: "1px solid #333", borderBottom: "1px solid #333" }} />

        {/* Rulers */}
        <Ruler axis="x" zoom={zoom} pan={pan.x} size={canvasSize.w - RULER_SIZE} />
        <Ruler axis="y" zoom={zoom} pan={pan.y} size={canvasSize.h - RULER_SIZE - 44} />

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="absolute overflow-hidden"
          style={{ top: RULER_SIZE, left: RULER_SIZE, right: 0, bottom: 0, cursor: tool === "hand" ? "grab" : "default" }}
          onWheel={onWheel}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Grid */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                transform: `translate(${pan.x % (24 * zoom)}px, ${pan.y % (24 * zoom)}px)`,
              }}
            />
          )}

          {/* Snap Guides */}
          {guides.x.map((gx, i) => (
            <div
              key={`gx-${i}`}
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: gx * zoom + pan.x, width: 1, background: "rgba(255,0,100,0.6)", zIndex: 30 }}
            />
          ))}
          {guides.y.map((gy, i) => (
            <div
              key={`gy-${i}`}
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: gy * zoom + pan.y, height: 1, background: "rgba(255,0,100,0.6)", zIndex: 30 }}
            />
          ))}

          {/* Nodes layer */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {nodes.map((n) => {
              const isSelected = n.id === selectedId;
              return (
                <div
                  key={n.id}
                  style={{
                    position: "absolute",
                    left: n.layout.x,
                    top: n.layout.y,
                    width: n.layout.w,
                    height: n.layout.h,
                  }}
                  className="group"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setHistory((prev) => ({ ...prev, present: select(prev.present, n.id) }));
                  }}
                >
                  {/* Node body */}
                  <div
                    className={
                      "absolute inset-0 rounded-md overflow-hidden transition-shadow " +
                      (isSelected
                        ? "ring-2 ring-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]"
                        : "border border-white/10 hover:border-white/25")
                    }
                  >
                    <div className="absolute inset-0 bg-white/5">{renderNode(n)}</div>
                  </div>

                  {/* Drag handle (top bar) */}
                  <div
                    className="absolute inset-x-0 -top-0.5 h-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10"
                    onPointerDown={(e) => { e.stopPropagation(); beginMove(n.id, e); }}
                  >
                    <div className="mx-auto mt-1 w-10 h-1 rounded-full bg-zinc-500/80" />
                  </div>

                  {/* Selection UI: resize handles + dimension labels */}
                  {isSelected && (
                    <>
                      {/* Dimension label */}
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-indigo-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-20">
                        {n.layout.w} × {n.layout.h}
                      </div>

                      {/* Position label */}
                      <div className="absolute -top-5 left-0 text-[9px] font-mono bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded whitespace-nowrap z-20">
                        {n.layout.x}, {n.layout.y}
                      </div>

                      {/* Resize handles: 4 corners + 4 edges */}
                      {/* SE */}
                      <div className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-[#1a1a1a] cursor-nwse-resize z-20"
                        onPointerDown={(e) => { e.stopPropagation(); beginResize(n.id, "se", e); }} />
                      {/* NE */}
                      <div className="absolute -right-1.5 -top-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-[#1a1a1a] cursor-nesw-resize z-20"
                        onPointerDown={(e) => { e.stopPropagation(); beginResize(n.id, "ne", e); }} />
                      {/* NW */}
                      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-[#1a1a1a] cursor-nwse-resize z-20"
                        onPointerDown={(e) => { e.stopPropagation(); beginResize(n.id, "nw", e); }} />
                      {/* SW */}
                      <div className="absolute -left-1.5 -bottom-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-[#1a1a1a] cursor-nesw-resize z-20"
                        onPointerDown={(e) => { e.stopPropagation(); beginResize(n.id, "sw", e); }} />
                    </>
                  )}

                  {/* Hover name badge */}
                  {!isSelected && (
                    <div className="absolute -top-5 left-0 text-[9px] font-medium bg-zinc-800/90 text-zinc-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                      {n.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (stylesheets.length > 0) {
    return (
      <ShadowScope stylesheets={stylesheets}>
        {content}
      </ShadowScope>
    );
  }

  return content;
}

export function createCanvasHistory(initial: UISchema): HistoryState {
  return createHistory(initial);
}
