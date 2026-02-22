"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Trash2, RefreshCw } from "lucide-react";

type DevServerStatus = {
  running: boolean;
  port: number | null;
  url: string | null;
  pid: number | null;
  error: string | null;
  logs?: string[];
};

export default function TerminalPanel({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<DevServerStatus | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/devserver?workspaceId=${workspaceId}`);
    const data = await res.json();
    const s: DevServerStatus | null = data?.status || null;
    setStatus(s);
    if (Array.isArray(s?.logs)) {
      setLines(s!.logs);
    }
  }, [workspaceId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchStatus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchStatus]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = window.setInterval(() => {
      void fetchStatus();
    }, 1500);
    return () => window.clearInterval(interval);
  }, [fetchStatus, isPolling]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const headerRight = status?.running
    ? (status.url?.replace(/^https?:\/\//, "") || `localhost:${status.port ?? "?"}`)
    : "Stopped";

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] border-t border-white/10 min-h-0">
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/10 bg-[#111] select-none">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
          <TerminalIcon className="w-4 h-4 text-zinc-400" />
          Terminal
          <span className="ml-2 text-[10px] font-mono text-zinc-500">{headerRight}</span>
          {status?.error ? (
            <span className="ml-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
              {status.error}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPolling((p) => !p)}
            className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors"
            title="Toggle live updates"
          >
            {isPolling ? "Live" : "Paused"}
          </button>
          <button
            onClick={() => void fetchStatus()}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLines([])}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[11px] leading-5 text-zinc-300 px-3 py-2 custom-scrollbar">
        {lines.length === 0 ? (
          <div className="text-zinc-600">No logs yet.</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="whitespace-pre-wrap break-words">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
