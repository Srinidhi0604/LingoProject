import { NextRequest, NextResponse } from "next/server";
import { devServerManager } from "@/lib/devServerController";

function getStylesheetHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push(m[1]);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ success: false, message: "workspaceId required" }, { status: 400 });
  }

  const status = devServerManager.getStatus(workspaceId);
  if (!status?.running || !status.url) {
    return NextResponse.json({ success: true, stylesheets: [], status }, { status: 200 });
  }

  try {
    const res = await fetch(status.url, { redirect: "follow" });
    const html = await res.text();
    const hrefs = getStylesheetHrefs(html);
    const base = new URL(status.url);
    const stylesheets = hrefs
      .map((h) => {
        try {
          return new URL(h, base).toString();
        } catch {
          return null;
        }
      })
      .filter((x): x is string => Boolean(x));

    return NextResponse.json({ success: true, stylesheets, status }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch preview HTML";
    return NextResponse.json({ success: false, message: msg, stylesheets: [], status }, { status: 200 });
  }
}
