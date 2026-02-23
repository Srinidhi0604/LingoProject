import { NextRequest, NextResponse } from "next/server";
import { normalizeIntent } from "@/lib/intentNormalizer";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { transcript?: unknown; language?: unknown };
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const language = typeof body.language === "string" ? body.language : "English";

    const intent = normalizeIntent({ type: "none" }, transcript, language);

    return NextResponse.json({ success: true, transcript, language, intent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
