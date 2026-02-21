"use client";

import { useMemo, useCallback } from "react";
import {
  DirectoryNode,
  FileNode,
  FileSystemNode,
  isFile,
  isDirectory,
} from "@/types/filesystem";

interface CodeEditorProps {
  root: DirectoryNode;
  selectedFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileContentChange: (path: string, content: string) => void;
}

function SyntaxHighlight({ code }: { code: string }) {
  const highlightLine = (line: string, index: number) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let tokenKey = 0;

    const patterns = [
      { regex: /^(import|export|from|const|let|var|function|return|async|await|default|type|interface|extends|implements|new|class|if|else|for|while|switch|case|break|continue|try|catch|finally|throw)/, className: "text-purple-400" },
      { regex: /^(".*?"|'.*?'|`.*?`)/, className: "text-amber-300" },
      { regex: /^(\/\/.*|\/\*.*?\*\/)/, className: "text-zinc-500" },
      { regex: /^(\d+\.?\d*)/, className: "text-orange-400" },
      { regex: /^(true|false|null|undefined)/, className: "text-orange-400" },
      { regex: /^(@\w+|use\s+\w+)/, className: "text-pink-400" },
      { regex: /^(className|href|src|alt|type|name|id|placeholder|lang|rel|content|charset|viewport|title|description)/, className: "text-cyan-400" },
      { regex: /^(<\/?[\w-]*|\/?>)/, className: "text-emerald-400" },
      { regex: /^([\w-]+)(?=\=)/, className: "text-yellow-300" },
    ];

    while (remaining.length > 0) {
      let matched = false;

      for (const { regex, className } of patterns) {
        const match = remaining.match(regex);
        if (match) {
          tokens.push(
            <span key={tokenKey++} className={className}>
              {match[0]}
            </span>
          );
          remaining = remaining.slice(match[0].length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        tokens.push(<span key={tokenKey++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      }
    }

    return (
      <div className="flex">
        <span className="w-10 text-right pr-3 text-zinc-600 select-none text-xs">{index + 1}</span>
        <span className="flex-1">{tokens}</span>
      </div>
    );
  };

  return (
    <pre className="text-xs font-mono leading-relaxed">
      {code.split("\n").map((line, index) => (
        <div key={index} className="hover:bg-white/5 px-2">
          {highlightLine(line, index)}
        </div>
      ))}
    </pre>
  );
}

function FileTreeItem({
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
  const isDir = isDirectory(node);
  const isSelected = node.path === selectedPath;

  if (isDir) {
    return (
      <div>
        <button
          className={`w-full text-left px-2 py-0.5 text-xs hover:bg-zinc-700/50 rounded transition-colors flex items-center gap-1.5 ${
            isSelected ? "bg-zinc-700" : ""
          }`}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          <span className="text-amber-400 text-[10px]">&#128193;</span>
          <span className="text-zinc-300">{node.name}</span>
        </button>
        <div>
          {node.children
            .sort((a, b) => {
              if (isDirectory(a) && isFile(b)) return -1;
              if (isFile(a) && isDirectory(b)) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeItem
                key={child.id}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
        </div>
      </div>
    );
  }

  const getFileIcon = (name: string) => {
    if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "&#9889;";
    if (name.endsWith(".ts") || name.endsWith(".js")) return "&#128309;";
    if (name.endsWith(".css")) return "&#127912;";
    if (name.endsWith(".json")) return "&#128203;";
    return "&#128196;";
  };

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full text-left px-2 py-0.5 text-xs hover:bg-zinc-700/50 rounded transition-colors flex items-center gap-1.5 ${
        isSelected ? "bg-zinc-700" : ""
      }`}
      style={{ paddingLeft: `${depth * 12 + 6}px` }}
    >
      <span 
        className="text-[10px]" 
        dangerouslySetInnerHTML={{ __html: getFileIcon(node.name) }}
      />
      <span className="text-zinc-400">{node.name}</span>
    </button>
  );
}

export default function CodeEditor({
  root,
  selectedFilePath,
  onFileSelect,
  onFileContentChange,
}: CodeEditorProps) {
  const selectedFile = useMemo(() => {
    if (!selectedFilePath) return null;
    
    const findFile = (node: FileSystemNode, path: string): FileNode | null => {
      if (isFile(node) && node.path === path) return node;
      if (isDirectory(node)) {
        for (const child of node.children) {
          const found = findFile(child, path);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findFile(root, selectedFilePath);
  }, [root, selectedFilePath]);

  const fileCount = useMemo(() => {
    let count = 0;
    const countFiles = (node: FileSystemNode) => {
      if (isFile(node)) count++;
      else if (isDirectory(node)) node.children.forEach(countFiles);
    };
    countFiles(root);
    return count;
  }, [root]);

  const getLanguage = (fileName: string): string => {
    if (fileName.endsWith(".tsx") || fileName.endsWith(".ts")) return "TypeScript";
    if (fileName.endsWith(".jsx") || fileName.endsWith(".js")) return "JavaScript";
    if (fileName.endsWith(".css")) return "CSS";
    if (fileName.endsWith(".json")) return "JSON";
    if (fileName.endsWith(".md")) return "Markdown";
    return "Text";
  };

  return (
    <div className="flex h-full bg-[#0A0A0A] overflow-hidden">
      <div className="w-48 bg-[#111] border-r border-white/10 flex flex-col">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Files</span>
          <span className="text-[10px] text-zinc-500">{fileCount}</span>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {root.children
            .sort((a, b) => {
              if (isDirectory(a) && isFile(b)) return -1;
              if (isFile(a) && isDirectory(b)) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeItem
                key={child.id}
                node={child}
                selectedPath={selectedFilePath}
                onSelect={onFileSelect}
              />
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between bg-[#111] px-3 py-1.5 border-b border-white/10 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-blue-400 text-xs">&#128196;</span>
            <span className="text-xs text-zinc-300 truncate">
              {selectedFile?.name || "No file selected"}
            </span>
          </div>
          {selectedFile && (
            <span className="text-[10px] text-zinc-500 shrink-0">
              {getLanguage(selectedFile.name)}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto p-3 text-zinc-300">
          {selectedFile ? (
            <SyntaxHighlight code={selectedFile.content} />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              Select a file to view its content
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
