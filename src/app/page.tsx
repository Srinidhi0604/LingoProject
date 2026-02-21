"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useLingoContext } from "@lingo.dev/compiler/react";
import { VoiceIntent, Component } from "@/types/intent";
import { FileNode, isFile, isDirectory } from "@/types/filesystem";
import { AgentOperation, FileChange, createOperation, updateOperationStatus, addFileChange } from "@/types/agent";
import { ShadowFileStatus } from "@/types/shadow";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { executeVoiceOperation, VoiceOperationResult } from "@/lib/voiceOperations";
import { shadowWorkspace } from "@/lib/shadowWorkspace";
import TopBar from "@/components/TopBar";
import FileExplorer from "@/components/FileExplorer";
import CodeEditorPanel from "@/components/CodeEditorPanel";
import LivePreview from "@/components/LivePreview";
import AgentPanel from "@/components/AgentPanel";
import VoiceInputBar from "@/components/VoiceInputBar";
import WelcomeScreen from "@/components/WelcomeScreen";

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

function IDEContent() {
  const { locale, setLocale } = useLingoContext();
  const workspace = useWorkspace();
  const [operations, setOperations] = useState<OperationWithShadow[]>([]);
  const [currentOperation, setCurrentOperation] = useState<OperationWithShadow | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mode, setMode] = useState<"agent" | "ide">("agent");

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

  const executeIntent = useCallback(async (intent: VoiceIntent, transcript: string, detectedLanguage: string) => {
    if (!intent || intent.type === "none") {
      console.log("[Voice Engine] No valid intent to execute");
      return;
    }

    const operation = createOperation(transcript, transcript, detectedLanguage);
    setCurrentOperation({ ...operation, shadowStatus: "pending" });
    setIsProcessing(true);

    const oldPageContent = findFileByPath("app/page.tsx");
    const oldContent = oldPageContent ? oldPageContent.content : "";

    const result = executeVoiceOperation(workspace.fileSystem, intent);

    const newPageContent = findFileByPath("app/page.tsx");
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
  }, [workspace, findFileByPath, compareContent]);

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
          setLocale(data.detectedLocale);
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
        onLoadWorkspaceFromDirectory={workspace.loadWorkspaceFromDirectory}
        recentWorkspaces={workspace.recentWorkspaces}
        onSelectRecent={() => {}}
        currentLocale={locale}
        onLocaleChange={handleLocaleChange}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0A]">
      <TopBar
        projectName={workspace.activeWorkspace.name}
        mode={mode}
        onModeChange={setMode}
        fileCount={allFiles.length}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-52 shrink-0">
          <FileExplorer
            root={workspace.fileSystem.root}
            selectedFilePath={workspace.selectedFilePath}
            onFileSelect={workspace.selectFile}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 min-w-0">
              <CodeEditorPanel
                root={workspace.fileSystem.root}
                selectedFilePath={workspace.selectedFilePath}
              />
            </div>

            <div className="w-[45%] shrink-0">
              <LivePreview
                isDarkMode={isDarkMode}
                workspaceId={workspace.activeWorkspace.id}
              />
            </div>
          </div>

          <div className="h-[200px] shrink-0 border-t border-white/10">
            <AgentPanel
              operations={operations}
              currentOperation={currentOperation}
              isProcessing={isProcessing}
              onFileClick={workspace.selectFile}
            />
          </div>
        </div>
      </div>

      <VoiceInputBar
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        currentLocale={locale}
        onLocaleChange={handleLocaleChange}
        statusMessage={statusMessage}
      />
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
