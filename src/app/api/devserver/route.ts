import { NextRequest, NextResponse } from "next/server";
import { devServerManager } from "@/lib/devServerController";
import { realFilesystem } from "@/lib/realFilesystem";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, action, workspacePath } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: "Workspace ID required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "start": {
        const path = workspacePath || await realFilesystem.getWorkspacePath(workspaceId);
        
        const status = await devServerManager.startServer(workspaceId, {
          workspacePath: path,
        });
        
        return NextResponse.json({
          success: status.running,
          status,
          message: status.running 
            ? `Dev server running at ${status.url}` 
            : `Failed to start: ${status.error}`,
        });
      }

      case "stop": {
        const path = workspacePath || await realFilesystem.getWorkspacePath(workspaceId);
        const stopped = await devServerManager.stopServer(workspaceId, path);
        return NextResponse.json({
          success: stopped,
          message: stopped ? "Server stopped" : "Server not running",
        });
      }

      case "restart": {
        const path = workspacePath || await realFilesystem.getWorkspacePath(workspaceId);
        
        const status = await devServerManager.restartServer(workspaceId, {
          workspacePath: path,
        });
        
        return NextResponse.json({
          success: status.running,
          status,
          message: status.running 
            ? `Dev server restarted at ${status.url}` 
            : `Failed to restart: ${status.error}`,
        });
      }

      case "status": {
        const status = devServerManager.getStatus(workspaceId);
        return NextResponse.json({
          success: true,
          status,
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: "Invalid action. Use: start, stop, restart, status" },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Dev Server API] Error:", message);
    return NextResponse.json(
      { success: false, message: "Dev server operation failed: " + message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { success: false, message: "Workspace ID required" },
      { status: 400 }
    );
  }

  const status = devServerManager.getStatus(workspaceId);
  return NextResponse.json({
    success: true,
    status,
  });
}
