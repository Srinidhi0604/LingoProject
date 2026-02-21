import { NextRequest, NextResponse } from "next/server";
import { exportProject } from "@/lib/projectExporter";
import { Component } from "@/types/intent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { components } = body as { components: Component[] };

    if (!components || !Array.isArray(components)) {
      return NextResponse.json(
        { success: false, message: "Invalid components data" },
        { status: 400 }
      );
    }

    console.log("[Export API] Exporting", components.length, "components");

    const manifest = exportProject(components);

    console.log("[Export API] Generated", manifest.files.length, "files");

    return NextResponse.json({
      success: true,
      manifest: {
        name: manifest.name,
        version: manifest.version,
        generatedAt: manifest.generatedAt,
        componentCount: manifest.componentCount,
      },
      files: manifest.files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Export API] Error:", message);
    return NextResponse.json(
      { success: false, message: "Export failed: " + message },
      { status: 500 }
    );
  }
}
