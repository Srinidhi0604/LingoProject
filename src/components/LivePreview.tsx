"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Play, Loader2, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";

interface LivePreviewProps {
  isDarkMode: boolean;
  workspaceId: string;
  devServerUrl?: string | null;
}

interface DevServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  pid: number | null;
  error: string | null;
}

export default function LivePreview({ 
  isDarkMode, 
  workspaceId,
  devServerUrl 
}: LivePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(devServerUrl || null);
  const [serverStatus, setServerStatus] = useState<DevServerStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/devserver?workspaceId=${workspaceId}`);
      const data = await response.json();
      setServerStatus(data.status);
      
      if (data.status?.running && data.status?.url) {
        setPreviewUrl(data.status.url);
      }
    } catch (error) {
      console.error("Failed to check server status:", error);
    }
  }, [workspaceId]);

  const startDevServer = useCallback(async () => {
    setIsStarting(true);
    try {
      const response = await fetch("/api/devserver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "start",
        }),
      });
      
      const data = await response.json();
      setServerStatus(data.status);
      
      if (data.status?.running && data.status?.url) {
        setPreviewUrl(data.status.url);
      }
    } catch (error) {
      console.error("Failed to start dev server:", error);
    } finally {
      setIsStarting(false);
    }
  }, [workspaceId]);

  const refreshPreview = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (devServerUrl) {
      setPreviewUrl(devServerUrl);
    } else {
      checkServerStatus();
    }
  }, [devServerUrl, checkServerStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!serverStatus?.running) {
        checkServerStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [serverStatus?.running, checkServerStatus]);

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] border-l border-white/10">
      <div className="flex items-center justify-between bg-[#111] px-4 py-2 border-b border-white/10 select-none">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80 border border-red-500/20"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-500/20"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80 border border-green-500/20"></div>
          </div>
          
          <div className="flex items-center gap-1 bg-[#0A0A0A] border border-white/10 rounded-md px-2 py-1">
            <Monitor 
              className={`w-3.5 h-3.5 cursor-pointer transition-colors ${viewport === "desktop" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`} 
              onClick={() => setViewport("desktop")}
            />
            <Tablet 
              className={`w-3.5 h-3.5 cursor-pointer transition-colors ${viewport === "tablet" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`} 
              onClick={() => setViewport("tablet")}
            />
            <Smartphone 
              className={`w-3.5 h-3.5 cursor-pointer transition-colors ${viewport === "mobile" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`} 
              onClick={() => setViewport("mobile")}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0A0A0A] border border-white/10 rounded-md px-3 py-1 text-xs text-zinc-400 font-mono">
            {serverStatus?.running ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {previewUrl?.replace('http://', '') || "localhost:3000"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                Stopped
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={refreshPreview}
              disabled={!serverStatus?.running}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <a 
              href={previewUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className={`p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors ${!serverStatus?.running ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {!serverStatus?.running && (
              <button
                onClick={startDevServer}
                disabled={isStarting}
                className="flex items-center gap-1.5 px-2.5 py-1.5 ml-1 text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {isStarting ? "Starting..." : "Start"}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden bg-[#0A0A0A] relative flex items-center justify-center p-4">
        {previewUrl && serverStatus?.running ? (
          <div className={`bg-white rounded-md overflow-hidden shadow-2xl transition-all duration-300 ${
            viewport === "desktop" ? "w-full h-full" : 
            viewport === "tablet" ? "w-[768px] h-[1024px] max-h-full" : 
            "w-[375px] h-[812px] max-h-full"
          }`}>
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title="Live Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-4">
              <Monitor className="w-8 h-8 text-zinc-600" />
            </div>
            {serverStatus?.error ? (
              <>
                <h3 className="text-sm font-medium text-red-400 mb-2">Dev Server Error</h3>
                <p className="text-xs text-zinc-500 mb-4 whitespace-pre-wrap bg-red-500/10 p-3 rounded-md border border-red-500/20 text-left w-full overflow-auto max-h-32 custom-scrollbar">{serverStatus.error}</p>
                <button
                  onClick={startDevServer}
                  disabled={isStarting}
                  className="px-4 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
                >
                  Try Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Preview Not Running</h3>
                <p className="text-xs text-zinc-500 mb-6">Start the development server to see your changes in real-time.</p>
                <button
                  onClick={startDevServer}
                  disabled={isStarting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isStarting ? "Starting Server..." : "Start Dev Server"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
