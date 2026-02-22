"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useLingoContext } from "@lingo.dev/compiler/react";
import { VoiceIntent } from "@/types/intent";
import { FileNode, isFile, isDirectory } from "@/types/filesystem";
import { AgentOperation, FileChange, createOperation, updateOperationStatus, addFileChange } from "@/types/agent";
import { ShadowFileStatus } from "@/types/shadow";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { executeVoiceOperation, VoiceOperationResult } from "@/lib/voiceOperations";
import TopBar from "@/components/TopBar";
import FileExplorer from "@/components/FileExplorer";
import CodeEditorPanel from "@/components/CodeEditorPanel";
import LivePreview from "@/components/LivePreview";
import AgentPanel from "@/components/AgentPanel";
import VoiceInputBar from "@/components/VoiceInputBar";
import WelcomeScreen from "@/components/WelcomeScreen";
import ResizableSplit from "@/components/ResizableSplit";
import TerminalPanel from "@/components/TerminalPanel";
import BuilderCanvas from "@/components/BuilderCanvas";
import ComponentTreePanel from "@/components/ComponentTreePanel";
import InspectorPanel from "@/components/InspectorPanel";

import ImportedZoneBuilderPreview, { type ZoneBuilderBridge } from "@/components/ImportedZoneBuilderPreview";
import ZoneInspectorPanel from "@/components/ZoneInspectorPanel";

import type { ZoneLayout, ZoneSchema, ZoneSelection, VoxeraBuilderToParentMessage } from "@/types/zoneBuilder";

import { type BuilderComponentType, type BuilderNode } from "@/builder/schema";
import { addChild } from "@/builder/mutations";
import { useVisualEngine } from "@/visual/useVisualEngine";

type SupportedLocale = "en" | "kn" | "hi";

type APIResponse = {
  success: boolean;
  transcript?: string;
  detectedLocale?: SupportedLocale;
  intent?: VoiceIntent;
  message?: string;
};

interface OperationWithShadow extends AgentOperation {
  shadowStatus?: ShadowFileStatus;
  validationErrors?: string[];
}

type LayoutState = {
  bottomTab: "terminal" | "agent";
  workbench: "builder" | "code";
  leftTab: "files" | "layers";
  sizes: {
    leftWidth: number;
    centerWidth: number;
    topHeight: number;
  };
};

const DEFAULT_LAYOUT: LayoutState = {
  bottomTab: "terminal",
  workbench: "builder",
  leftTab: "files",
  sizes: {
    leftWidth: 260,
    centerWidth: 980,
    topHeight: 620,
  },
};

function IDEContent() {
  const { locale, setLocale } = useLingoContext();
  const workspace = useWorkspace();
  const [operations, setOperations] = useState<OperationWithShadow[]>([]);
  const [currentOperation, setCurrentOperation] = useState<OperationWithShadow | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDarkMode] = useState(false);
  const [mode, setMode] = useState<"agent" | "ide">("agent");
  const [layout, setLayout] = useState<LayoutState>(() => {
    if (typeof window === "undefined") return DEFAULT_LAYOUT;
    try {
      const raw = localStorage.getItem("voxera.layout.v2");
      if (!raw) return DEFAULT_LAYOUT;
      const parsed = JSON.parse(raw) as Partial<LayoutState>;
      return {
        ...DEFAULT_LAYOUT,
        ...parsed,
        sizes: { ...DEFAULT_LAYOUT.sizes, ...(parsed.sizes || {}) },
      };
    } catch {
      return DEFAULT_LAYOUT;
    }
  });

  const [languagePrompt, setLanguagePrompt] = useState<{ locale: SupportedLocale } | null>(null);

  const [zoneSchemas, setZoneSchemas] = useState<Record<string, ZoneSchema>>({});
  const [zoneActiveRouteKey, setZoneActiveRouteKey] = useState<string | null>(null);
  const [zoneSelection, setZoneSelection] = useState<ZoneSelection | null>(null);
  const [zoneBridge, setZoneBridge] = useState<ZoneBuilderBridge | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("voxera.layout.v2", JSON.stringify(layout));
    } catch {
      // ignore
    }
  }, [layout]);

  const allFiles = useMemo(() => {
    const files: FileNode[] = [];
    
    const collectFiles = (node: unknown) => {
      if (isFile(node as FileNode)) {
        files.push(node as FileNode);
      } else if (isDirectory(node as Parameters<typeof isDirectory>[0])) {
        (node as { children: unknown[] }).children.forEach(collectFiles);
      }
    };
    
    collectFiles(workspace.fileSystem.root);
    return files;
  }, [workspace.fileSystem]);

  const compareContent = useCallback((oldContent: string, newContent: string): { additions: number; deletions: number } => {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    
    let additions = 0;
    let deletions = 0;
    
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldLines.length) additions++;
      else if (i >= newLines.length) deletions++;
      else if (oldLines[i] !== newLines[i]) {
        deletions++;
        additions++;
      }
    }
    
    return { additions, deletions };
  }, []);

  const findFileByPath = useCallback((path: string): FileNode | null => {
    const find = (node: unknown, searchPath: string): FileNode | null => {
      if (isFile(node as FileNode)) {
        if ((node as FileNode).path === searchPath) return node as FileNode;
      } else if (isDirectory(node as Parameters<typeof isDirectory>[0])) {
        for (const child of (node as { children: unknown[] }).children) {
          const found = find(child, searchPath);
          if (found) return found;
        }
      }
      return null;
    };
    return find(workspace.fileSystem.root, path);
  }, [workspace.fileSystem]);

  const computeEntryPagePath = useCallback((): string => {
    const selected = workspace.selectedFilePath;
    if (selected && /(^|\/)page\.(t|j)sx$/i.test(selected)) return selected;

    const candidates = ["app/page.tsx", "src/app/page.tsx", "page.tsx", "pages/index.tsx", "pages/index.jsx"];
    for (const c of candidates) {
      const f = findFileByPath(c);
      if (f) return c;
    }
    return "app/page.tsx";
  }, [findFileByPath, workspace.selectedFilePath]);

  const visual = useVisualEngine({
    activeWorkspaceId: workspace.activeWorkspace?.id || null,
    workbench: layout.workbench,
    findFileByPath,
    computeEntryPagePath,
    workspaceApi: { updateFile: workspace.updateFile },
  });

  const visualHistory = visual.history;
  const visualSchemaRef = visual.schemaRef;
  const setHistoryForCanvas = visual.setHistoryForCanvas;
  const commitVisualSchema = visual.commitSchema;
  const initializeVisualFromCode = visual.initializeFromCode;

  const onImportedBuilderMessage = useCallback((msg: VoxeraBuilderToParentMessage) => {
    if (msg.type === "voxera:ready" || msg.type === "voxera:schemaChanged") {
      setZoneSchemas((prev) => ({ ...prev, [msg.routeKey]: msg.schema }));
      return;
    }

    if (msg.type === "voxera:zoneSelected") {
      setZoneActiveRouteKey(msg.routeKey);
      setZoneSelection(msg.selection);
      return;
    }
  }, []);

  const activeZoneSchema = useMemo(() => {
    if (zoneActiveRouteKey && zoneSchemas[zoneActiveRouteKey]) return zoneSchemas[zoneActiveRouteKey];
    const keys = Object.keys(zoneSchemas);
    if (keys.length === 0) return null;
    return zoneSchemas[keys[keys.length - 1]];
  }, [zoneActiveRouteKey, zoneSchemas]);

  const updateSelectedZoneLayout = useCallback((zoneId: string, layout: ZoneLayout) => {
    const routeKey = zoneActiveRouteKey;
    if (!routeKey) return;

    setZoneSchemas((prev) => {
      const current = prev[routeKey];
      if (!current) return prev;
      const nextNodes = current.nodes.map((n) => (n.id === zoneId ? { ...n, layout } : n));
      return { ...prev, [routeKey]: { ...current, nodes: nextNodes } };
    });

    zoneBridge?.postToBuilder({
      type: "voxera:setZoneLayout",
      routeKey,
      zoneId,
      layout,
    });
  }, [zoneActiveRouteKey, zoneBridge]);

  useEffect(() => {
    if (!workspace.activeWorkspace) return;
    if (layout.workbench !== "builder") return;
    if (workspace.activeWorkspace.type === "imported") return;
    const pagePath = computeEntryPagePath();
    initializeVisualFromCode(pagePath);
  }, [computeEntryPagePath, initializeVisualFromCode, layout.workbench, workspace.activeWorkspace]);

  const executeIntent = useCallback(async (intent: VoiceIntent, transcript: string, detectedLanguage: string) => {
    if (!intent || intent.type === "none") {
      console.log("[Voice Engine] No valid intent to execute");
      return;
    }

    const operation = createOperation(transcript, transcript, detectedLanguage);
    setCurrentOperation({ ...operation, shadowStatus: "pending" });
    setIsProcessing(true);

    const entryPagePath = computeEntryPagePath();

    const oldPageContent = findFileByPath(entryPagePath);
    const oldContent = oldPageContent ? oldPageContent.content : "";

    let result: VoiceOperationResult;

    if (workspace.activeWorkspace?.type !== "imported" && layout.workbench === "builder" && intent.type === "component.create" && intent.component?.type) {
      const typeRaw = String(intent.component.type || "div");
      const type: BuilderComponentType =
        typeRaw === "button" ||
        typeRaw === "div" ||
        typeRaw === "heading" ||
        typeRaw === "paragraph" ||
        typeRaw === "text" ||
        typeRaw === "input" ||
        typeRaw === "image" ||
        typeRaw === "link"
          ? typeRaw
          : "div";

      const text = typeof intent.component.props?.text === "string" ? (intent.component.props.text as string) : undefined;
      const nextNode = {
        name: (text && text.trim()) ? text.trim() : type,
        type,
        props: { ...(intent.component.props || {}), ...(text ? { text } : {}) },
        layout: {
          x: 80,
          y: 120 + visualSchemaRef.current.root.children.length * 70,
          w: 260,
          h: type === "heading" ? 56 : 48,
        },
        children: [],
      } satisfies Omit<BuilderNode, "id">;

      const nextSchema = addChild(visualSchemaRef.current, visualSchemaRef.current.root.id, nextNode);
      commitVisualSchema(nextSchema, { pagePath: entryPagePath });

      result = {
        success: true,
        message: "Created component",
        affectedFiles: [entryPagePath],
        affectedPath: entryPagePath,
        shadowStatus: "validated",
      };
    } else {
      result = executeVoiceOperation(workspace.fileSystem, intent);
    }

    const newPageContent = findFileByPath(entryPagePath);
    const newContent = newPageContent ? newPageContent.content : "";

    let explanation = "";
    const fileChanges: FileChange[] = [];

    if (result.success) {
      const workspaceId = workspace.activeWorkspace?.id;
      if (!workspaceId) {
        const failedOp = updateOperationStatus(operation, "failed", "No active workspace ID to commit changes");
        setOperations(prev => [failedOp, ...prev]);
        setCurrentOperation(null);
        setIsProcessing(false);
        return;
      }

      const affectedPaths = result.affectedFiles?.length
        ? result.affectedFiles
        : (result.affectedPath ? [result.affectedPath] : []);

      try {
        const ops = affectedPaths.map((p) => {
          if (intent.type === "directory.create") {
            return { type: "createDirectory", path: p };
          }

          const file = findFileByPath(p);
          if (file) {
            return { type: "update", path: p, content: file.content };
          }
          return { type: "delete", path: p };
        });

        if (ops.length > 0) {
          const commitResponse = await fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "applyOperations",
              workspaceId,
              operations: ops,
            }),
          });

          const commitData = await commitResponse.json();
          if (!commitData?.success) {
            const errors = Array.isArray(commitData?.results)
              ? commitData.results.filter((r: { success: boolean }) => !r.success).map((r: { path: string; error?: string }) => `${r.path}: ${r.error || "failed"}`)
              : [];

            const failedOp = updateOperationStatus(
              operation,
              "failed",
              `Commit failed: ${commitData?.message || "Some operations failed"}${errors.length ? ` (${errors.join("; ")})` : ""}`
            );

            setOperations(prev => [failedOp, ...prev]);
            setCurrentOperation(null);
            setIsProcessing(false);
            return;
          }

          // Keep virtual FS in sync with committed disk state.
          for (const op of ops) {
            if (op.type === "createDirectory") {
              workspace.createDirectory(op.path);
            } else if (op.type === "delete") {
              workspace.deleteFile(op.path);
            } else if (op.type === "update" && typeof (op as { content?: string }).content === "string") {
              workspace.updateFile(op.path, (op as { content: string }).content);
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Commit failed";
        const failedOp = updateOperationStatus(operation, "failed", msg);
        setOperations(prev => [failedOp, ...prev]);
        setCurrentOperation(null);
        setIsProcessing(false);
        return;
      }

      const changes = compareContent(oldContent, newContent);
      
      if (result.affectedPath) {
        fileChanges.push({
          path: result.affectedPath,
          additions: changes.additions,
          deletions: changes.deletions,
          type: changes.deletions === 0 && !oldContent ? "created" : "modified",
        });
      }

      switch (intent.type) {
        case "component.create":
          explanation = `Created ${intent.component?.type || "component"} "${intent.component?.props?.text || ''}"`;
          break;
        case "component.update":
          explanation = `Updated component: ${intent.target || intent.value}`;
          break;
        case "component.delete":
          explanation = "Deleted component";
          break;
        case "component.duplicate":
          explanation = "Duplicated last component";
          break;
        case "page.create":
          explanation = `Created new page: ${intent.pageName}`;
          break;
        case "page.delete":
          explanation = `Deleted page: ${intent.pageName || intent.target}`;
          break;
        case "nav.add":
          explanation = "Added navigation component";
          break;
        case "ui.setTheme":
          explanation = `Changed theme to ${intent.value}`;
          break;
        case "file.create":
          explanation = `Created file: ${result.affectedPath}`;
          break;
        case "file.update":
          explanation = `Updated file: ${result.affectedPath}`;
          break;
        case "file.delete":
          explanation = `Deleted: ${result.affectedPath}`;
          break;
        case "directory.create":
          explanation = `Created directory: ${result.affectedPath}`;
          break;
        default:
          explanation = result.message;
      }

      const statusLabel = result.shadowStatus === "validated" ? "Validated successfully" :
                         result.shadowStatus === "committed" ? "Committed safely" :
                         result.shadowStatus === "failed" ? "Validation failed" :
                         "Proposed change ready";

      const completedOp = updateOperationStatus(operation, result.shadowStatus === "failed" ? "failed" : "completed", `${explanation}. ${statusLabel}.`);
      const opWithChanges = fileChanges.reduce((op, change) => addFileChange(op, change), completedOp);
      const opWithShadow: OperationWithShadow = {
        ...opWithChanges,
        shadowStatus: result.shadowStatus,
        validationErrors: result.validationErrors,
      };
      
      setOperations(prev => [opWithShadow, ...prev]);
      setCurrentOperation(null);
      setIsProcessing(false);

      if (result.affectedPath) {
        workspace.selectFile(result.affectedPath);
      }
    } else {
      const failedOp = updateOperationStatus(operation, "failed", result.message);
      const opWithShadow: OperationWithShadow = {
        ...failedOp,
        shadowStatus: result.shadowStatus || "failed",
        validationErrors: result.validationErrors,
      };
      setOperations(prev => [opWithShadow, ...prev]);
      setCurrentOperation(null);
      setIsProcessing(false);
    }
  }, [commitVisualSchema, compareContent, computeEntryPagePath, findFileByPath, layout.workbench, visualSchemaRef, workspace]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setStatusMessage("");
    } catch (error) {
      console.error("Error starting recording:", error);
      setStatusMessage("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const sendAudio = async (audioBlob: Blob) => {
    try {
      setStatusMessage("Processing...");

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/voice/detect", {
        method: "POST",
        body: formData,
      });

      const data: APIResponse = await response.json();

      if (data.success && data.transcript) {
        setStatusMessage("");

        if (data.detectedLocale && data.detectedLocale !== locale) {
          setLanguagePrompt({ locale: data.detectedLocale });
        }

        if (data.intent) {
          void executeIntent(data.intent, data.transcript, data.detectedLocale || locale);
        }
      } else {
        setStatusMessage(data.message || "Failed to process audio");
      }
    } catch (error) {
      console.error("Error sending audio:", error);
      setStatusMessage("Failed to process audio");
    }
  };

  const handleLocaleChange = useCallback((newLocale: string) => {
    setLocale(newLocale as SupportedLocale);
  }, [setLocale]);

  if (!workspace.activeWorkspace) {
    return (
      <WelcomeScreen
        onCreateWorkspace={workspace.createWorkspace}
        onLoadWorkspace={workspace.loadWorkspace}
        onLoadWorkspaceFromZip={workspace.loadWorkspaceFromZip}
        onLoadWorkspaceFromDirectory={workspace.loadWorkspaceFromDirectory}
        recentWorkspaces={workspace.recentWorkspaces}
        onSelectRecent={() => {}}
      />
    );
  }

  const workspaceId = workspace.activeWorkspace.id;

  const explorerNode = (
    <div className="h-full bg-[#0A0A0A] flex flex-col min-h-0">
      <div className="h-9 flex items-center gap-1 px-2 border-b border-white/10 bg-[#111] select-none">
        <button
          onClick={() => setLayout((p) => ({ ...p, leftTab: "files" }))}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${layout.leftTab === "files" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
        >
          Explorer
        </button>
        <button
          onClick={() => setLayout((p) => ({ ...p, leftTab: "layers" }))}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${layout.leftTab === "layers" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
        >
          Layers
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {layout.leftTab === "files" ? (
          <FileExplorer
            root={workspace.fileSystem.root}
            selectedFilePath={workspace.selectedFilePath}
            onFileSelect={workspace.selectFile}
          />
        ) : (
          <ComponentTreePanel
            schema={visualHistory.present}
            onSchemaChange={(next) => {
              commitVisualSchema(next);
            }}
          />
        )}
      </div>
    </div>
  );

  const codeNode = (
    <div className="h-full bg-[#0A0A0A]">
      <CodeEditorPanel
        root={workspace.fileSystem.root}
        selectedFilePath={workspace.selectedFilePath}
      />
    </div>
  );

  const isImportedWorkspace = workspace.activeWorkspace.type === "imported";

  const builderNode = isImportedWorkspace ? (
    <ImportedZoneBuilderPreview
      workspaceId={workspaceId}
      onBridgeReady={setZoneBridge}
      onBuilderMessage={onImportedBuilderMessage}
    />
  ) : (
    <BuilderCanvas
      history={visualHistory}
      setHistory={setHistoryForCanvas}
      workspaceId={workspaceId}
    />
  );

  const previewNode = (
    <LivePreview
      isDarkMode={isDarkMode}
      workspaceId={workspaceId}
    />
  );

  const centerNode = layout.workbench === "builder" ? builderNode : previewNode;
  const rightNode = layout.workbench === "builder" ? (
    isImportedWorkspace ? (
      <ZoneInspectorPanel
        schema={activeZoneSchema}
        selection={zoneSelection}
        onUpdateLayout={updateSelectedZoneLayout}
      />
    ) : (
      <InspectorPanel schema={visualHistory.present} onCommitSchema={(next) => commitVisualSchema(next)} />
    )
  ) : (
    codeNode
  );

  const agentNode = (
    <AgentPanel
      operations={operations}
      currentOperation={currentOperation}
      isProcessing={isProcessing}
      onFileClick={workspace.selectFile}
    />
  );

  const terminalNode = <TerminalPanel workspaceId={workspaceId} />;

  const bottomTabs: Array<{ key: "terminal" | "agent"; label: string; node: JSX.Element }> = [
    { key: "terminal", label: "Terminal", node: terminalNode },
    { key: "agent", label: "Agent", node: agentNode },
  ];
  const effectiveBottomTab = bottomTabs.find((t) => t.key === layout.bottomTab)?.key || "terminal";

  const bottomDockNode = effectiveBottomTab ? (
    <div className="h-full flex flex-col min-h-0 bg-[#0A0A0A]">
      <div className="h-9 flex items-center gap-1 px-2 border-t border-white/10 border-b border-white/10 bg-[#111] select-none">
        {bottomTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setLayout((p) => ({ ...p, bottomTab: t.key }))}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${effectiveBottomTab === t.key ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {bottomTabs.find((t) => t.key === effectiveBottomTab)!.node}
      </div>
    </div>
  ) : null;

  const centerWithRight = (
    <ResizableSplit
      orientation="vertical"
      size={layout.sizes.centerWidth}
      onSizeChange={(next) => setLayout((p) => ({ ...p, sizes: { ...p.sizes, centerWidth: next } }))}
      minFirst={520}
      minSecond={260}
      first={centerNode}
      second={rightNode}
    />
  );

  const topRegionNode = (
    <ResizableSplit
      orientation="vertical"
      size={layout.sizes.leftWidth}
      onSizeChange={(next) => setLayout((p) => ({ ...p, sizes: { ...p.sizes, leftWidth: next } }))}
      minFirst={200}
      minSecond={640}
      first={explorerNode}
      second={centerWithRight}
    />
  );

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0A]">
      <TopBar
        projectName={workspace.activeWorkspace.name}
        mode={mode}
        onModeChange={setMode}
        fileCount={allFiles.length}
      />

      <div className="h-10 flex items-center justify-between px-4 border-b border-white/10 bg-[#0A0A0A] select-none">
        <div className="flex items-center gap-1 bg-[#111] border border-white/10 rounded-md p-0.5">
          <button
            onClick={() => {
              const pagePath = computeEntryPagePath();
              if (workspace.activeWorkspace?.type !== "imported") {
                initializeVisualFromCode(pagePath);
              }
              setLayout((p) => ({ ...p, workbench: "builder" }));
            }}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${layout.workbench === "builder" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Builder
          </button>
          <button
            onClick={() => setLayout((p) => ({ ...p, workbench: "code" }))}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${layout.workbench === "code" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Code
          </button>
        </div>

        <div className="text-[11px] text-zinc-500 font-mono">
          {layout.workbench === "builder" ? "UI \u2194 Code" : "Code \u2194 UI"}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResizableSplit
          orientation="horizontal"
          size={layout.sizes.topHeight}
          onSizeChange={(next) => setLayout((p) => ({ ...p, sizes: { ...p.sizes, topHeight: next } }))}
          minFirst={360}
          minSecond={160}
          first={topRegionNode}
          second={bottomDockNode}
        />
      </div>

      <VoiceInputBar
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        currentLocale={locale}
        onLocaleChange={handleLocaleChange}
        statusMessage={statusMessage}
      />

      {languagePrompt ? (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-sm font-semibold text-white">Language detected</div>
              <div className="text-xs text-zinc-400 mt-1">
                We heard you speaking in{" "}
                <span className="font-mono text-zinc-200">
                  {languagePrompt.locale === "en" ? "English" : languagePrompt.locale === "hi" ? "Hindi" : "Kannada"}
                </span>
                . Continue developing in this language?
              </div>
            </div>
            <div className="px-4 py-4 flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 text-xs rounded-md border border-white/10 text-zinc-300 hover:bg-white/5"
                onClick={() => setLanguagePrompt(null)}
              >
                No
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-white text-black hover:bg-zinc-200"
                onClick={() => {
                  setLocale(languagePrompt.locale);
                  setLanguagePrompt(null);
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <WorkspaceProvider>
      <IDEContent />
    </WorkspaceProvider>
  );
}
