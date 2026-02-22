import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { DirectoryNode, FileNode, isFile, isDirectory, generateFileId, generateDirId, getFileType, getLanguage } from "@/types/filesystem";

export interface RealFilesystemConfig {
  baseWorkspacePath: string;
}

export interface WorkspacePaths {
  root: string;
  app: string;
  components: string;
  config: string;
  voxera: string;
  shadow: string;
}

class RealFilesystemManager {
  private baseWorkspacePath: string;

  constructor(config: RealFilesystemConfig) {
    this.baseWorkspacePath = config.baseWorkspacePath;
  }

  async initializeWorkspace(workspaceId: string): Promise<WorkspacePaths> {
    const root = path.join(this.baseWorkspacePath, workspaceId);
    const paths: WorkspacePaths = {
      root,
      app: path.join(root, "app"),
      components: path.join(root, "app", "components"),
      config: path.join(root, "config"),
      voxera: path.join(root, ".voxera"),
      shadow: path.join(root, ".voxera", "shadow"),
    };

    await fs.mkdir(paths.root, { recursive: true });
    await fs.mkdir(paths.app, { recursive: true });
    await fs.mkdir(paths.components, { recursive: true });
    await fs.mkdir(paths.config, { recursive: true });
    await fs.mkdir(paths.voxera, { recursive: true });
    await fs.mkdir(paths.shadow, { recursive: true });

    return paths;
  }

  async syncVirtualToReal(virtualRoot: DirectoryNode, workspaceId: string): Promise<WorkspacePaths> {
    const paths = await this.initializeWorkspace(workspaceId);
    
    await this.syncNode(virtualRoot, paths.root);
    
    return paths;
  }

  private async syncNode(node: FileNode | DirectoryNode, realPath: string): Promise<void> {
    if (isFile(node)) {
      const dir = path.dirname(realPath);
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.writeFile(realPath, node.content, "utf-8");
    } else if (isDirectory(node)) {
      if (!existsSync(realPath)) {
        await fs.mkdir(realPath, { recursive: true });
      }
      
      for (const child of node.children) {
        const childPath = path.join(realPath, child.name);
        await this.syncNode(child, childPath);
      }
    }
  }

  async writeFile(workspaceId: string, relativePath: string, content: string): Promise<string> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    const dir = path.dirname(fullPath);
    
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(fullPath, content, "utf-8");
    return fullPath;
  }

  async readFile(workspaceId: string, relativePath: string): Promise<string | null> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    
    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  async deleteFile(workspaceId: string, relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (e: unknown) {
      // If the file is already gone, treat as successful delete for idempotency.
      const err = e as { code?: string };
      if (err?.code === "ENOENT") {
        return true;
      }
      return false;
    }
  }

  async deleteDirectory(workspaceId: string, relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(workspaceId: string, relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
    return fullPath;
  }

  async listDirectory(workspaceId: string, relativePath: string): Promise<string[]> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    
    try {
      return await fs.readdir(fullPath);
    } catch {
      return [];
    }
  }

  async fileExists(workspaceId: string, relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    return existsSync(fullPath);
  }

  async getWorkspacePath(workspaceId: string): Promise<string> {
    return path.join(this.baseWorkspacePath, workspaceId);
  }

  async writeShadowFile(workspaceId: string, relativePath: string, content: string): Promise<string> {
    const shadowPath = path.join(
      this.baseWorkspacePath, 
      workspaceId, 
      ".voxera", 
      "shadow", 
      relativePath
    );
    
    const dir = path.dirname(shadowPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    await fs.writeFile(shadowPath, content, "utf-8");
    return shadowPath;
  }

  async readShadowFile(workspaceId: string, relativePath: string): Promise<string | null> {
    const shadowPath = path.join(
      this.baseWorkspacePath, 
      workspaceId, 
      ".voxera", 
      "shadow", 
      relativePath
    );
    
    try {
      return await fs.readFile(shadowPath, "utf-8");
    } catch {
      return null;
    }
  }

  async commitShadowFile(workspaceId: string, relativePath: string): Promise<boolean> {
    const shadowPath = path.join(
      this.baseWorkspacePath, 
      workspaceId, 
      ".voxera", 
      "shadow", 
      relativePath
    );
    
    const realPath = path.join(this.baseWorkspacePath, workspaceId, relativePath);
    
    try {
      const content = await fs.readFile(shadowPath, "utf-8");
      const dir = path.dirname(realPath);
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.writeFile(realPath, content, "utf-8");
      await fs.unlink(shadowPath);
      return true;
    } catch {
      return false;
    }
  }

  async discardShadowFile(workspaceId: string, relativePath: string): Promise<boolean> {
    const shadowPath = path.join(
      this.baseWorkspacePath, 
      workspaceId, 
      ".voxera", 
      "shadow", 
      relativePath
    );
    
    try {
      await fs.unlink(shadowPath);
      return true;
    } catch {
      return false;
    }
  }

  async loadWorkspaceFromDirectory(workspaceId: string, sourcePath: string): Promise<DirectoryNode> {
    const root: DirectoryNode = {
      id: generateDirId(),
      name: path.basename(sourcePath),
      path: "",
      type: "directory",
      children: [],
      lastModified: Date.now(),
    };

    await this.loadDirectory(sourcePath, root, "");
    
    const destPath = path.join(this.baseWorkspacePath, workspaceId);
    await this.copyDirectory(sourcePath, destPath);
    
    return root;
  }

  private async loadDirectory(dirPath: string, parentNode: DirectoryNode, basePath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
          continue;
        }

        const childDir: DirectoryNode = {
          id: generateDirId(),
          name: entry.name,
          path: relativePath,
          type: "directory",
          children: [],
          lastModified: Date.now(),
        };

        parentNode.children.push(childDir);
        await this.loadDirectory(entryPath, childDir, relativePath);
      } else if (entry.isFile()) {
        const content = await fs.readFile(entryPath, "utf-8");
        const fileType = getFileType(entry.name);
        
        const childFile: FileNode = {
          id: generateFileId(),
          name: entry.name,
          path: relativePath,
          type: "file",
          content,
          lastModified: Date.now(),
          fileType,
          language: getLanguage(fileType),
        };

        parentNode.children.push(childFile);
      }
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
          continue;
        }
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

export function createRealFilesystemManager(config: RealFilesystemConfig): RealFilesystemManager {
  return new RealFilesystemManager(config);
}

export const realFilesystem = new RealFilesystemManager({
  baseWorkspacePath: process.cwd() + "/workspaces",
});
