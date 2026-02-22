"use client";

import { useMemo } from "react";
import type { BuilderNode, UISchema } from "@/builder/schema";
import { findNode } from "@/builder/schema";
import { updateLayout, updateProps } from "@/builder/mutations";

type InspectorPanelProps = {
  schema: UISchema;
  onCommitSchema: (next: UISchema) => void;
};

function asNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function InspectorPanel({ schema, onCommitSchema }: InspectorPanelProps) {
  const selected: BuilderNode | null = useMemo(() => {
    const id = schema.selectedId;
    if (!id) return null;
    return findNode(schema.root, id);
  }, [schema.root, schema.selectedId]);

  if (!selected) {
    return (
      <div className="h-full bg-[#0A0A0A] flex flex-col min-h-0">
        <div className="h-9 flex items-center px-3 border-b border-white/10 bg-[#111] text-xs font-medium text-zinc-300 select-none">
          Inspector
        </div>
        <div className="flex-1 min-h-0 p-3 text-xs text-zinc-500">
          Select an element to inspect.
        </div>
      </div>
    );
  }

  const text = typeof selected.props.text === "string" ? selected.props.text : "";

  return (
    <div className="h-full bg-[#0A0A0A] flex flex-col min-h-0">
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 bg-[#111] select-none">
        <div className="text-xs font-medium text-zinc-300">Inspector</div>
        <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[180px]">{selected.type}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">
        <div className="space-y-1">
          <div className="text-[11px] text-zinc-400">Name</div>
          <div className="text-xs text-zinc-200">{selected.name}</div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] text-zinc-400">Layout</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "x", label: "X", value: selected.layout.x },
                { key: "y", label: "Y", value: selected.layout.y },
                { key: "w", label: "W", value: selected.layout.w },
                { key: "h", label: "H", value: selected.layout.h },
              ] as const
            ).map((f) => (
              <label key={f.key} className="flex items-center gap-2">
                <span className="w-4 text-[11px] text-zinc-500">{f.label}</span>
                <input
                  className="flex-1 h-8 px-2 rounded bg-[#111] border border-white/10 text-xs text-zinc-200 outline-none focus:border-indigo-500/40"
                  inputMode="numeric"
                  defaultValue={String(f.value)}
                  onBlur={(e) => {
                    const nextVal = asNumber(e.currentTarget.value, f.value);
                    const nextSchema = updateLayout(schema, selected.id, { [f.key]: nextVal });
                    onCommitSchema(nextSchema);
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        {selected.type !== "image" ? (
          <div className="space-y-2">
            <div className="text-[11px] text-zinc-400">Text</div>
            <input
              className="w-full h-8 px-2 rounded bg-[#111] border border-white/10 text-xs text-zinc-200 outline-none focus:border-indigo-500/40"
              defaultValue={text}
              onBlur={(e) => {
                const nextText = e.currentTarget.value;
                const nextSchema = updateProps(schema, selected.id, { text: nextText });
                onCommitSchema(nextSchema);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
