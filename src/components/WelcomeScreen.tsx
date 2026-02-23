"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLingoContext } from "@lingo.dev/compiler/react";
import {
  Mic, Zap, FolderOpen, Plus, Upload, Code2, Sparkles,
  Globe, ArrowRight, Layers, Languages, Eye, Wand2,
  ChevronRight, Play, Monitor, ArrowUpRight,
} from "lucide-react";

const LOCALES = [
  { code: "en", name: "English", short: "EN", flag: "🇺🇸" },
  { code: "hi", name: "हिन्दी", short: "HI", flag: "🇮🇳" },
  { code: "kn", name: "ಕನ್ನಡ", short: "KN", flag: "🇮🇳" },
  { code: "es", name: "Español", short: "ES", flag: "🇪🇸" },
] as const;

interface WelcomeScreenProps {
  onCreateWorkspace: (name: string) => Promise<void>;
  onLoadWorkspace: (files: { path: string; content: string }[]) => Promise<void>;
  onLoadWorkspaceFromZip: (file: File) => Promise<void>;
  onLoadWorkspaceFromDirectory: (sourcePath: string) => Promise<void>;
  recentWorkspaces: { id: string; name: string; type: string; lastModified: number }[];
  onSelectRecent: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Section IDs used for smooth-scroll navigation                     */
/* ------------------------------------------------------------------ */
const NAV_SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "languages", label: "Languages" },
  { id: "get-started", label: "Get Started" },
] as const;

export default function WelcomeScreen({
  onCreateWorkspace,
  onLoadWorkspace,
  onLoadWorkspaceFromZip,
  onLoadWorkspaceFromDirectory,
  recentWorkspaces,
  onSelectRecent,
}: WelcomeScreenProps) {
  const { locale, setLocale } = useLingoContext();
  const [newProjectName, setNewProjectName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showLocales, setShowLocales] = useState(false);
  const localeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!localeMenuRef.current) return;
      if (!localeMenuRef.current.contains(e.target as Node)) setShowLocales(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      void onCreateWorkspace(newProjectName.trim());
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      if (file.name.toLowerCase().endsWith(".zip")) {
        await onLoadWorkspaceFromZip(file);
      } else {
        throw new Error("Only .zip imports are supported");
      }
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOpenFolder = async () => {
    const trimmed = folderPath.trim();
    if (!trimmed) return;
    setIsOpeningFolder(true);
    try {
      await Promise.resolve(onLoadWorkspaceFromDirectory(trimmed));
    } catch (e) {
      console.error("Open folder error:", e);
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 font-sans selection:bg-indigo-500/30 overflow-y-auto scroll-smooth">

      {/* ── Sticky Navigation ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
              <Mic className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">Voxera</span>
            <span className="hidden sm:inline text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full leading-none">
              powered by Lingo.dev
            </span>
          </button>

          {/* Section links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Language dropdown (Landing page) */}
            <div className="relative" ref={localeMenuRef}>
              <button
                type="button"
                onClick={() => setShowLocales((p) => !p)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-2"
                aria-label="Change language"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-[12px]">
                  {(LOCALES.find((l) => l.code === String(locale)) || LOCALES[0]).short}
                </span>
              </button>

              {showLocales && (
                <div className="absolute right-0 mt-2 w-44 bg-[#111] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold border-b border-white/5">
                    Language
                  </div>
                  {LOCALES.map((l) => {
                    const active = String(locale) === l.code;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setLocale(l.code as any);
                          setShowLocales(false);
                        }}
                        className={`w-full px-3 py-2.5 text-xs text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${
                          active ? "bg-indigo-500/10 text-white font-semibold" : "text-zinc-300"
                        }`}
                      >
                        <span className="text-base">{l.flag}</span>
                        <span className="flex-1">{l.name}</span>
                        {active ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                void onCreateWorkspace("my-app");
              }}
              className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5"
            >
              Open IDE <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section id="hero" className="relative pt-28 pb-24 px-6 max-w-6xl mx-auto overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-violet-500/10 to-transparent blur-3xl rounded-full" />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium mb-8 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Voice-Powered IDE &middot; Multilingual
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl leading-[1.08] font-extrabold text-white tracking-tight mb-6">
              Speak it.<br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Build it.</span><br />
              Ship it.
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 mb-8 max-w-lg leading-relaxed">
              A voice-first IDE that turns speech into React components instantly.
              Drag-and-drop builder, live preview, and real-time translations powered by{" "}
              <strong className="text-white">Lingo.dev</strong> — all in one workspace.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (!newProjectName.trim()) {
                    void onCreateWorkspace("my-app");
                  } else {
                    void onCreateWorkspace(newProjectName.trim());
                  }
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-full transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                <Play className="w-4 h-4" /> Launch IDE
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-transparent text-white hover:bg-white/5 border border-white/10 text-sm font-semibold rounded-full transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Import ZIP
              </button>
              <button
                onClick={() => scrollTo("features")}
                className="px-6 py-3 bg-transparent text-zinc-400 hover:text-white hover:bg-white/5 text-sm font-medium rounded-full transition-colors"
              >
                Explore Features
              </button>
            </div>

            <div className="mt-8 flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Local-first</span>
              <span className="w-px h-3 bg-white/10" />
              <span>4 Languages</span>
              <span className="w-px h-3 bg-white/10" />
              <span>Import any Next.js project</span>
            </div>
          </div>

          {/* Hero Mockup – IDE preview */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 bg-gradient-to-tr from-indigo-600/20 via-violet-500/15 to-transparent blur-3xl rounded-full opacity-60" />
            <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Title bar */}
              <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#111]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="text-[11px] font-medium text-zinc-500">Voxera IDE</div>
                <div className="w-14" />
              </div>
              {/* Content */}
              <div className="p-5 font-mono text-[13px] text-zinc-300 h-[380px] flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                  <Monitor className="w-3.5 h-3.5" /> Builder &middot; page.tsx
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <div className="text-purple-400">export default function <span className="text-blue-400">Dashboard</span>() {"{"}</div>
                  <div className="pl-4 text-zinc-400">return (</div>
                  <div className="pl-8 text-zinc-300">&lt;<span className="text-indigo-400">main</span> <span className="text-blue-300">className</span>=<span className="text-green-300">&quot;p-6&quot;</span>&gt;</div>

                  {/* Voice command badge */}
                  <div className="pl-10 flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/15 text-indigo-300 rounded-md border border-indigo-500/25 text-xs">
                      <Mic className="w-3 h-3 animate-pulse" />
                      &quot;एक प्रोफ़ाइल कार्ड बनाओ&quot;
                    </div>
                    <span className="text-zinc-600 text-[10px]">Hindi</span>
                  </div>

                  {/* Generated code */}
                  <div className="pl-10 border-l-2 border-indigo-500/50 pl-3 space-y-0.5 text-zinc-300">
                    <div>&lt;<span className="text-indigo-400">Card</span>&gt;</div>
                    <div className="pl-4">&lt;<span className="text-blue-400">Avatar</span> <span className="text-blue-300">src</span>=<span className="text-green-300">&quot;/me.jpg&quot;</span> /&gt;</div>
                    <div className="pl-4">&lt;<span className="text-blue-400">h2</span>&gt;प्रोफ़ाइल&lt;/<span className="text-blue-400">h2</span>&gt;</div>
                    <div>&lt;/<span className="text-indigo-400">Card</span>&gt;</div>
                  </div>

                  <div className="pl-8">&lt;/<span className="text-indigo-400">main</span>&gt;</div>
                  <div className="pl-4 text-zinc-400">);</div>
                  <div className="text-purple-400">{"}"}</div>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between text-[10px] text-zinc-600 border-t border-white/5 pt-2">
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-indigo-400" /> EN · HI · KN · ES</span>
                  <span>Lingo.dev</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ───────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 border-t border-white/5 bg-[#0A0A0A]/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-xs font-medium mb-4 border border-white/10">
              <Layers className="w-3.5 h-3.5" />
              Core Capabilities
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Everything You Need to Build
            </h2>
            <p className="text-base text-zinc-400 max-w-2xl mx-auto">
              From voice commands to live preview — a complete environment for building React apps visually and shipping them in any language.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <Mic className="w-5 h-5 text-indigo-400" />,
                title: "Voice-to-Component",
                desc: "Speak in any supported language and watch React components appear instantly — buttons, cards, forms, entire pages.",
                accent: "border-indigo-500/20 hover:border-indigo-500/40",
              },
              {
                icon: <Wand2 className="w-5 h-5 text-violet-400" />,
                title: "Visual Builder Canvas",
                desc: "Drag, drop and resize components on a live canvas. See changes reflected in code in real-time.",
                accent: "border-violet-500/20 hover:border-violet-500/40",
              },
              {
                icon: <Eye className="w-5 h-5 text-blue-400" />,
                title: "Live Preview & Hot Reload",
                desc: "Your imported Next.js project runs inside a real dev server. Every edit is reflected instantly in the preview.",
                accent: "border-blue-500/20 hover:border-blue-500/40",
              },
              {
                icon: <Languages className="w-5 h-5 text-emerald-400" />,
                title: "Lingo.dev Translations",
                desc: "Switch your entire app between English, Hindi, Kannada, and Spanish with a single click or voice command.",
                accent: "border-emerald-500/20 hover:border-emerald-500/40",
              },
              {
                icon: <Upload className="w-5 h-5 text-amber-400" />,
                title: "Import Any Project",
                desc: "Drop a ZIP or point to a local folder. Voxera wraps it with a builder overlay and translation layer automatically.",
                accent: "border-amber-500/20 hover:border-amber-500/40",
              },
              {
                icon: <Zap className="w-5 h-5 text-pink-400" />,
                title: "AI Agent Panel",
                desc: "An integrated agent tracks every voice operation, shows diffs and status, and helps you iterate faster.",
                accent: "border-pink-500/20 hover:border-pink-500/40",
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`bg-[#111]/50 border rounded-2xl p-6 transition-all duration-300 hover:bg-[#111] group ${f.accent}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Languages Section ──────────────────────────────────────── */}
      <section id="languages" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium mb-4 border border-emerald-500/20">
              <Globe className="w-3.5 h-3.5" />
              Multilingual
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Build in Your Language
            </h2>
            <p className="text-base text-zinc-400 max-w-2xl mx-auto">
              Speak voice commands and see your entire UI translated — powered by Lingo.dev&apos;s local translation engine with zero network calls.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { code: "EN", name: "English", native: "English", flag: "🇺🇸", accent: "from-blue-600/20 to-blue-500/5" },
              { code: "HI", name: "Hindi", native: "हिन्दी", flag: "🇮🇳", accent: "from-orange-600/20 to-orange-500/5" },
              { code: "KN", name: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳", accent: "from-red-600/20 to-red-500/5" },
              { code: "ES", name: "Spanish", native: "Español", flag: "🇪🇸", accent: "from-yellow-600/20 to-yellow-500/5" },
            ].map((lang) => (
              <div
                key={lang.code}
                className={`relative overflow-hidden bg-gradient-to-b ${lang.accent} border border-white/10 rounded-2xl p-6 text-center hover:border-white/20 transition-all group`}
              >
                <div className="text-4xl mb-3">{lang.flag}</div>
                <div className="text-sm font-bold text-white mb-0.5">{lang.name}</div>
                <div className="text-xs text-zinc-400">{lang.native}</div>
                <div className="mt-3 text-[10px] font-mono text-zinc-500 bg-black/20 rounded-md px-2 py-1 inline-block">
                  {lang.code.toLowerCase()}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-xs text-zinc-500">
              All translations run locally via Lingo.dev compiler &mdash; no remote servers, no WebSocket connections, complete privacy.
            </p>
          </div>
        </div>
      </section>

      {/* ── Get Started Section ────────────────────────────────────── */}
      <section id="get-started" className="py-24 px-6 border-t border-white/5 bg-[#0A0A0A]/60">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Start Building
            </h2>
            <p className="text-base text-zinc-400 max-w-xl mx-auto">
              Create a new project, import an existing one, or open a local folder to jump right in.
            </p>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* New Project */}
            <div className="bg-[#111]/80 rounded-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                  <Plus className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">New Project</h3>
                  <p className="text-xs text-zinc-500">Fresh Next.js workspace</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="my-app"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newProjectName.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Create <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Import ZIP */}
            <div className="bg-[#111]/80 rounded-2xl p-6 border border-white/10 hover:border-violet-500/30 transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                  <Upload className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Import ZIP</h3>
                  <p className="text-xs text-zinc-500">Existing Next.js project archive</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".zip" onChange={handleImport} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <span className="animate-pulse">Importing…</span>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-violet-400" /> Select ZIP File
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Open Folder */}
          <div className="bg-[#111]/80 rounded-2xl p-6 border border-white/10 hover:border-blue-500/20 transition-all mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Open Local Folder</h3>
                <p className="text-xs text-zinc-500">Point to any Next.js project on your machine</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="C:\path\to\nextjs-project"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpenFolder()}
                className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <button
                onClick={handleOpenFolder}
                disabled={!folderPath.trim() || isOpeningFolder}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isOpeningFolder ? "Opening…" : "Open"}
              </button>
            </div>
          </div>

          {/* Recent Projects */}
          {recentWorkspaces.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-1">Recent Projects</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentWorkspaces.slice(0, 6).map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => onSelectRecent(ws.id)}
                    className="flex items-center gap-3 p-3 bg-[#111]/50 hover:bg-white/5 border border-white/5 hover:border-white/15 rounded-xl transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                      <Code2 className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ws.name}</p>
                      <p className="text-[11px] text-zinc-600 truncate">
                        {ws.type === "imported" ? "Imported" : "Created"} &middot; {new Date(ws.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Mic className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-bold text-white">Voxera</span>
            <span className="text-zinc-600">&middot;</span>
            <span className="text-xs text-zinc-500">Powered by Lingo.dev</span>
          </div>

          <div className="flex items-center gap-6">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-zinc-600">&copy; 2026 Voxera. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
