import { NextRequest, NextResponse } from "next/server";
import { parseProjectFiles, validateImportedComponents } from "@/lib/projectImporter";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { success: false, message: "Only .zip files are supported" },
        { status: 400 }
      );
    }

    console.log("[Import API] Processing uploaded project:", file.name, file.size, "bytes");

    const { default: JSZip } = await import("jszip");
    
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const files: { path: string; content: string }[] = [];

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      
      console.log("[Import API] Found file:", relativePath);
      
      if (
        relativePath.endsWith(".tsx") ||
        relativePath.endsWith(".ts") ||
        relativePath.endsWith(".jsx") ||
        relativePath.endsWith(".js")
      ) {
        const content = await zipEntry.async("string");
        files.push({ path: relativePath, content });
      }
    }

    console.log("[Import API] Extracted", files.length, "source files");

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, message: "No source files found in zip" },
        { status: 400 }
      );
    }

    const result = parseProjectFiles(files);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.errors.join("; ") || "Failed to parse project",
          warnings: result.warnings,
        },
        { status: 400 }
      );
    }

    const { valid, warnings } = validateImportedComponents(result.components);

    console.log("[Import API] Imported", valid.length, "components");

    return NextResponse.json({
      success: true,
      components: valid,
      warnings: [...result.warnings, ...warnings],
      stats: {
        fileCount: files.length,
        componentCount: valid.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Import API] Error:", message);
    return NextResponse.json(
      { success: false, message: "Import failed: " + message },
      { status: 500 }
    );
  }
}
