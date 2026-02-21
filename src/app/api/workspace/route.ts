import { NextRequest, NextResponse } from "next/server";
import { realFilesystem } from "@/lib/realFilesystem";
import { devServerManager } from "@/lib/devServerController";
import { DirectoryNode, FileNode, isFile, isDirectory, createDirectory, createFile } from "@/types/filesystem";
import { isPathEditable, validateFile } from "@/lib/shadowWorkspace";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, workspaceId, path: relativePath, content, sourcePath, virtualRoot, operations } = body;

    switch (action) {
      case "initialize": {
        if (!workspaceId) {
          return NextResponse.json(
            { success: false, message: "Workspace ID required" },
            { status: 400 }
          );
        }

        const paths = await realFilesystem.initializeWorkspace(workspaceId);
        return NextResponse.json({
          success: true,
          paths: {
            root: paths.root,
            app: paths.app,
            components: paths.components,
          },
        });
      }

      case "syncVirtual": {
        if (!workspaceId || !virtualRoot) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and virtualRoot required" },
            { status: 400 }
          );
        }

        const paths = await realFilesystem.syncVirtualToReal(virtualRoot as DirectoryNode, workspaceId);
        return NextResponse.json({
          success: true,
          paths: {
            root: paths.root,
            app: paths.app,
          },
        });
      }

      case "loadFromDirectory": {
        if (!workspaceId || !sourcePath) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and sourcePath required" },
            { status: 400 }
          );
        }

        const root = await realFilesystem.loadWorkspaceFromDirectory(workspaceId, sourcePath);
        
        const collectFiles = (node: DirectoryNode | FileNode): { path: string; content: string }[] => {
          if (isFile(node)) {
            return [{ path: node.path, content: node.content }];
          }
          if (isDirectory(node)) {
            return node.children.flatMap(collectFiles);
          }
          return [];
        };

        const files = collectFiles(root);
        
        return NextResponse.json({
          success: true,
          root,
          files,
          message: `Loaded ${files.length} files from ${sourcePath}`,
        });
      }

      case "writeFile": {
        if (!workspaceId || !relativePath || content === undefined) {
          return NextResponse.json(
            { success: false, message: "Workspace ID, path, and content required" },
            { status: 400 }
          );
        }

        const fullPath = await realFilesystem.writeFile(workspaceId, relativePath, content);
        return NextResponse.json({
          success: true,
          path: fullPath,
          message: `File written: ${relativePath}`,
        });
      }

      case "readFile": {
        if (!workspaceId || !relativePath) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and path required" },
            { status: 400 }
          );
        }

        const fileContent = await realFilesystem.readFile(workspaceId, relativePath);
        
        if (fileContent === null) {
          return NextResponse.json(
            { success: false, message: "File not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          content: fileContent,
        });
      }

      case "deleteFile": {
        if (!workspaceId || !relativePath) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and path required" },
            { status: 400 }
          );
        }

        const deleted = await realFilesystem.deleteFile(workspaceId, relativePath);
        return NextResponse.json({
          success: deleted,
          message: deleted ? `Deleted: ${relativePath}` : "Failed to delete",
        });
      }

      case "createDirectory": {
        if (!workspaceId || !relativePath) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and path required" },
            { status: 400 }
          );
        }

        const fullPath = await realFilesystem.createDirectory(workspaceId, relativePath);
        return NextResponse.json({
          success: true,
          path: fullPath,
          message: `Directory created: ${relativePath}`,
        });
      }

      case "writeShadow": {
        if (!workspaceId || !relativePath || content === undefined) {
          return NextResponse.json(
            { success: false, message: "Workspace ID, path, and content required" },
            { status: 400 }
          );
        }

        const shadowPath = await realFilesystem.writeShadowFile(workspaceId, relativePath, content);
        return NextResponse.json({
          success: true,
          shadowPath,
          message: `Shadow file created: ${relativePath}`,
        });
      }

      case "commitShadow": {
        if (!workspaceId || !relativePath) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and path required" },
            { status: 400 }
          );
        }

        const committed = await realFilesystem.commitShadowFile(workspaceId, relativePath);
        return NextResponse.json({
          success: committed,
          message: committed ? `Committed: ${relativePath}` : "Failed to commit shadow",
        });
      }

      case "applyOperations": {
        if (!workspaceId || !Array.isArray(operations)) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and operations[] required" },
            { status: 400 }
          );
        }

        type Op = {
          type: "create" | "update" | "delete" | "createDirectory";
          path: string;
          content?: string;
        };

        const results: Array<{ path: string; success: boolean; error?: string }> = [];
        let allOk = true;

        for (const raw of operations as Op[]) {
          const opPath = typeof raw?.path === "string" ? raw.path : "";
          const opType = raw?.type;

          if (!opPath || typeof opType !== "string") {
            allOk = false;
            results.push({ path: opPath || "(unknown)", success: false, error: "Invalid operation" });
            continue;
          }

          if (!isPathEditable(opPath)) {
            allOk = false;
            results.push({ path: opPath, success: false, error: `Path not editable: ${opPath}` });
            continue;
          }

          try {
            if (opType === "delete") {
              const deleted = await realFilesystem.deleteFile(workspaceId, opPath);
              if (!deleted) {
                allOk = false;
                results.push({ path: opPath, success: false, error: "Failed to delete" });
              } else {
                results.push({ path: opPath, success: true });
              }
              continue;
            }

            if (opType === "createDirectory") {
              await realFilesystem.createDirectory(workspaceId, opPath);
              results.push({ path: opPath, success: true });
              continue;
            }

            if (opType === "create" || opType === "update") {
              if (typeof raw.content !== "string") {
                allOk = false;
                results.push({ path: opPath, success: false, error: "Missing content" });
                continue;
              }

              const validation = validateFile(opPath, raw.content);
              if (!validation.valid) {
                allOk = false;
                results.push({ path: opPath, success: false, error: validation.errors.join(", ") });
                continue;
              }

              await realFilesystem.writeShadowFile(workspaceId, opPath, raw.content);
              const committed = await realFilesystem.commitShadowFile(workspaceId, opPath);
              if (!committed) {
                allOk = false;
                results.push({ path: opPath, success: false, error: "Failed to commit shadow file" });
              } else {
                results.push({ path: opPath, success: true });
              }
              continue;
            }

            allOk = false;
            results.push({ path: opPath, success: false, error: `Unknown op type: ${opType}` });
          } catch (e) {
            allOk = false;
            const msg = e instanceof Error ? e.message : "Unknown error";
            results.push({ path: opPath, success: false, error: msg });
          }
        }

        return NextResponse.json({
          success: allOk,
          results,
          message: allOk ? "Applied operations" : "Some operations failed",
        });
      }

      case "discardShadow": {
        if (!workspaceId || !relativePath) {
          return NextResponse.json(
            { success: false, message: "Workspace ID and path required" },
            { status: 400 }
          );
        }

        const discarded = await realFilesystem.discardShadowFile(workspaceId, relativePath);
        return NextResponse.json({
          success: discarded,
          message: discarded ? `Discarded: ${relativePath}` : "Failed to discard shadow",
        });
      }

      case "startDev": {
        if (!workspaceId) {
          return NextResponse.json(
            { success: false, message: "Workspace ID required" },
            { status: 400 }
          );
        }

        const workspacePath = await realFilesystem.getWorkspacePath(workspaceId);
        const status = await devServerManager.startServer(workspaceId, { workspacePath });
        
        return NextResponse.json({
          success: status.running,
          status,
          message: status.running 
            ? `Dev server running at ${status.url}` 
            : `Failed to start: ${status.error}`,
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Workspace API] Error:", message);
    return NextResponse.json(
      { success: false, message: "Workspace operation failed: " + message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const path = searchParams.get("path");

  if (!workspaceId) {
    return NextResponse.json(
      { success: false, message: "Workspace ID required" },
      { status: 400 }
    );
  }

  if (path) {
    const content = await realFilesystem.readFile(workspaceId, path);
    return NextResponse.json({
      success: content !== null,
      content,
    });
  }

  const workspacePath = await realFilesystem.getWorkspacePath(workspaceId);
  return NextResponse.json({
    success: true,
    path: workspacePath,
  });
}
