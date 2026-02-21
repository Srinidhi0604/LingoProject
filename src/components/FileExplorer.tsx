"use client";

import { DirectoryNode, FileNode, FileSystemNode, isFile, isDirectory } from "@/types/filesystem";
import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode2, FileJson, FileText, FileImage, File, Folder, FolderOpen, MoreHorizontal } from "lucide-react";

interface FileExplorerProps {
  root: DirectoryNode;
  selectedFilePath: string | null;
  onFileSelect: (path: string) => void;
}

function getFileIcon(name: string) {
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return <FileCode2 className="w-3.5 h-3.5 text-blue-400" />;
  if (name.endsWith(".ts") || name.endsWith(".js")) return <FileCode2 className="w-3.5 h-3.5 text-yellow-400" />;
  if (name.endsWith(".css")) return <FileCode2 className="w-3.5 h-3.5 text-sky-400" />;
  if (name.endsWith(".json")) return <FileJson className="w-3.5 h-3.5 text-green-400" />;
  if (name.endsWith(".md")) return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
  if (name.endsWith(".svg") || name.endsWith(".png")) return <FileImage className="w-3.5 h-3.5 text-purple-400" />;
  return <File className="w-3.5 h-3.5 text-zinc-400" />;
}

function TreeItem({
  node,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  node: FileSystemNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = isDirectory(node);
  const isSelected = node.path === selectedPath;

  if (isDir) {
    return (
      <div className="select-none">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full text-left px-2 py-1 hover:bg-white/5 transition-colors flex items-center gap-1.5 group ${
            isSelected ? "bg-white/10 text-white" : "text-zinc-400"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span className="text-indigo-400">
            {expanded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </span>
          <span className="text-[13px] truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children
              .sort((a, b) => {
                if (isDirectory(a) && isFile(b)) return -1;
                if (isFile(a) && isDirectory(b)) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((child) => (
                <TreeItem
                  key={child.id}
                  node={child}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full text-left px-2 py-1 hover:bg-white/5 transition-colors flex items-center gap-2 group select-none ${
        isSelected ? "bg-indigo-500/10 text-indigo-100" : "text-zinc-400"
      }`}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      {getFileIcon(node.name)}
      <span className={`text-[13px] truncate ${isSelected ? "font-medium" : ""}`}>{node.name}</span>
    </button>
  );
}

export default function FileExplorer({ root, selectedFilePath, onFileSelect }: FileExplorerProps) {
  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] border-r border-white/10">
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between select-none">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Explorer</span>
        <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto py-2 custom-scrollbar">
        {root.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            selectedPath={selectedFilePath}
            onSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}
