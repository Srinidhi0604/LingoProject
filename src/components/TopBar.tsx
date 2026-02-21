"use client";

import { useState } from "react";
import { Mic, Settings, Layout, Terminal, Play, Github } from "lucide-react";

interface TopBarProps {
  projectName: string;
  mode: "agent" | "ide";
  onModeChange: (mode: "agent" | "ide") => void;
  fileCount: number;
}

export default function TopBar({ projectName, mode, onModeChange, fileCount }: TopBarProps) {
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
          <button className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors">File</button>
          <button className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors">Edit</button>
          <button className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors">View</button>
          <button className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors">Terminal</button>
        </div>
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
          <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors" title="Layout">
            <Layout className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors" title="Terminal">
            <Terminal className="w-4 h-4" />
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
