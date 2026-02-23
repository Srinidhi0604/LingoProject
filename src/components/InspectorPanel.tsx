"use client";

import { useMemo, useState } from "react";
import type { BuilderNode, UISchema } from "@/builder/schema";
import { findNode } from "@/builder/schema";
import { updateLayout, updateProps } from "@/builder/mutations";
import { ChevronDown, ChevronRight, Trash2, Copy, Eye, EyeOff } from "lucide-react";

type InspectorPanelProps = {
  schema: UISchema;
  onCommitSchema: (next: UISchema) => void;
};

function asNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-4 text-[10px] text-zinc-500 font-medium">{label}</span>
      <div className="flex-1 relative">
        <input
          className="w-full h-7 px-2 rounded-md bg-[#111] border border-white/10 text-[11px] font-mono text-zinc-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          inputMode="numeric"
          defaultValue={String(value)}
          key={value}
          onBlur={(e) => onChange(asNumber(e.currentTarget.value, value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange(asNumber(e.currentTarget.value, value));
              e.currentTarget.blur();
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.shiftKey ? 10 : 1;
              const next = asNumber(e.currentTarget.value, value) + step;
              e.currentTarget.value = String(next);
              onChange(next);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const step = e.shiftKey ? 10 : 1;
              const next = asNumber(e.currentTarget.value, value) - step;
              e.currentTarget.value = String(next);
              onChange(next);
            }
          }}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-600">{suffix}</span>}
      </div>
    </label>
  );
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
        <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 bg-[#111] select-none">
          <div className="text-xs font-medium text-zinc-300">Design</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
            <Eye className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-500 text-center">Select an element on the canvas to inspect and edit its properties.</p>
        </div>
      </div>
    );
  }

  const text = typeof selected.props.text === "string" ? selected.props.text : "";

  const commitLayout = (partial: Partial<{ x: number; y: number; w: number; h: number }>) => {
    const nextSchema = updateLayout(schema, selected.id, partial);
    onCommitSchema(nextSchema);
  };

  const commitProp = (key: string, value: unknown) => {
    const nextSchema = updateProps(schema, selected.id, { [key]: value });
    onCommitSchema(nextSchema);
  };

  return (
    <div className="h-full bg-[#0A0A0A] flex flex-col min-h-0">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/10 bg-[#111] select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-indigo-400">{selected.type.charAt(0).toUpperCase()}</span>
          </div>
          <div className="text-xs font-medium text-zinc-200 truncate">{selected.name}</div>
        </div>
        <div className="text-[10px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">{selected.type}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {/* ── Position & Size (Figma-style) ─────────── */}
        <Section title="Layout" defaultOpen>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberInput label="X" value={selected.layout.x} onChange={(v) => commitLayout({ x: v })} suffix="px" />
            <NumberInput label="Y" value={selected.layout.y} onChange={(v) => commitLayout({ y: v })} suffix="px" />
            <NumberInput label="W" value={selected.layout.w} onChange={(v) => commitLayout({ w: Math.max(1, v) })} suffix="px" />
            <NumberInput label="H" value={selected.layout.h} onChange={(v) => commitLayout({ h: Math.max(1, v) })} suffix="px" />
          </div>

          {/* Dimensions display */}
          <div className="mt-3 flex items-center gap-2 px-1">
            <div className="flex-1 h-8 rounded-md bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-mono text-zinc-400">
              {selected.layout.w} × {selected.layout.h}
            </div>
            <div className="text-[9px] text-zinc-600">px</div>
          </div>
        </Section>

        {/* ── Rotation & Opacity ──────────────────── */}
        <Section title="Appearance" defaultOpen>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberInput
              label="R"
              value={Number(selected.props.rotation || 0)}
              onChange={(v) => commitProp("rotation", v)}
              suffix="°"
            />
            <NumberInput
              label="O"
              value={Number(selected.props.opacity ?? 100)}
              onChange={(v) => commitProp("opacity", Math.min(100, Math.max(0, v)))}
              suffix="%"
            />
          </div>
        </Section>

        {/* ── Fill ──────────────────────────────────── */}
        <Section title="Fill" defaultOpen>
          <div className="flex items-center gap-2">
            <input
              type="color"
              defaultValue={String(selected.props.backgroundColor || "#ffffff")}
              onChange={(e) => commitProp("backgroundColor", e.target.value)}
              className="w-7 h-7 rounded-md border border-white/10 bg-transparent cursor-pointer"
            />
            <input
              className="flex-1 h-7 px-2 rounded-md bg-[#111] border border-white/10 text-[11px] font-mono text-zinc-200 outline-none focus:border-indigo-500/50"
              defaultValue={String(selected.props.backgroundColor || "#ffffff")}
              key={String(selected.props.backgroundColor || "#ffffff")}
              onBlur={(e) => commitProp("backgroundColor", e.currentTarget.value)}
            />
          </div>
        </Section>

        {/* ── Stroke ────────────────────────────────── */}
        <Section title="Stroke" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              defaultValue={String(selected.props.borderColor || "#333333")}
              onChange={(e) => commitProp("borderColor", e.target.value)}
              className="w-7 h-7 rounded-md border border-white/10 bg-transparent cursor-pointer"
            />
            <NumberInput
              label=""
              value={Number(selected.props.borderWidth || 0)}
              onChange={(v) => commitProp("borderWidth", v)}
              suffix="px"
            />
          </div>
          <div className="mt-2">
            <NumberInput
              label="R"
              value={Number(selected.props.borderRadius || 0)}
              onChange={(v) => commitProp("borderRadius", v)}
              suffix="px"
            />
          </div>
        </Section>

        {/* ── Typography ────────────────────────────── */}
        {selected.type !== "image" && (
          <Section title="Typography" defaultOpen>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <NumberInput
                  label="Sz"
                  value={Number(selected.props.fontSize || 14)}
                  onChange={(v) => commitProp("fontSize", v)}
                  suffix="px"
                />
                <NumberInput
                  label="Lh"
                  value={Number(selected.props.lineHeight || 1.5)}
                  onChange={(v) => commitProp("lineHeight", v)}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={String(selected.props.fontWeight || "400")}
                  onChange={(e) => commitProp("fontWeight", e.target.value)}
                  className="flex-1 h-7 px-1.5 rounded-md bg-[#111] border border-white/10 text-[11px] text-zinc-200 outline-none focus:border-indigo-500/50"
                >
                  {["100", "200", "300", "400", "500", "600", "700", "800", "900"].map((w) => (
                    <option key={w} value={w}>Weight {w}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => commitProp("textAlign", align)}
                    className={`flex-1 h-7 rounded-md text-[10px] font-medium transition-colors ${
                      selected.props.textAlign === align
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-[#111] text-zinc-500 hover:text-zinc-300 border border-white/10"
                    }`}
                  >
                    {align.charAt(0).toUpperCase() + align.slice(1)}
                  </button>
                ))}
              </div>

              <input
                type="color"
                defaultValue={String(selected.props.color || "#ffffff")}
                onChange={(e) => commitProp("color", e.target.value)}
                className="w-full h-7 rounded-md border border-white/10 bg-transparent cursor-pointer"
              />
            </div>
          </Section>
        )}

        {/* ── Content ───────────────────────────────── */}
        {selected.type !== "image" && (
          <Section title="Content" defaultOpen>
            <textarea
              className="w-full h-20 px-2 py-1.5 rounded-md bg-[#111] border border-white/10 text-xs text-zinc-200 outline-none focus:border-indigo-500/50 resize-none font-mono"
              defaultValue={text}
              key={text}
              placeholder="Enter text content..."
              onBlur={(e) => {
                const nextText = e.currentTarget.value;
                const nextSchema = updateProps(schema, selected.id, { text: nextText });
                onCommitSchema(nextSchema);
              }}
            />
          </Section>
        )}

        {/* ── Spacing ───────────────────────────────── */}
        <Section title="Spacing" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberInput label="PL" value={Number(selected.props.paddingLeft || 0)} onChange={(v) => commitProp("paddingLeft", v)} suffix="px" />
            <NumberInput label="PR" value={Number(selected.props.paddingRight || 0)} onChange={(v) => commitProp("paddingRight", v)} suffix="px" />
            <NumberInput label="PT" value={Number(selected.props.paddingTop || 0)} onChange={(v) => commitProp("paddingTop", v)} suffix="px" />
            <NumberInput label="PB" value={Number(selected.props.paddingBottom || 0)} onChange={(v) => commitProp("paddingBottom", v)} suffix="px" />
          </div>
        </Section>
      </div>
    </div>
  );
}
