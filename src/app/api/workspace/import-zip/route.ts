import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { realFilesystem } from "@/lib/realFilesystem";
import { applyNextAdminZoneBuilder } from "@/lib/nextAdminZoneBuilder";
import { applyImportedOverlay } from "@/lib/importOverlay";
import { ensureNextAppFromStaticZip } from "@/lib/staticZipNextApp";
import {
  DirectoryNode,
  FileNode,
  generateDirId,
  generateFileId,
  getFileType,
  getLanguage,
} from "@/types/filesystem";

const TEXT_EXTENSIONS = new Set([
  "tsx",
  "ts",
  "jsx",
  "js",
  "css",
  "scss",
  "sass",
  "less",
  "json",
  "md",
  "mjs",
  "cjs",
  "txt",
  "env",
  "yml",
  "yaml",
  "toml",
  "gitignore",
]);

const MAX_INLINE_BYTES_PER_FILE = 250 * 1024;
const MAX_INLINE_BYTES_TOTAL = 2 * 1024 * 1024;

const SINGLE_WORKSPACE_CONFIG = path.join(process.cwd(), "workspaces", ".voxera-single-workspace.json");

async function readSingleWorkspaceId(): Promise<string | null> {
  try {
    if (!existsSync(SINGLE_WORKSPACE_CONFIG)) return null;
    const raw = await fs.readFile(SINGLE_WORKSPACE_CONFIG, "utf-8");
    const parsed = JSON.parse(raw) as { workspaceId?: unknown };
    return typeof parsed.workspaceId === "string" && parsed.workspaceId.trim() ? parsed.workspaceId.trim() : null;
  } catch {
    return null;
  }
}

function shouldAlwaysOmitInlineContent(fileName: string): boolean {
  const base = path.basename(fileName).toLowerCase();
  return (
    base === "package-lock.json" ||
    base === "pnpm-lock.yaml" ||
    base === "yarn.lock" ||
    base === "bun.lockb" ||
    base === "composer.lock" ||
    base.endsWith(".map")
  );
}

function isProbablyTextFile(fileName: string): boolean {
  const base = path.basename(fileName);
  if (base === ".gitignore") return true;
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  return TEXT_EXTENSIONS.has(ext);
}

function normalizeZipPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function stripCommonTopFolder(paths: string[]): { stripped: string[]; prefix: string | null } {
  const normalized = paths.map(normalizeZipPath).filter(Boolean);
  if (normalized.length === 0) return { stripped: [], prefix: null };

  const firstSeg = normalized[0].split("/")[0];
  if (!firstSeg) return { stripped: normalized, prefix: null };

  const allShare = normalized.every((p) => p.startsWith(firstSeg + "/") || p === firstSeg);
  if (!allShare) return { stripped: normalized, prefix: null };

  const stripped = normalized
    .map((p) => (p === firstSeg ? "" : p.slice(firstSeg.length + 1)))
    .filter(Boolean);

  return { stripped, prefix: firstSeg };
}

async function ensureDirForFile(fullPath: string): Promise<void> {
  const dir = path.dirname(fullPath);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function buildVirtualTreeFromDisk(rootPath: string): Promise<DirectoryNode> {
  const root: DirectoryNode = {
    id: generateDirId(),
    name: path.basename(rootPath),
    path: "",
    type: "directory",
    children: [],
    lastModified: Date.now(),
  };

  let totalInlinedBytes = 0;

  const walk = async (diskDir: string, parent: DirectoryNode, basePath: string): Promise<void> => {
    const entries = await fs.readdir(diskDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
        continue;
      }

      const diskPath = path.join(diskDir, entry.name);
      const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const childDir: DirectoryNode = {
          id: generateDirId(),
          name: entry.name,
          path: relPath,
          type: "directory",
          children: [],
          lastModified: Date.now(),
        };
        parent.children.push(childDir);
        await walk(diskPath, childDir, relPath);
        continue;
      }

      if (entry.isFile()) {
        const fileType = getFileType(entry.name);
        const language = getLanguage(fileType);
        let content = "";
        const metadata: Record<string, unknown> = {};

        let sizeBytes = 0;
        try {
          const stat = await fs.stat(diskPath);
          sizeBytes = stat.size;
        } catch {
          sizeBytes = 0;
        }
        metadata.sizeBytes = sizeBytes;

        const canInline =
          isProbablyTextFile(entry.name) &&
          !shouldAlwaysOmitInlineContent(entry.name) &&
          sizeBytes <= MAX_INLINE_BYTES_PER_FILE &&
          totalInlinedBytes + sizeBytes <= MAX_INLINE_BYTES_TOTAL;

        if (canInline) {
          try {
            content = await fs.readFile(diskPath, "utf-8");
            totalInlinedBytes += sizeBytes;
          } catch {
            content = "";
          }
        } else if (isProbablyTextFile(entry.name) && sizeBytes > 0) {
          metadata.contentOmitted = true;
        }

        const childFile: FileNode = {
          id: generateFileId(),
          name: entry.name,
          path: relPath,
          type: "file",
          content,
          lastModified: Date.now(),
          fileType,
          language,
          metadata,
        };
        parent.children.push(childFile);
      }
    }
  };

  await walk(rootPath, root, "");
  return root;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestedWorkspaceId = formData.get("workspaceId") as string | null;

    const singleWorkspaceId = await readSingleWorkspaceId();
    const workspaceId = singleWorkspaceId || requestedWorkspaceId;

    if (!file || !workspaceId) {
      return NextResponse.json(
        { success: false, message: "file and workspaceId are required" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { success: false, message: "Only .zip files are supported" },
        { status: 400 }
      );
    }

    const workspacePath = await realFilesystem.getWorkspacePath(workspaceId);
    await fs.mkdir(workspacePath, { recursive: true });

    const { default: JSZip } = await import("jszip");
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    const allFilePaths = Object.keys(zip.files)
      .map((p) => normalizeZipPath(p))
      .filter((p) => p.length > 0 && !zip.files[p]?.dir);

    const { prefix } = stripCommonTopFolder(allFilePaths);

    // Extract everything to disk (preserve binary).
    for (const originalPath of allFilePaths) {
      const originalNorm = normalizeZipPath(originalPath);
      const entry = zip.files[originalPath] || zip.files[originalNorm];
      if (!entry || entry.dir) continue;

      const mapped = prefix ? originalNorm.slice(prefix.length + 1) : originalNorm;

      if (!mapped || mapped.startsWith("..") || mapped.includes("/.git/") || mapped.startsWith(".git/")) {
        continue;
      }

      const dest = path.join(workspacePath, mapped);
      await ensureDirForFile(dest);

      const nodeBuf = await entry.async("nodebuffer");
      await fs.writeFile(dest, nodeBuf);
    }

    // Hackathon-safe structural abstraction: if this looks like the NextAdmin dashboard,
    // inject the minimal zone-builder runtime into the imported workspace.
    await applyNextAdminZoneBuilder(workspacePath);

    // If the zip is a static landing (no package.json, e.g. code.html), scaffold a minimal Next app.
    await ensureNextAppFromStaticZip(workspacePath);

    // Universal hackathon overlay: add minimal voice-driven demo bridge + /lingo-dev page
    // for any App Router project (safe, additive).
    await applyImportedOverlay(workspacePath);

    const root = await buildVirtualTreeFromDisk(workspacePath);

    return NextResponse.json({
      success: true,
      root,
      workspaceId,
      workspacePath,
      message: `Imported zip to workspace ${workspaceId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Workspace Import Zip] Error:", message);
    return NextResponse.json(
      { success: false, message: "Import zip failed: " + message },
      { status: 500 }
    );
  }
}
