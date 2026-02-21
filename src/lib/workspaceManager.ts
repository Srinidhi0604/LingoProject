import { DirectoryNode, FileNode, isFile, isDirectory, createDirectory, createFile } from "@/types/filesystem";
import { realFilesystem } from "./realFilesystem";
import { devServerManager, DevServerStatus } from "./devServerController";
import { WorkspaceOrchestrator, createOrchestrator } from "./workspaceOrchestrator";
import { validateFile } from "./shadowWorkspace";

export interface WorkspaceSession {
  id: string;
  name: string;
  realPath: string;
  status: "initialized" | "running" | "stopped" | "error";
  devServerStatus: DevServerStatus | null;
  orchestrator: WorkspaceOrchestrator | null;
  virtualRoot: DirectoryNode | null;
}

class WorkspaceManager {
  private sessions: Map<string, WorkspaceSession> = new Map();
  private baseWorkspacesPath: string;

  constructor(basePath: string = process.cwd() + "/workspaces") {
    this.baseWorkspacesPath = basePath;
  }

  async createWorkspace(name: string, template?: "blank" | "landing" | "dashboard"): Promise<WorkspaceSession> {
    const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const virtualRoot = this.createTemplateProject(name, template);
    
    const paths = await realFilesystem.syncVirtualToReal(virtualRoot, id);
    
    const orchestrator = createOrchestrator(virtualRoot);
    
    const session: WorkspaceSession = {
      id,
      name,
      realPath: paths.root,
      status: "initialized",
      devServerStatus: null,
      orchestrator,
      virtualRoot,
    };
    
    this.sessions.set(id, session);
    return session;
  }

  async loadWorkspaceFromPath(sourcePath: string, name?: string): Promise<WorkspaceSession> {
    const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const workspaceName = name || sourcePath.split("/").pop() || "Imported Project";
    
    const virtualRoot = await realFilesystem.loadWorkspaceFromDirectory(id, sourcePath);
    
    const orchestrator = createOrchestrator(virtualRoot);
    
    const realPath = await realFilesystem.getWorkspacePath(id);
    
    const session: WorkspaceSession = {
      id,
      name: workspaceName,
      realPath,
      status: "initialized",
      devServerStatus: null,
      orchestrator,
      virtualRoot,
    };
    
    this.sessions.set(id, session);
    return session;
  }

  async loadWorkspaceFromVirtual(root: DirectoryNode, name: string): Promise<WorkspaceSession> {
    const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const paths = await realFilesystem.syncVirtualToReal(root, id);
    
    const orchestrator = createOrchestrator(root);
    
    const session: WorkspaceSession = {
      id,
      name,
      realPath: paths.root,
      status: "initialized",
      devServerStatus: null,
      orchestrator,
      virtualRoot: root,
    };
    
    this.sessions.set(id, session);
    return session;
  }

  async startDevServer(workspaceId: string): Promise<DevServerStatus> {
    const session = this.sessions.get(workspaceId);
    if (!session) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const status = await devServerManager.startServer(workspaceId, {
      workspacePath: session.realPath,
    });

    session.devServerStatus = status;
    session.status = status.running ? "running" : "error";

    return status;
  }

  async stopDevServer(workspaceId: string): Promise<void> {
    const session = this.sessions.get(workspaceId);
    if (!session) return;

    await devServerManager.stopServer(workspaceId);
    session.devServerStatus = null;
    session.status = "stopped";
  }

  async syncVirtualToReal(workspaceId: string): Promise<void> {
    const session = this.sessions.get(workspaceId);
    if (!session || !session.virtualRoot) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    await realFilesystem.syncVirtualToReal(session.virtualRoot, workspaceId);
  }

  getWorkspace(workspaceId: string): WorkspaceSession | undefined {
    return this.sessions.get(workspaceId);
  }

  getVirtualRoot(workspaceId: string): DirectoryNode | null {
    return this.sessions.get(workspaceId)?.virtualRoot || null;
  }

  async executeFileOperation(
    workspaceId: string,
    operation: {
      type: "create" | "update" | "delete";
      path: string;
      content?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(workspaceId);
    if (!session) {
      return { success: false, error: "Workspace not found" };
    }

    const { type, path: relativePath, content } = operation;

    switch (type) {
      case "create":
      case "update": {
        if (content === undefined) {
          return { success: false, error: "Content required for create/update" };
        }

        const validation = validateFile(relativePath, content);
        if (!validation.valid) {
          return { success: false, error: validation.errors.join(", ") };
        }

        await realFilesystem.writeShadowFile(workspaceId, relativePath, content);
        
        const committed = await realFilesystem.commitShadowFile(workspaceId, relativePath);
        
        if (committed && session.virtualRoot) {
          this.updateVirtualFile(session.virtualRoot, relativePath, content);
        }

        return { success: committed };
      }

      case "delete": {
        const deleted = await realFilesystem.deleteFile(workspaceId, relativePath);
        
        if (deleted && session.virtualRoot) {
          this.deleteVirtualFile(session.virtualRoot, relativePath);
        }

        return { success: deleted };
      }

      default:
        return { success: false, error: "Unknown operation type" };
    }
  }

  async createRoute(workspaceId: string, routePath: string): Promise<string> {
    const session = this.sessions.get(workspaceId);
    if (!session || !session.orchestrator) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const pagePath = session.orchestrator.ensureRoute(routePath);
    
    const pageContent = session.orchestrator.getFileContent(pagePath);
    if (pageContent) {
      const validation = validateFile(pagePath, pageContent);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      await realFilesystem.writeShadowFile(workspaceId, pagePath, pageContent);
      const committed = await realFilesystem.commitShadowFile(workspaceId, pagePath);
      if (!committed) {
        throw new Error(`Failed to commit route file: ${pagePath}`);
      }
      
      if (session.virtualRoot) {
        this.updateVirtualFile(session.virtualRoot, pagePath, pageContent);
      }
    }

    return pagePath;
  }

  async createAndRegisterComponent(
    workspaceId: string,
    template: {
      name: string;
      type: string;
      props: Record<string, unknown>;
    },
    targetPage?: string
  ): Promise<{ componentPath: string; pagePath: string }> {
    const session = this.sessions.get(workspaceId);
    if (!session || !session.orchestrator) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const componentPath = session.orchestrator.createComponent({
      name: template.name,
      type: template.type,
      props: template.props,
    });

    const pagePath = targetPage || "app/page.tsx";
    session.orchestrator.registerComponent(componentPath, pagePath);

    const componentContent = session.orchestrator.getFileContent(componentPath);
    const pageContent = session.orchestrator.getFileContent(pagePath);

    if (componentContent) {
      const validation = validateFile(componentPath, componentContent);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }
      await realFilesystem.writeShadowFile(workspaceId, componentPath, componentContent);
      const committed = await realFilesystem.commitShadowFile(workspaceId, componentPath);
      if (!committed) {
        throw new Error(`Failed to commit component file: ${componentPath}`);
      }
    }

    if (pageContent) {
      const validation = validateFile(pagePath, pageContent);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }
      await realFilesystem.writeShadowFile(workspaceId, pagePath, pageContent);
      const committed = await realFilesystem.commitShadowFile(workspaceId, pagePath);
      if (!committed) {
        throw new Error(`Failed to commit page file: ${pagePath}`);
      }
    }

    if (session.virtualRoot) {
      if (componentContent) {
        this.updateVirtualFile(session.virtualRoot, componentPath, componentContent);
      }
      if (pageContent) {
        this.updateVirtualFile(session.virtualRoot, pagePath, pageContent);
      }
    }

    return { componentPath, pagePath };
  }

  private updateVirtualFile(root: DirectoryNode, path: string, content: string): void {
    const segments = path.split("/").filter(Boolean);
    
    let current: DirectoryNode | FileNode = root;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (isDirectory(current)) {
        const child = current.children.find((c: DirectoryNode | FileNode) => c.name === segment);
        if (child && isDirectory(child)) {
          current = child;
        } else {
          return;
        }
      } else {
        return;
      }
    }

    if (isDirectory(current)) {
      const fileName = segments[segments.length - 1];
      const existingIndex = current.children.findIndex(c => c.name === fileName);
      
      const newFile = createFile(path, content);
      
      if (existingIndex >= 0) {
        current.children[existingIndex] = newFile;
      } else {
        current.children.push(newFile);
      }
    }
  }

  private deleteVirtualFile(root: DirectoryNode, path: string): void {
    const segments = path.split("/").filter(Boolean);
    
    let current: DirectoryNode = root;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const child = current.children.find((c: DirectoryNode | FileNode) => c.name === segment && isDirectory(c));
      if (child && isDirectory(child)) {
        current = child;
      } else {
        return;
      }
    }

    const fileName = segments[segments.length - 1];
    const index = current.children.findIndex((c: DirectoryNode | FileNode) => c.name === fileName);
    
    if (index >= 0) {
      current.children.splice(index, 1);
    }
  }

  private createTemplateProject(name: string, template?: string): DirectoryNode {
    const root = createDirectory("");
    root.name = "workspace";
    root.path = "";

    const appDir = createDirectory("app");
    const configDir = createDirectory("config");
    const componentsDir = createDirectory("app/components");

    const pageContent = this.getPageTemplate(name, template);
    const pageFile = createFile("app/page.tsx", pageContent);

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

    const packageFile = createFile("package.json", JSON.stringify({
      name: name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "15.1.6",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "@lingo.dev/compiler": "^0.3.8",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        typescript: "^5",
        tailwindcss: "^4",
        postcss: "^8",
        eslint: "^9",
        "eslint-config-next": "15.1.6",
      },
    }, null, 2));

    const nextConfigFile = createFile("next.config.ts", `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`);

    const tsConfigFile = createFile("tsconfig.json", JSON.stringify({
      compilerOptions: {
        target: "ES2017",
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
        paths: {
          "@/*": ["./*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    }, null, 2));

    appDir.children = [pageFile, layoutFile, globalsFile, componentsDir];
    configDir.children = [packageFile, nextConfigFile, tsConfigFile];

    root.children = [appDir, configDir];

    return root;
  }

  private getPageTemplate(name: string, template?: string): string {
    switch (template) {
      case "landing":
        return `export default function Page() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-zinc-900 text-white p-8">
        <h1 className="text-4xl font-bold">${name}</h1>
        <p className="mt-2 text-zinc-400">Welcome to your landing page</p>
      </header>
      <section className="flex-1 p-8">
        <p>Start speaking to build your application</p>
      </section>
    </main>
  );
}
`;
      case "dashboard":
        return `export default function Page() {
  return (
    <main className="flex min-h-screen">
      <aside className="w-64 bg-zinc-900 text-white p-4">
        <h1 className="text-xl font-bold">${name}</h1>
        <nav className="mt-8">
          <p>Navigation</p>
        </nav>
      </aside>
      <section className="flex-1 p-8">
        <p>Dashboard content</p>
      </section>
    </main>
  );
}
`;
      default:
        return `export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">${name}</h1>
      <p className="mt-4 text-gray-600">Start speaking to build your application</p>
    </main>
  );
}
`;
    }
  }

  async closeWorkspace(workspaceId: string): Promise<void> {
    await this.stopDevServer(workspaceId);
    this.sessions.delete(workspaceId);
  }

  async closeAll(): Promise<void> {
    await devServerManager.stopAll();
    this.sessions.clear();
  }
}

export const workspaceManager = new WorkspaceManager();
