import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "screenshots", "profile-hi.png");
    const buf = await fs.readFile(filePath);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Screenshot not found" }, { status: 404 });
  }
}
