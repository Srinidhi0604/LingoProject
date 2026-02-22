"use client";

import { useState, useRef } from "react";
import { Mic, Zap, FolderOpen, Plus, Upload, Code2, Sparkles, Keyboard, Lock, Cloud, Globe, History } from "lucide-react";

interface WelcomeScreenProps {
  onCreateWorkspace: (name: string) => Promise<void>;
  onLoadWorkspace: (files: { path: string; content: string }[]) => Promise<void>;
  onLoadWorkspaceFromZip: (file: File) => Promise<void>;
  onLoadWorkspaceFromDirectory: (sourcePath: string) => Promise<void>;
  recentWorkspaces: { id: string; name: string; type: string; lastModified: number }[];
  onSelectRecent: (id: string) => void;
}

export default function WelcomeScreen({ 
  onCreateWorkspace, 
  onLoadWorkspace, 
  onLoadWorkspaceFromZip,
  onLoadWorkspaceFromDirectory,
  recentWorkspaces, 
  onSelectRecent,
}: WelcomeScreenProps) {
  const [newProjectName, setNewProjectName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  if (showApp) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-[#111]/50 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white">Get Started</h2>
            </div>
            <button onClick={() => setShowApp(false)} className="text-sm text-zinc-400 hover:text-white transition-colors">
              Back to home
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#111]/80 rounded-xl p-6 border border-white/10 hover:border-indigo-500/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                <Plus className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-medium text-white mb-2">New Project</h3>
              <p className="text-sm text-zinc-400 mb-4">Create a fresh Next.js workspace from scratch.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newProjectName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </div>

            <div className="bg-[#111]/80 rounded-xl p-6 border border-white/10 hover:border-purple-500/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                <Upload className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-base font-medium text-white mb-2">Import ZIP</h3>
              <p className="text-sm text-zinc-400 mb-4">Upload an existing Next.js project archive.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isImporting ? "Importing..." : "Select ZIP File"}
              </button>
            </div>
          </div>

          <div className="bg-[#111]/80 rounded-xl p-6 border border-white/10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-medium text-white">Open Local Folder</h3>
                <p className="text-sm text-zinc-400">Load a directory directly from your filesystem.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="C:\path\to\nextjs-project"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpenFolder()}
                className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <button
                onClick={handleOpenFolder}
                disabled={!folderPath.trim() || isOpeningFolder}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isOpeningFolder ? "Opening..." : "Open"}
              </button>
            </div>
          </div>

          {recentWorkspaces.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-3 px-1">Recent Projects</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentWorkspaces.slice(0, 4).map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => onSelectRecent(ws.id)}
                    className="flex items-center gap-3 p-3 bg-[#111]/50 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Code2 className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ws.name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {new Date(ws.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 font-sans selection:bg-indigo-500/30 overflow-y-auto">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Mic className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Voxera</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <span className="hover:text-white cursor-pointer transition-colors">Features</span>
            <span className="hover:text-white cursor-pointer transition-colors">Pricing</span>
            <span className="hover:text-white cursor-pointer transition-colors">FAQ</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
              Log in
            </button>
            <button 
              onClick={() => setShowApp(true)}
              className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-sm font-medium rounded-full transition-colors"
            >
              Get Voxera
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium mb-8 border border-yellow-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Voice-to-code for React
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.05] font-bold text-white tracking-tight mb-6">
              Voice in.<br />
              Code out.<br />
              Instant.
            </h1>
            
            <p className="text-lg text-zinc-400 mb-8 max-w-md leading-relaxed">
              Press a hotkey, speak naturally, and watch your words insert React code instantly in any app.
              <br /><br />
              <strong className="text-white">Local AI. No cloud required.</strong>
            </p>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowApp(true)}
                className="px-6 py-3 bg-white text-black hover:bg-zinc-200 text-sm font-semibold rounded-full transition-colors flex items-center gap-2"
              >
                Get Voxera - Free
              </button>
              <button className="px-6 py-3 bg-transparent text-white hover:bg-white/5 border border-white/10 text-sm font-semibold rounded-full transition-colors">
                See features
              </button>
            </div>
            
            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Open-source • No subscription required
            </div>
          </div>
          
          {/* Hero Mockup */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-2xl rounded-full opacity-50"></div>
            <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="h-10 border-b border-white/10 flex items-center px-4 bg-[#111]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                </div>
                <div className="mx-auto text-xs font-medium text-zinc-500">page.tsx</div>
              </div>
              <div className="p-6 font-mono text-sm text-zinc-300 h-[400px] flex flex-col">
                <div className="text-zinc-500 mb-4">{`// Press ⌘ + Space to speak`}</div>
                <div className="flex-1">
                  <div className="text-purple-400">export default function <span className="text-blue-400">Hero</span>() {'{'}</div>
                  <div className="pl-4 text-zinc-400">return (</div>
                  <div className="pl-8 text-zinc-300">&lt;<span className="text-indigo-400">div</span> <span className="text-blue-300">className</span>=<span className="text-green-300">&quot;min-h-screen bg-black&quot;</span>&gt;</div>
                  
                  {/* Typing animation simulation */}
                  <div className="pl-12 text-zinc-300 flex items-center gap-1 mt-2">
                    <div className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 text-xs flex items-center gap-2">
                      <Mic className="w-3 h-3 animate-pulse" />
                      &quot;Add a glowing hero headline&quot;
                    </div>
                  </div>
                  <div className="pl-12 text-zinc-300 mt-2 border-l-2 border-indigo-500 pl-2">
                    &lt;<span className="text-indigo-400">h1</span> <span className="text-blue-300">className</span>=<span className="text-green-300">&quot;text-6xl font-bold text-white drop-shadow-glow&quot;</span>&gt;<br/>
                    <span className="pl-4">Next Generation IDE</span><br/>
                    &lt;/<span className="text-indigo-400">h1</span>&gt;
                  </div>
                  
                  <div className="pl-8 text-zinc-300 mt-2">&lt;/<span className="text-indigo-400">div</span>&gt;</div>
                  <div className="pl-4 text-zinc-400">);</div>
                  <div className="text-purple-400">{'}'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature 1: Push to Talk */}
      <section className="py-24 px-6 border-t border-white/5 bg-[#0A0A0A]">
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-xs font-medium mb-6 border border-white/10">
            <Keyboard className="w-3.5 h-3.5" />
            Global Hotkey
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Push-to-Talk Dictation.
          </h2>
          
          <p className="text-lg text-zinc-400 mb-16 max-w-2xl leading-relaxed">
            It&apos;s like a walkie-talkie for your IDE. Hold the shortcut, speak your mind, release to insert. Or tap once to toggle. Works in VS Code, Cursor, WebStorm — everywhere.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 flex flex-col justify-center">
              <div className="flex items-start gap-4 mb-8">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Hold to Speak</h3>
                  <p className="text-sm text-zinc-400">Sotto listens while you hold and transcribes when you release.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Instant Insert</h3>
                  <p className="text-sm text-zinc-400">No copy-paste needed. Text appears directly in your active app.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 flex items-center justify-center">
              <div className="bg-[#050505] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                <div className="text-xs font-medium text-zinc-500 mb-4 text-center">Shortcut</div>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center shadow-inner">
                    <span className="text-xl text-white font-medium">⌘</span>
                  </div>
                  <span className="text-zinc-500">+</span>
                  <div className="h-16 px-8 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center shadow-inner">
                    <span className="text-sm text-white font-medium">Space</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Privacy Grid */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Voice-first. Privacy-first.
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Built for professionals who value speed and privacy.
          </p>
        </div>
        
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: <Keyboard className="w-5 h-5 text-yellow-500" />, title: "Push-to-Talk or Toggle", desc: "Hold to speak, or press once to start/stop. Fully customizable hotkeys." },
            { icon: <Zap className="w-5 h-5 text-blue-500" />, title: "Auto-Paste Anywhere", desc: "Transcribe pastes directly into any app. No copy-paste needed." },
            { icon: <Lock className="w-5 h-5 text-emerald-500" />, title: "100% Local & Private", desc: "Models run entirely on your machine. Your audio never leaves your device." },
            { icon: <Cloud className="w-5 h-5 text-purple-500" />, title: "Cloud Models Available", desc: "Connect OpenAI or Groq for maximum accuracy. Great for science and tech terms." },
            { icon: <Globe className="w-5 h-5 text-pink-500" />, title: "Native App", desc: "Built with Rust and React for a true native experience. Lightweight and fast." },
            { icon: <History className="w-5 h-5 text-orange-500" />, title: "Recording History", desc: "Every recording saved with a transcript. Search, replay, and re-transcribe anytime." }
          ].map((feature, i) => (
            <div key={i} className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 hover:bg-[#111] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-white font-medium mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 mb-4">
          <Mic className="w-4 h-4" />
          <span className="font-semibold text-white">Voxera</span>
        </div>
        <p className="text-xs text-zinc-600">© 2026 Voxera. All rights reserved.</p>
      </footer>
    </div>
  );
}
