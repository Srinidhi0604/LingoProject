"use client";

import { useMemo, useState } from "react";
import type { BuilderNode, UISchema } from "@/builder/schema";
import { mapNodes } from "@/builder/schema";

export default function ComponentTreePanel({
  schema,
  onSchemaChange,
}: {
  schema: UISchema;
  onSchemaChange: (next: UISchema) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) }));
  };

  const selectedId = schema.selectedId || null;

  const nodes = useMemo(() => schema.root.children, [schema.root.children]);

  const updateName = (id: string, name: string) => {
    const nextRoot = mapNodes(schema.root, (n) => (n.id === id ? { ...n, name } : n));
    onSchemaChange({ ...schema, root: nextRoot });
  };

  const Row = ({ node, depth }: { node: BuilderNode; depth: number }) => {
    const isSelected = node.id === selectedId;
    const isExpanded = expanded[node.id] ?? true;
    return (
      <div className="w-full">
        <div
          className={
            "flex items-center gap-2 px-2 py-1 rounded text-xs select-none " +
            (isSelected ? "bg-indigo-500/10 text-indigo-300" : "text-zinc-300 hover:bg-white/5")
          }
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => onSchemaChange({ ...schema, selectedId: node.id })}
        >
          {node.children.length > 0 ? (
            <button
              className="w-4 h-4 text-zinc-500 hover:text-zinc-300"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className="text-[10px] text-zinc-500 w-12">{node.type}</span>
          <input
            className={
              "flex-1 bg-transparent outline-none border border-transparent rounded px-1 py-0.5 text-xs " +
              (isSelected ? "focus:border-indigo-500/30" : "focus:border-white/10")
            }
            value={node.name}
            onChange={(e) => updateName(node.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {node.children.length > 0 && isExpanded ? (
          <div className="mt-0.5">
            {node.children.map((c) => (
              <Row key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 bg-[#111]">
        <div className="text-xs font-medium text-zinc-300">Component Tree</div>
        <div className="text-[10px] text-zinc-500 font-mono">{nodes.length} nodes</div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-2">
        {nodes.length === 0 ? (
          <div className="text-xs text-zinc-600 px-2 py-2">No components yet.</div>
        ) : (
          nodes.map((n) => <Row key={n.id} node={n} depth={0} />)
        )}
      </div>
    </div>
  );
}
