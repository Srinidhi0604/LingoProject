"use client";

import type { ZoneLayout, ZoneSchema, ZoneSelection } from "@/types/zoneBuilder";

type Props = {
  schema: ZoneSchema | null;
  selection: ZoneSelection | null;
  onUpdateLayout: (zoneId: string, layout: ZoneLayout) => void;
};

function numberOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function ZoneInspectorPanel({ schema, selection, onUpdateLayout }: Props) {
  const node = schema?.nodes.find((n) => n.id === selection?.zoneId) || null;

  if (!schema) {
    return (
      <div className="h-full bg-[#0A0A0A] border-l border-white/10">
        <div className="h-9 flex items-center px-3 border-b border-white/10 bg-[#111]">
          <div className="text-xs font-medium text-zinc-300">Inspector</div>
        </div>
        <div className="p-4 text-xs text-zinc-500">Waiting for Builder…</div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="h-full bg-[#0A0A0A] border-l border-white/10">
        <div className="h-9 flex items-center px-3 border-b border-white/10 bg-[#111]">
          <div className="text-xs font-medium text-zinc-300">Inspector</div>
        </div>
        <div className="p-4 text-xs text-zinc-500">Select a zone to edit X/Y/W/H.</div>
      </div>
    );
  }

  const { layout } = node;

  return (
    <div className="h-full bg-[#0A0A0A] border-l border-white/10">
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 bg-[#111]">
        <div className="text-xs font-medium text-zinc-300">Inspector</div>
        <div className="text-xs text-zinc-500">{node.title}</div>
      </div>

      <div className="p-4 space-y-3">
        {(["x", "y", "width", "height"] as const).map((key) => (
          <label key={key} className="block">
            <div className="text-[11px] text-zinc-500 mb-1">{key.toUpperCase()}</div>
            <input
              className="w-full bg-[#111] border border-white/10 rounded px-2 py-1 text-xs text-zinc-200"
              value={String(layout[key])}
              onChange={(e) => {
                const next = { ...layout, [key]: numberOr(e.target.value, layout[key]) };
                onUpdateLayout(node.id, next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
