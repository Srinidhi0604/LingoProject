"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  VoxeraBuilderToParentMessage,
  VoxeraParentToBuilderMessage,
} from "@/types/zoneBuilder";

type DevServerStatus = {
  running: boolean;
  port: number | null;
  url: string | null;
  pid: number | null;
  error: string | null;
};

export type ZoneBuilderBridge = {
  postToBuilder: (msg: VoxeraParentToBuilderMessage) => void;
  postToPreview: (msg: unknown) => void;
};

type Props = {
  workspaceId: string;
  onBridgeReady: (bridge: ZoneBuilderBridge) => void;
  onBuilderMessage: (msg: VoxeraBuilderToParentMessage) => void;
};

function withBuilderParam(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("voxeraBuilder", "1");
    u.searchParams.set("voxeraShowLang", "1");
    return u.toString();
  } catch {
    const hasQ = url.includes("?");
    const join = hasQ ? "&" : "?";
    return url + join + "voxeraBuilder=1&voxeraShowLang=1";
  }
}

export default function ImportedZoneBuilderPreview({ workspaceId, onBridgeReady, onBuilderMessage }: Props) {
  const [serverStatus, setServerStatus] = useState<DevServerStatus | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postToPreview = useCallback((msg: unknown) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(msg, "*");
  }, []);

  const postToBuilder = useCallback(
    (msg: VoxeraParentToBuilderMessage) => {
      postToPreview(msg);
    },
    [postToPreview],
  );

  useEffect(() => {
    onBridgeReady({ postToBuilder, postToPreview });
  }, [onBridgeReady, postToBuilder, postToPreview]);

  const startDevServer = useCallback(async () => {
    const response = await fetch("/api/devserver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, action: "start" }),
    });

    const data = await response.json();
    setServerStatus(data.status);
    if (data.status?.running && data.status?.url) {
      setPreviewUrl(withBuilderParam(data.status.url));
    }
  }, [workspaceId]);

  const checkServerStatus = useCallback(async () => {
    const response = await fetch(`/api/devserver?workspaceId=${workspaceId}`);
    const data = await response.json();
    setServerStatus(data.status);
    if (data.status?.running && data.status?.url) {
      setPreviewUrl(withBuilderParam(data.status.url));
    }
  }, [workspaceId]);

  useEffect(() => {
    void checkServerStatus();
  }, [checkServerStatus]);

  useEffect(() => {
    if (serverStatus?.running) return;
    const t = setTimeout(() => void startDevServer(), 300);
    return () => clearTimeout(t);
  }, [serverStatus?.running, startDevServer]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const raw = event.data;
      if (!raw || typeof raw !== "object") return;
      const maybe = raw as Record<string, unknown>;
      const type = maybe["type"];
      if (typeof type !== "string" || !type.startsWith("voxera:")) return;
      onBuilderMessage(raw as VoxeraBuilderToParentMessage);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onBuilderMessage]);

  const frame = useMemo(() => {
    if (!previewUrl || !serverStatus?.running) return null;

    return (
      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="w-full h-full border-0"
        title="Builder Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }, [previewUrl, serverStatus?.running]);

  return (
    <div className="h-full w-full bg-[#0A0A0A]">
      {serverStatus?.error ? (
        <div className="p-4 text-sm text-red-400">{serverStatus.error}</div>
      ) : frame ? (
        frame
      ) : (
        <div className="p-4 text-sm text-zinc-400">Starting preview…</div>
      )}
    </div>
  );
}
