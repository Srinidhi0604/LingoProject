export type FileType = 
  | "tsx" 
  | "ts" 
  | "jsx" 
  | "js" 
  | "css" 
  | "json" 
  | "md" 
  | "mjs"
  | "config"
  | "unknown";

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file";
  fileType: FileType;
  content: string;
  language: string;
  lastModified: number;
  metadata?: Record<string, unknown>;
}

export interface DirectoryNode {
  id: string;
  name: string;
  path: string;
  type: "directory";
  children: (FileNode | DirectoryNode)[];
  lastModified: number;
}

export type FileSystemNode = FileNode | DirectoryNode;

export interface ProjectFileSystem {
  root: DirectoryNode;
  version: number;
  projectName: string;
}

export interface FileOperation {
  type: "create" | "update" | "delete" | "move" | "rename";
  path: string;
  content?: string;
  newPath?: string;
  timestamp: number;
}

export interface ProjectManifest {
  name: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
  fileCount: number;
  directories: string[];
}

export function getFileType(fileName: string): FileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx": return "tsx";
    case "ts": return "ts";
    case "jsx": return "jsx";
    case "js": return "js";
    case "css": return "css";
    case "json": return "json";
    case "md": return "md";
    case "mjs": return "mjs";
    default: return "unknown";
  }
}

export function getLanguage(fileType: FileType): string {
  switch (fileType) {
    case "tsx": return "typescript";
    case "ts": return "typescript";
    case "jsx": return "javascript";
    case "js": return "javascript";
    case "css": return "css";
    case "json": return "json";
    case "md": return "markdown";
    case "mjs": return "javascript";
    default: return "text";
  }
}

export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateDirId(): string {
  return `dir_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createFile(path: string, content: string = ""): FileNode {
  const name = path.split("/").pop() || "unnamed";
  const fileType = getFileType(name);
  return {
    id: generateFileId(),
    name,
    path,
    type: "file",
    fileType,
    content,
    language: getLanguage(fileType),
    lastModified: Date.now(),
  };
}

export function createDirectory(path: string): DirectoryNode {
  const name = path.split("/").filter(Boolean).pop() || "root";
  return {
    id: generateDirId(),
    name,
    path,
    type: "directory",
    children: [],
    lastModified: Date.now(),
  };
}

export function isFile(node: FileSystemNode): node is FileNode {
  return node.type === "file";
}

export function isDirectory(node: FileSystemNode): node is DirectoryNode {
  return node.type === "directory";
}
