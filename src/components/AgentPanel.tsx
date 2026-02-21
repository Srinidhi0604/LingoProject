"use client";

import { AgentOperation, FileChange, calculateTotalChanges } from "@/types/agent";
import { ShadowFileStatus } from "@/types/shadow";
import { useState } from "react";
import { Terminal, CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, ChevronDown, FilePlus, FileMinus, FileEdit } from "lucide-react";

interface AgentPanelProps {
  operations: AgentOperation[];
  currentOperation: AgentOperation | null;
  isProcessing: boolean;
  onFileClick?: (path: string) => void;
}

function getShadowStatusBadge(status?: ShadowFileStatus) {
  if (!status) return null;

  const styles: Record<ShadowFileStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    pending: { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-500", label: "Pending", icon: <Clock className="w-3 h-3" /> },
    validated: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", label: "Validated", icon: <CheckCircle2 className="w-3 h-3" /> },
    committed: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "Committed", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "Failed", icon: <XCircle className="w-3 h-3" /> },
    discarded: { bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-400", label: "Discarded", icon: <AlertCircle className="w-3 h-3" /> },
  };

  const style = styles[status];

  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${style.bg} ${style.text}`}>
      {style.icon}
      {style.label}
    </span>
  );
}

function FileChangeItem({ change, onClick, shadowStatus, validationErrors }: { 
  change: FileChange; 
  onClick?: () => void;
  shadowStatus?: ShadowFileStatus;
  validationErrors?: string[];
}) {
  const getTypeIcon = () => {
    switch (change.type) {
      case "created": return <FilePlus className="w-3.5 h-3.5 text-emerald-400" />;
      case "deleted": return <FileMinus className="w-3.5 h-3.5 text-red-400" />;
      case "modified": return <FileEdit className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 rounded-md text-xs group transition-colors"
      >
        {getTypeIcon()}
        <span className="text-zinc-300 truncate flex-1 text-left font-mono text-[11px]">{change.path}</span>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {change.additions > 0 && <span className="text-emerald-400">+{change.additions}</span>}
          {change.deletions > 0 && <span className="text-red-400">-{change.deletions}</span>}
        </div>
        {getShadowStatusBadge(shadowStatus)}
      </button>
      {validationErrors && validationErrors.length > 0 && (
        <div className="px-3 py-2 ml-6 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md mt-1 font-mono">
          {validationErrors.map((err, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5">•</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface OperationWithShadow extends AgentOperation {
  shadowStatus?: ShadowFileStatus;
  validationErrors?: string[];
}

function OperationItem({ operation, onFileClick }: { operation: OperationWithShadow; onFileClick?: (path: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const totalChanges = calculateTotalChanges(operation.filesChanged);
  const time = new Date(operation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-start gap-2 hover:bg-white/5 transition-colors group"
      >
        <span className="text-zinc-500 group-hover:text-zinc-300 mt-0.5 transition-colors">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-zinc-200 truncate">{operation.instruction}</span>
            <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              operation.status === "completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              operation.status === "processing" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
              operation.status === "failed" ? "bg-red-500/10 border-red-500/20 text-red-400" :
              "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
            }`}>
              {operation.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
              {operation.status === "processing" && <Clock className="w-3 h-3 animate-pulse" />}
              {operation.status === "failed" && <XCircle className="w-3 h-3" />}
              {operation.status}
            </span>
            {operation.shadowStatus && getShadowStatusBadge(operation.shadowStatus)}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500 font-mono">
            <span>{time}</span>
            {operation.detectedLanguage && (
              <span className="text-indigo-400 bg-indigo-500/10 px-1.5 rounded">{operation.detectedLanguage}</span>
            )}
            {operation.filesChanged.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">+{totalChanges.additions}</span>
                {totalChanges.deletions > 0 && (
                  <span className="text-red-400">-{totalChanges.deletions}</span>
                )}
              </span>
            )}
          </div>
        </div>
      </button>
      
      {expanded && (
        <div className="pb-3 px-4">
          {operation.transcript && (
            <div className="px-3 py-2 mb-2 bg-white/5 border border-white/5 rounded-md text-[13px]">
              <span className="text-zinc-500 font-medium mr-2">Transcript:</span>
              <span className="text-zinc-300 italic">&quot;{operation.transcript}&quot;</span>
            </div>
          )}
          
          {operation.explanation && (
            <div className="px-3 py-2 mb-2 text-[13px] text-zinc-400 bg-indigo-500/5 border border-indigo-500/10 rounded-md">
              {operation.explanation}
            </div>
          )}
          
          {operation.filesChanged.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">Files Changed</div>
              <div className="bg-[#0A0A0A] border border-white/5 rounded-md overflow-hidden">
                {operation.filesChanged.map((file, idx) => (
                  <FileChangeItem 
                    key={`${file.path}-${idx}`} 
                    change={file} 
                    onClick={() => onFileClick?.(file.path)}
                    shadowStatus={operation.shadowStatus}
                    validationErrors={operation.validationErrors}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentPanel({ operations, currentOperation, isProcessing, onFileClick }: AgentPanelProps) {
  return (
    <div className="h-full flex flex-col bg-[#111] border-t border-white/10">
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between select-none bg-[#0A0A0A]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Agent Activity</span>
        </div>
        {isProcessing && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Processing...
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar">
        {currentOperation && (
          <div className="border-b border-indigo-500/20 bg-indigo-500/5">
            <div className="px-4 py-3 text-[13px] font-medium text-indigo-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              {currentOperation.instruction}
            </div>
            <div className="px-4 pb-3">
              <div className="bg-[#0A0A0A] border border-indigo-500/10 rounded-md overflow-hidden">
                {currentOperation.filesChanged.map((file, idx) => (
                  <FileChangeItem 
                    key={`current-${file.path}-${idx}`} 
                    change={file} 
                    onClick={() => onFileClick?.(file.path)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {operations.length === 0 && !currentOperation ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Terminal className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400 mb-1">No operations yet</p>
              <p className="text-xs text-zinc-600">Use voice commands to interact with the agent</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {operations.map((op) => (
              <OperationItem key={op.id} operation={op} onFileClick={onFileClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
