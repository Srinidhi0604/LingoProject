"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BuilderNode, UISchema } from "@/builder/schema";
import { findNode } from "@/builder/schema";
import { createHistory, pushHistory, redo, undo, type HistoryState } from "@/builder/history";
import { removeNode, select, updateLayout } from "@/builder/mutations";
import ShadowScope from "@/components/ShadowScope";

type CanvasProps = {
  history: HistoryState;
  setHistory: React.Dispatch<React.SetStateAction<HistoryState>>;
  workspaceId?: string;
};

type DragMode =
  | { kind: "none" }
  | { kind: "move"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: "resize"; id: string; handle: "se"; startX: number; startY: number; originW: number; originH: number };

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

export default function BuilderCanvas({ history, setHistory, workspaceId }: CanvasProps) {
  const schema = history.present;
  const selectedId = schema.selectedId || null;

  const [stylesheets, setStylesheets] = useState<string[]>([]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragMode>({ kind: "none" });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const setSchema = useCallback(
    (next: UISchema) => {
      setHistory((prev) => pushHistory(prev, next));
    },
    [setHistory]
  );

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
    // Best-effort: pull compiled CSS from the workspace dev server.
    // This renders imported dashboard components with real styling inside the builder scope.
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

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const next = Math.min(2.5, Math.max(0.25, zoom + delta * 0.001));
    setZoom(next);
  };

  const beginMove = (id: string, e: React.PointerEvent) => {
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

  const beginResize = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    const node = findNode(schema.root, id);
    if (!node) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      id,
      handle: "se",
      startX: e.clientX,
      startY: e.clientY,
      originW: node.layout.w,
      originH: node.layout.h,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d.kind === "none") return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (d.kind === "move") {
      setHistory((prev) => {
        const nextSchema = updateLayout(prev.present, d.id, {
          x: Math.round(d.originX + dx),
          y: Math.round(d.originY + dy),
        });
        return { ...prev, present: nextSchema };
      });
    } else if (d.kind === "resize") {
      setHistory((prev) => {
        const nextSchema = updateLayout(prev.present, d.id, {
          w: Math.max(40, Math.round(d.originW + dx)),
          h: Math.max(24, Math.round(d.originH + dy)),
        });
        return { ...prev, present: nextSchema };
      });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (d.kind === "none") return;
    dragRef.current = { kind: "none" };
    // finalize: push current present as history entry
    setHistory((prev) => pushHistory(prev, prev.present));
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Pan
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

    // Click empty canvas clears selection
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
        onDeleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const nodes = schema.root.children;

  const content = (
    <div className="h-full w-full bg-[#050505] relative overflow-hidden" onWheel={onWheel}>
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 text-[11px] text-zinc-400 bg-[#111] border border-white/10 rounded-md px-2 py-1 select-none">
        <span>Builder</span>
        <span className="text-zinc-600">|</span>
        <span className="font-mono">{Math.round(zoom * 100)}%</span>
      </div>

      <div
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        />

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
                className={
                  "group border rounded-md bg-white/5 overflow-hidden " +
                  (isSelected ? "border-indigo-400 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]" : "border-white/10 hover:border-white/20")
                }
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setHistory((prev) => ({ ...prev, present: select(prev.present, n.id) }));
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-6 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    beginMove(n.id, e);
                  }}
                >
                  <div className="px-2 h-full flex items-center justify-between text-[10px] text-zinc-300 select-none">
                    <span className="truncate">{n.name}</span>
                    <span className="text-zinc-500">{n.type}</span>
                  </div>
                </div>

                <div className="absolute inset-0 p-3 pt-8">
                  {renderNode(n)}
                </div>

                {isSelected ? (
                  <div
                    className="absolute -right-1 -bottom-1 w-3 h-3 bg-indigo-400 rounded-sm cursor-nwse-resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      beginResize(n.id, e);
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // If we have workspace stylesheets, render the editable scene inside Shadow DOM so
  // imported Tailwind/CSS does not leak into Voxera chrome.
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
