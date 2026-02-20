import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["en", "kn", "hi"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type VoiceIntent = {
  type: string;
  target?: string;
  value?: string;
  component?: {
    type?: string;
    props?: Record<string, unknown>;
    children?: unknown[];
  };
};

function mapLanguageToLocale(language: string): SupportedLocale {
  const langLower = language.toLowerCase();
  if (langLower.includes("kannada") || langLower.includes("kn") || language.includes("ಕನ್ನಡ")) return "kn";
  if (langLower.includes("hindi") || langLower.includes("hi") || language.includes("हिन्दी")) return "hi";
  return "en";
}

async function audioToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

async function transcribeAudio(audioBase64: string, mimeType: string, apiKey: string): Promise<{ transcript: string; language: string }> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: "Transcribe this audio exactly as spoken. Also identify the language. Return ONLY valid JSON in this exact format: {\"transcript\":\"the spoken text\",\"language\":\"English\"}" }
        ]
      }]
    }),
  });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    const parsed = JSON.parse(text.replace(/```json\n?/g, "").replace(/\n?```/g, "").trim());
    return { transcript: parsed.transcript || "", language: parsed.language || "English" };
  } catch {
    return { transcript: text, language: "English" };
  }
}

async function generateIntent(transcript: string, apiKey: string): Promise<VoiceIntent> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `You are a UI intent generator. Convert the user's speech into a JSON intent for creating/modifying UI components.

USER SPEECH: "${transcript}"

OUTPUT RULES:
- Return ONLY a single JSON object
- No markdown, no code blocks, no explanations
- No text before or after the JSON

INTENT TYPES:
1. component.create - to create a new UI element
2. component.delete - to delete the last created element
3. ui.setColor - to change demo button color
4. ui.setTheme - to toggle dark/light mode
5. none - if not a UI command

COMPONENT TYPES: button, div, text, input, heading, container

EXAMPLES:

Speech: "create a button"
Output: {"type":"component.create","component":{"type":"button","props":{"text":"Button","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

Speech: "एक बटन बनाओ" (create a button in Hindi)
Output: {"type":"component.create","component":{"type":"button","props":{"text":"Button","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

Speech: "add a button named Submit"
Output: {"type":"component.create","component":{"type":"button","props":{"text":"Submit","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

Speech: "एक बटन बनाओ जिसका नाम हिंदी हो"
Output: {"type":"component.create","component":{"type":"button","props":{"text":"हिंदी","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

Speech: "create text saying hello world"
Output: {"type":"component.create","component":{"type":"text","props":{"text":"hello world","className":"text-lg"}}}

Speech: "add an input field"
Output: {"type":"component.create","component":{"type":"input","props":{"placeholder":"Enter text","className":"border rounded px-3 py-2"}}}

Speech: "make a red button"
Output: {"type":"component.create","component":{"type":"button","props":{"text":"Red Button","className":"rounded-lg bg-red-600 px-4 py-2 text-white"}}}

Speech: "create a div"
Output: {"type":"component.create","component":{"type":"div","props":{"className":"p-4 bg-gray-100 rounded"}}}

Speech: "delete it"
Output: {"type":"component.delete"}

Speech: "remove the button"
Output: {"type":"component.delete"}

Speech: "make the button red"
Output: {"type":"ui.setColor","target":"button.demo","value":"red"}

Speech: "dark mode"
Output: {"type":"ui.setTheme","value":"dark"}

Speech: "hello how are you"
Output: {"type":"none"}

Now convert this speech: "${transcript}"`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 300 }
      }),
    });

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("[Intent Generator] Raw response:", text);

    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const intent = JSON.parse(jsonMatch[0]);
      return normalizeIntent(intent, transcript);
    }

    console.error("[Intent Generator] No JSON found in response");
    return { type: "none" };
  } catch (error) {
    console.error("[Intent Generator] Error:", error);
    return { type: "none" };
  }
}

function normalizeIntent(intent: Record<string, unknown>, transcript: string): VoiceIntent {
  const validTypes = ["component.create", "component.update", "component.delete", "ui.setColor", "ui.setTheme", "none"];

  if (!intent.type || typeof intent.type !== "string" || !validTypes.includes(intent.type)) {
    return { type: "none" };
  }

  const result: VoiceIntent = { type: intent.type };

  if (typeof intent.target === "string") result.target = intent.target;
  if (typeof intent.value === "string") result.value = intent.value;

  if (intent.component && typeof intent.component === "object") {
    const comp = intent.component as Record<string, unknown>;
    result.component = { type: "div", props: {} };

    const validCompTypes = ["button", "div", "text", "input", "heading", "container"];
    if (typeof comp.type === "string" && validCompTypes.includes(comp.type)) {
      result.component.type = comp.type;
    }

    if (comp.props && typeof comp.props === "object") {
      result.component.props = comp.props as Record<string, unknown>;
    } else {
      result.component.props = {};
    }

    if (result.component.type === "button" && !result.component.props.text) {
      result.component.props.text = "Button";
    }
    if (result.component.type === "button" && !result.component.props.className) {
      result.component.props.className = "rounded-lg bg-blue-600 px-4 py-2 text-white";
    }
    if (result.component.type === "text" && !result.component.props.text) {
      result.component.props.text = transcript;
    }
    if (result.component.type === "text" && !result.component.props.className) {
      result.component.props.className = "text-lg";
    }
    if (result.component.type === "input" && !result.component.props.placeholder) {
      result.component.props.placeholder = "Enter text";
    }
    if (result.component.type === "input" && !result.component.props.className) {
      result.component.props.className = "border rounded px-3 py-2";
    }
    if (result.component.type === "div" && !result.component.props.className) {
      result.component.props.className = "p-4 bg-gray-100 rounded";
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ success: false, message: "No audio" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API not configured" }, { status: 500 });
    }

    console.log("[Voice API] ===== START =====");
    console.log("[Voice API] Audio size:", audioFile.size);

    const audioBase64 = await audioToBase64(audioFile);
    const mimeType = audioFile.type || "audio/webm";

    console.log("[Voice API] Step 1: Transcribing...");
    const { transcript, language } = await transcribeAudio(audioBase64, mimeType, apiKey);
    console.log("[Voice API] Transcript:", transcript);
    console.log("[Voice API] Language:", language);

    if (!transcript) {
      return NextResponse.json({ success: false, message: "Could not transcribe" }, { status: 500 });
    }

    const detectedLocale = mapLanguageToLocale(language);

    console.log("[Voice API] Step 2: Generating intent...");
    const intent = await generateIntent(transcript, apiKey);
    console.log("[Voice API] Intent:", JSON.stringify(intent));
    console.log("[Voice API] ===== END =====");

    return NextResponse.json({
      success: true,
      transcript,
      detectedLocale,
      intent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Voice API] Error:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
