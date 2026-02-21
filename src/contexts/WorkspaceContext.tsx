"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ProjectFileSystem, DirectoryNode, FileNode, createFile, createDirectory, isFile, isDirectory } from "@/types/filesystem";
import { Workspace, WorkspaceState, generateWorkspaceId } from "@/types/workspace";

interface WorkspaceContextType extends WorkspaceState {
  fileSystem: ProjectFileSystem;
  createWorkspace: (name: string, template?: string) => Promise<void>;
  loadWorkspace: (files: { path: string; content: string }[], name?: string) => Promise<void>;
  loadWorkspaceFromDirectory: (sourcePath: string, name?: string) => Promise<void>;
  updateFile: (path: string, content: string) => void;
  createFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  createDirectory: (path: string) => void;
  getSelectedFile: () => FileNode | null;
  selectedFilePath: string | null;
  selectFile: (path: string | null) => void;
  clearWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

function createBlankProject(name: string): ProjectFileSystem {
  const appDir = createDirectory("app");
  const componentsDir = createDirectory("app/components");
  
  const pageFile = createFile("app/page.tsx", `export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">Welcome to ${name}</h1>
      <p className="mt-4 text-gray-600">Start speaking to build your application</p>
    </main>
  );
}
`);

  const layoutFile = createFile("app/layout.tsx", `import type { Metadata } from "next";
import { LingoProvider } from "@lingo.dev/compiler/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "${name}",
  description: "Built with Voxera IDE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LingoProvider>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </LingoProvider>
  );
}
`);

  const globalsFile = createFile("app/globals.css", `@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, sans-serif;
}
`);

  const nextConfig = createFile("next.config.ts", `import type { NextConfig } from "next";
import { withLingo } from "@lingo.dev/compiler/next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default async function (): Promise<NextConfig> {
  return await withLingo(nextConfig, {
    sourceRoot: "./app",
    sourceLocale: "en",
    targetLocales: ["kn", "hi"],
    models: "lingo.dev",
    widget: false,
  });
}
`);

  const lingoConfig = createFile("lingo.config.ts", `import { defineConfig } from "@lingo.dev/compiler";

export default defineConfig({
  defaultLocale: "en",
  locales: ["en", "kn", "hi"],
});
`);

  const i18nJson = createFile("i18n.json", JSON.stringify({
    version: 1,
    defaultLocale: "en",
    locales: ["en", "kn", "hi"],
    bucket: { adapter: "vercel-blob" },
    source: {
      adapter: "next-js",
      include: ["app/**/*.{tsx,ts,jsx,js}"],
      exclude: ["app/api/**", "node_modules/**"],
    },
    storage: { adapter: "vercel-blob" },
    rules: [{ patterns: ["**/*.tsx"], extract: "jsx-text" }],
  }, null, 2) + "\n");

  const packageJson = createFile("package.json", JSON.stringify({
    name: name.toLowerCase().replace(/\s+/g, "-"),
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
      "lingo:run": "lingo.dev run",
      "lingo:frozen": "lingo.dev run --frozen",
      localize: "npm run lingo:run && npm run build",
    },
    dependencies: {
      next: "16.1.6",
      react: "19.2.3",
      "react-dom": "19.2.3",
      "@lingo.dev/compiler": "^0.3.8",
    },
    devDependencies: {
      "@tailwindcss/postcss": "^4",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      typescript: "^5",
      tailwindcss: "^4",
      eslint: "^9",
      "eslint-config-next": "16.1.6",
      "lingo.dev": "^0.131.0",
    },
  }, null, 2) + "\n");

  const postcssConfig = createFile("postcss.config.mjs", `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`);

  const tsconfig = createFile("tsconfig.json", JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  }, null, 2) + "\n");

  const nextEnv = createFile("next-env.d.ts", `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/pages/api-reference/config/typescript for more information.
`);

  appDir.children = [pageFile, layoutFile, globalsFile, componentsDir];

  const root = createDirectory("");
  root.name = "workspace";
  root.path = "";
  root.children = [
    appDir,
    nextConfig,
    lingoConfig,
    i18nJson,
    packageJson,
    postcssConfig,
    tsconfig,
    nextEnv,
  ];

  return {
    root,
    version: 1,
    projectName: name,
  };
}

function cloneFileSystemNode(node: FileNode | DirectoryNode): FileNode | DirectoryNode {
  if (isFile(node)) {
    return { ...node };
  }
  return {
    ...node,
    children: node.children.map(cloneFileSystemNode) as (FileNode | DirectoryNode)[],
  };
}

function findNodeByPath(node: FileNode | DirectoryNode, path: string): FileNode | DirectoryNode | null {
  if (node.path === path) return node;
  if (isDirectory(node)) {
    for (const child of node.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }
  return null;
}

function findParentDirectory(node: DirectoryNode, path: string): DirectoryNode | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  segments.pop();
  const parentPath = segments.join("/");
  if (parentPath === "") return node;
  const parent = findNodeByPath(node, parentPath);
  return parent && isDirectory(parent) ? parent : null;
}

function insertFileIntoFs(root: DirectoryNode, filePath: string, content: string): boolean {
  const segments = filePath.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const fileName = segments.pop();
  const dirPath = segments.join("/");

  let current = root;
  
  for (const segment of segments) {
    const currentPath = current.path ? `${current.path}/${segment}` : segment;
    let child = current.children.find(c => c.name === segment && isDirectory(c));
    
    if (!child) {
      const newDir = createDirectory(currentPath);
      current.children.push(newDir);
      child = newDir;
    }
    
    if (isDirectory(child)) {
      current = child;
    } else {
      return false;
    }
  }

  const existingIndex = current.children.findIndex(c => c.path === filePath);
  const newFile = createFile(filePath, content);

  if (existingIndex >= 0) {
    current.children[existingIndex] = newFile;
  } else {
    current.children.push(newFile);
  }

  current.lastModified = Date.now();
  return true;
}

function deleteNodeFromFs(root: DirectoryNode, path: string): boolean {
  if (path === "") return false;
  const parent = findParentDirectory(root, path);
  if (!parent) return false;
  const index = parent.children.findIndex(c => c.path === path);
  if (index < 0) return false;
  parent.children.splice(index, 1);
  parent.lastModified = Date.now();
  return true;
}

function updateFileInFs(root: DirectoryNode, filePath: string, content: string): boolean {
  const node = findNodeByPath(root, filePath);
  if (!node || !isFile(node)) return false;
  node.content = content;
  node.lastModified = Date.now();
  return true;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    activeWorkspace: null,
    recentWorkspaces: [],
    isLoading: false,
    error: null,
  });

  const [fileSystem, setFileSystem] = useState<ProjectFileSystem>(() => createBlankProject("My Project"));
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>("app/page.tsx");

  const syncToRealFilesystem = useCallback(async (workspaceId: string, virtualRoot: DirectoryNode) => {
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "syncVirtual",
        workspaceId,
        virtualRoot,
      }),
    });

    const data = await response.json();
    if (!data?.success) {
      throw new Error(data?.message || "Failed to sync workspace to disk");
    }

    return data?.paths?.root as string | undefined;
  }, []);

  const createWorkspace = useCallback(async (name: string, template?: string) => {
    const workspace: Workspace = {
      id: generateWorkspaceId(),
      name,
      path: "",
      type: "template",
      createdAt: Date.now(),
      lastModified: Date.now(),
    };

    setWorkspaceState(prev => ({ ...prev, isLoading: true, error: null }));
    const fs = createBlankProject(name);

    try {
      const realPath = await syncToRealFilesystem(workspace.id, fs.root as DirectoryNode);
      workspace.path = realPath || "";

      setFileSystem(fs);
      setWorkspaceState(prev => ({
        ...prev,
        isLoading: false,
        activeWorkspace: workspace,
        recentWorkspaces: [workspace, ...prev.recentWorkspaces.filter(w => w.id !== workspace.id)].slice(0, 10),
      }));
      setSelectedFilePath("app/page.tsx");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create workspace";
      setWorkspaceState(prev => ({ ...prev, isLoading: false, error: msg }));
    }
  }, [syncToRealFilesystem]);

  const loadWorkspace = useCallback(async (files: { path: string; content: string }[], name?: string) => {
    const workspace: Workspace = {
      id: generateWorkspaceId(),
      name: name || "Imported Project",
      path: "",
      type: "imported",
      createdAt: Date.now(),
      lastModified: Date.now(),
    };

    setWorkspaceState(prev => ({ ...prev, isLoading: true, error: null }));

    const root = createDirectory("");
    root.name = "workspace";
    root.path = "";

    files.forEach(file => {
      insertFileIntoFs(root, file.path, file.content);
    });

    const nextFs: ProjectFileSystem = {
      root,
      version: 1,
      projectName: workspace.name,
    };

    try {
      const realPath = await syncToRealFilesystem(workspace.id, nextFs.root as DirectoryNode);
      workspace.path = realPath || "";

      setFileSystem(nextFs);
      setWorkspaceState(prev => ({
        ...prev,
        isLoading: false,
        activeWorkspace: workspace,
        recentWorkspaces: [workspace, ...prev.recentWorkspaces.filter(w => w.id !== workspace.id)].slice(0, 10),
      }));

      const firstPage = files.find(f => f.path.includes("page.tsx"));
      setSelectedFilePath(firstPage?.path || files[0]?.path || null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load workspace";
      setWorkspaceState(prev => ({ ...prev, isLoading: false, error: msg }));
    }
  }, [syncToRealFilesystem]);

  const loadWorkspaceFromDirectory = useCallback(async (sourcePath: string, name?: string) => {
    const workspace: Workspace = {
      id: generateWorkspaceId(),
      name: name || sourcePath.split("\\").pop() || sourcePath.split("/").pop() || "Local Project",
      path: "",
      type: "local",
      createdAt: Date.now(),
      lastModified: Date.now(),
    };

    setWorkspaceState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "loadFromDirectory",
          workspaceId: workspace.id,
          sourcePath,
        }),
      });
      const data = await response.json();
      if (!data?.success || !data?.root) {
        throw new Error(data?.message || "Failed to load directory");
      }

      const realPath = await fetch(`/api/workspace?workspaceId=${workspace.id}`).then(r => r.json());
      workspace.path = realPath?.path || "";

      setFileSystem({
        root: data.root as DirectoryNode,
        version: 1,
        projectName: workspace.name,
      });

      setWorkspaceState(prev => ({
        ...prev,
        isLoading: false,
        activeWorkspace: workspace,
        recentWorkspaces: [workspace, ...prev.recentWorkspaces.filter(w => w.id !== workspace.id)].slice(0, 10),
      }));

      setSelectedFilePath("app/page.tsx");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load directory";
      setWorkspaceState(prev => ({ ...prev, isLoading: false, error: msg }));
    }
  }, []);

  const updateFile = useCallback((path: string, content: string) => {
    setFileSystem(prev => {
      const newRoot = cloneFileSystemNode(prev.root) as DirectoryNode;
      updateFileInFs(newRoot, path, content);
      return { ...prev, root: newRoot, version: prev.version + 1 };
    });
  }, []);

  const createFileInWorkspace = useCallback((path: string, content: string) => {
    setFileSystem(prev => {
      const newRoot = cloneFileSystemNode(prev.root) as DirectoryNode;
      insertFileIntoFs(newRoot, path, content);
      return { ...prev, root: newRoot, version: prev.version + 1 };
    });
  }, []);

  const deleteFile = useCallback((path: string) => {
    setFileSystem(prev => {
      const newRoot = cloneFileSystemNode(prev.root) as DirectoryNode;
      deleteNodeFromFs(newRoot, path);
      return { ...prev, root: newRoot, version: prev.version + 1 };
    });
    setSelectedFilePath(prev => prev === path ? null : prev);
  }, []);

  const createDirectoryInWorkspace = useCallback((path: string) => {
    setFileSystem(prev => {
      const newRoot = cloneFileSystemNode(prev.root) as DirectoryNode;
      const segments = path.split("/").filter(Boolean);
      
      let current = newRoot;
      for (const segment of segments) {
        const currentPath = current.path ? `${current.path}/${segment}` : segment;
        let child = current.children.find(c => c.name === segment && isDirectory(c));
        
        if (!child) {
          const newDir = createDirectory(currentPath);
          current.children.push(newDir);
          child = newDir;
        }
        
        if (isDirectory(child)) {
          current = child;
        }
      }
      
      return { ...prev, root: newRoot, version: prev.version + 1 };
    });
  }, []);

  const getSelectedFile = useCallback((): FileNode | null => {
    if (!selectedFilePath) return null;
    const node = findNodeByPath(fileSystem.root, selectedFilePath);
    return node && isFile(node) ? node : null;
  }, [fileSystem, selectedFilePath]);

  const clearWorkspace = useCallback(() => {
    setFileSystem(createBlankProject("New Project"));
    setWorkspaceState({
      activeWorkspace: null,
      recentWorkspaces: [],
      isLoading: false,
      error: null,
    });
    setSelectedFilePath("app/page.tsx");
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        ...workspaceState,
        fileSystem,
        createWorkspace,
        loadWorkspace,
        updateFile,
        createFile: createFileInWorkspace,
            loadWorkspaceFromDirectory,
        deleteFile,
        createDirectory: createDirectoryInWorkspace,
        getSelectedFile,
        selectedFilePath,
        selectFile: setSelectedFilePath,
        clearWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
