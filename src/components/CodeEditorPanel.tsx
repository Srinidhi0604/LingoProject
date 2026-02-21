"use client";

import { useMemo } from "react";
import { FileNode, FileSystemNode, isFile, isDirectory } from "@/types/filesystem";
import { FileCode2, FileJson, FileText, FileImage, File, X } from "lucide-react";

interface CodeEditorPanelProps {
  root: FileSystemNode;
  selectedFilePath: string | null;
}

function findFile(node: FileSystemNode, path: string): FileNode | null {
  if (isFile(node) && node.path === path) return node;
  if (isDirectory(node)) {
    for (const child of node.children) {
      const found = findFile(child, path);
      if (found) return found;
    }
  }
  return null;
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
      <div className="flex group">
        <span className="w-10 text-right pr-4 text-zinc-600 select-none text-[13px] group-hover:text-zinc-400 transition-colors">
          {index + 1}
        </span>
        <span className="flex-1">{tokens}</span>
      </div>
    );
  };

  return (
    <pre className="text-[13px] font-mono leading-relaxed">
      {code.split("\n").map((line, index) => (
        <div key={index} className="hover:bg-white/5 px-4 py-0.5 transition-colors">
          {highlightLine(line, index)}
        </div>
      ))}
    </pre>
  );
}

export default function CodeEditorPanel({ root, selectedFilePath }: CodeEditorPanelProps) {
  const selectedFile = useMemo(() => {
    if (!selectedFilePath) return null;
    return findFile(root, selectedFilePath);
  }, [root, selectedFilePath]);

  const getLanguage = (fileName: string): string => {
    if (fileName.endsWith(".tsx") || fileName.endsWith(".ts")) return "TypeScript React";
    if (fileName.endsWith(".jsx") || fileName.endsWith(".js")) return "JavaScript";
    if (fileName.endsWith(".css")) return "CSS";
    if (fileName.endsWith(".json")) return "JSON";
    if (fileName.endsWith(".md")) return "Markdown";
    return "Plain Text";
  };

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] border-r border-white/10">
      <div className="flex items-center bg-[#111] border-b border-white/10 min-w-0 overflow-x-auto custom-scrollbar">
        {selectedFile ? (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] border-r border-white/10 border-t-2 border-t-indigo-500 min-w-fit group cursor-pointer">
            {getFileIcon(selectedFile.name)}
            <span className="text-[13px] text-zinc-200 font-medium">{selectedFile.name}</span>
            <button className="ml-2 p-0.5 rounded-md text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-zinc-300 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-2.5 text-[13px] text-zinc-500 italic">No file open</div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto py-4 text-zinc-300 custom-scrollbar relative">
        {selectedFile ? (
          <SyntaxHighlight code={selectedFile.content} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <FileCode2 className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-sm font-medium">Select a file to view its content</p>
          </div>
        )}
      </div>
      
      {selectedFile && (
        <div className="h-6 bg-[#111] border-t border-white/10 flex items-center justify-end px-4 select-none">
          <span className="text-[11px] font-medium text-zinc-500">{getLanguage(selectedFile.name)}</span>
        </div>
      )}
    </div>
  );
}
