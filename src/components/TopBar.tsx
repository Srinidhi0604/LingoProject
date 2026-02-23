"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Settings, Layout, Terminal, Play, PanelLeft, PanelRight, PanelBottom, MessagesSquare, Globe, ChevronDown, FileText, FilePlus, FolderOpen, Download, Undo2, Redo2, Copy, Scissors, Clipboard, Eye, Columns, PanelTop, Maximize } from "lucide-react";

const LOCALES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "kn", name: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

type MenuItem = { label: string; shortcut?: string; action?: () => void; divider?: boolean; disabled?: boolean };

interface TopBarProps {
  projectName: string;
  mode: "agent" | "ide";
  onModeChange: (mode: "agent" | "ide") => void;
  fileCount: number;
  currentLocale?: string;
  onLocaleChange?: (locale: string) => void;
  workbench?: "builder" | "code";
  onWorkbenchChange?: (wb: "builder" | "code") => void;
  onNewFile?: () => void;
  onExportProject?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleFullscreen?: () => void;
  layoutControls?: {
    explorerVisible: boolean;
    terminalVisible: boolean;
    previewDock: "right" | "bottom" | "hidden";
    agentDock: "right" | "bottom" | "hidden";
    onToggleExplorer: () => void;
    onToggleTerminal: () => void;
    onCyclePreviewDock: () => void;
    onCycleAgentDock: () => void;
  };
}

function MenuDropdown({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 w-56 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[60]">
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="h-px bg-white/5 mx-2 my-1" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { item.action?.(); onClose(); }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-[10px] text-zinc-600 font-mono">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

export default function TopBar({
  projectName, mode, onModeChange, fileCount, currentLocale, onLocaleChange,
  workbench, onWorkbenchChange, onNewFile, onExportProject, onUndo, onRedo, onToggleFullscreen,
  layoutControls,
}: TopBarProps) {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const activeLang = LOCALES.find((l) => l.code === currentLocale) || LOCALES[0];

  const closeMenu = useCallback(() => setActiveMenu(null), []);

  const fileItems: MenuItem[] = [
    { label: "New File", shortcut: "Ctrl+N", action: onNewFile },
    { divider: true },
    { label: "Export Project", shortcut: "Ctrl+Shift+E", action: onExportProject },
    { divider: true },
    { label: "Close Workspace", action: () => window.location.reload() },
  ];

  const editItems: MenuItem[] = [
    { label: "Undo", shortcut: "Ctrl+Z", action: onUndo },
    { label: "Redo", shortcut: "Ctrl+Shift+Z", action: onRedo },
    { divider: true },
    { label: "Cut", shortcut: "Ctrl+X", action: () => document.execCommand("cut") },
    { label: "Copy", shortcut: "Ctrl+C", action: () => document.execCommand("copy") },
    { label: "Paste", shortcut: "Ctrl+V", action: () => document.execCommand("paste") },
  ];

  const viewItems: MenuItem[] = [
    { label: "Builder", shortcut: "Ctrl+1", action: () => onWorkbenchChange?.("builder") },
    { label: "Code Editor", shortcut: "Ctrl+2", action: () => onWorkbenchChange?.("code") },
    { divider: true },
    { label: "Toggle Explorer", action: layoutControls?.onToggleExplorer },
    { label: "Toggle Terminal", action: layoutControls?.onToggleTerminal },
    { label: "Cycle Preview Dock", action: layoutControls?.onCyclePreviewDock },
    { divider: true },
    { label: "Fullscreen", shortcut: "F11", action: onToggleFullscreen || (() => document.documentElement.requestFullscreen?.()) },
  ];

  const terminalItems: MenuItem[] = [
    { label: "Show Terminal", action: layoutControls?.onToggleTerminal },
    { label: "Show Agent Panel", action: layoutControls?.onCycleAgentDock },
  ];

  const menus: { key: string; label: string; items: MenuItem[] }[] = [
    { key: "file", label: "File", items: fileItems },
    { key: "edit", label: "Edit", items: editItems },
    { key: "view", label: "View", items: viewItems },
    { key: "terminal", label: "Terminal", items: terminalItems },
  ];

  return (
    <div className="h-12 bg-[#0A0A0A] border-b border-white/10 flex items-center justify-between px-4 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Mic className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-zinc-200">{projectName}</span>
        </div>
        
        <div className="h-4 w-px bg-white/10"></div>
        
        <div className="flex items-center gap-1">
          {menus.map((m) => (
            <div key={m.key} className="relative">
              <button
                onClick={() => setActiveMenu((p) => (p === m.key ? null : m.key))}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  activeMenu === m.key
                    ? "text-white bg-white/10"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                {m.label}
              </button>
              {activeMenu === m.key && <MenuDropdown items={m.items} onClose={closeMenu} />}
            </div>
          ))}
        </div>

        <div className="h-4 w-px bg-white/10"></div>

        {/* Translation dropdown */}
        {onLocaleChange && (
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setShowLangMenu((p) => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#111] border border-white/10 hover:border-indigo-500/40 rounded-lg transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeLang.flag}</span>
              <span className="hidden sm:inline">{activeLang.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>
            {showLangMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold border-b border-white/5">
                  Lingo.dev Translation
                </div>
                {LOCALES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { onLocaleChange(l.code); setShowLangMenu(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs transition-colors ${
                      l.code === currentLocale
                        ? "bg-indigo-500/10 text-white font-medium"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span>{l.name}</span>
                    {l.code === currentLocale && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 bg-[#111] border border-white/5 rounded-md p-0.5">
        <button
          onClick={() => onModeChange("agent")}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            mode === "agent"
              ? "bg-white/10 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Agent
        </button>
        <button
          onClick={() => onModeChange("ide")}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            mode === "ide"
              ? "bg-white/10 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          IDE
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 mr-2">
          {layoutControls ? (
            <>
              <button
                onClick={layoutControls.onToggleExplorer}
                className={`p-1.5 rounded transition-colors ${layoutControls.explorerVisible ? "text-zinc-200 bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                title="Toggle Explorer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <button
                onClick={layoutControls.onCyclePreviewDock}
                className={`p-1.5 rounded transition-colors ${layoutControls.previewDock !== "hidden" ? "text-zinc-200 bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                title="Cycle Preview Dock (Right/Bottom/Hidden)"
              >
                {layoutControls.previewDock === "bottom" ? (
                  <PanelBottom className="w-4 h-4" />
                ) : (
                  <PanelRight className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={layoutControls.onCycleAgentDock}
                className={`p-1.5 rounded transition-colors ${layoutControls.agentDock !== "hidden" ? "text-zinc-200 bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                title="Cycle Agent Dock (Right/Bottom/Hidden)"
              >
                <MessagesSquare className="w-4 h-4" />
              </button>

              <button
                onClick={layoutControls.onToggleTerminal}
                className={`p-1.5 rounded transition-colors ${layoutControls.terminalVisible ? "text-zinc-200 bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                title="Toggle Terminal"
              >
                <Terminal className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-white/10 mx-1" />
            </>
          ) : null}

          <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors" title="Layout">
            <Layout className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-md text-xs font-medium transition-colors">
          <Play className="w-3.5 h-3.5" />
          Preview
        </button>
      </div>
    </div>
  );
}
