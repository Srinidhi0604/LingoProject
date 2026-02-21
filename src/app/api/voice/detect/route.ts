import { NextRequest, NextResponse } from "next/server";
import { VoiceIntent, ComponentType } from "@/types/intent";
import { normalizeIntent } from "@/lib/intentNormalizer";

const SUPPORTED_LOCALES = ["en", "kn", "hi"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

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

const INTENT_SYSTEM_PROMPT = `You are a semantic UI intent parser for a voice-controlled IDE. Convert natural language into structured JSON intents.

CRITICAL RULES:
1. Output MUST be exactly one valid JSON object
2. NO markdown, NO code blocks, NO explanations
3. Understand SEMANTIC MEANING across all languages
4. Support application-level operations (pages, routes, navigation)

INTENT TYPES:
- component.create: Create a new UI element
- component.update: Modify existing element by name/type
- component.delete: Delete elements
- component.duplicate: Duplicate last element
- page.create: Create a new page/route
- page.delete: Delete a page
- nav.add: Add navigation element
- file.create: Create a new file
- file.update: Update file content
- ui.setColor: Change color
- ui.setTheme: Toggle dark/light mode
- none: Not a UI command

COMPONENT TYPES: button, div, text, input, heading, link, image, container, card, form, paragraph, textarea, checkbox, select, list, listItem

OUTPUT SCHEMA:
{
  "type": "<intent_type>",
  "component": {
    "type": "<component_type>",
    "props": { "text": "...", "className": "...", ... }
  },
  "value": "<color/theme/text>",
  "target": "<name or identifier>",
  "pageName": "<for page operations>"
}

EXAMPLES:

CREATE BUTTON:
"create a button" → {"type":"component.create","component":{"type":"button","props":{"text":"Button","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

"create button named Submit" → {"type":"component.create","component":{"type":"button","props":{"text":"Submit","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

"एक बटन बनाओ जिसका नाम Lingodev 2 है" → {"type":"component.create","component":{"type":"button","props":{"text":"Lingodev 2","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

"ಹೆಸರು Lingodev 2 ಎಂಬ ಬಟನ್ ಸೇರಿಸಿ" → {"type":"component.create","component":{"type":"button","props":{"text":"Lingodev 2","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

"create another button called Next" → {"type":"component.create","component":{"type":"button","props":{"text":"Next","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

"add a new button named Cancel" → {"type":"component.create","component":{"type":"button","props":{"text":"Cancel","className":"rounded-lg bg-blue-600 px-4 py-2 text-white"}}}

UPDATE COMPONENT:
"rename the button to Submit" → {"type":"component.update","target":"button","value":"Submit"}
"change button text to Go" → {"type":"component.update","target":"button","value":"Go"}
"update the Lingodev button to Lingodev Next" → {"type":"component.update","target":"Lingodev","value":"Lingodev Next"}

CREATE PAGE:
"create a new page called About" → {"type":"page.create","pageName":"about"}
"create contact page" → {"type":"page.create","pageName":"contact"}
"होम पेज बनाओ" → {"type":"page.create","pageName":"home"}

CREATE NAVIGATION:
"add navigation bar" → {"type":"nav.add","component":{"type":"nav"}}
"add a link to About page" → {"type":"component.create","component":{"type":"link","props":{"text":"About","href":"/about"}}}

CREATE OTHER ELEMENTS:
"add input field" → {"type":"component.create","component":{"type":"input","props":{"placeholder":"Enter text","className":"border rounded px-3 py-2 w-full"}}}
"create heading Welcome" → {"type":"component.create","component":{"type":"heading","props":{"text":"Welcome","className":"text-2xl font-bold","level":1}}}
"add red button" → {"type":"component.create","component":{"type":"button","props":{"text":"Button","className":"rounded-lg bg-red-600 px-4 py-2 text-white"}}}

DELETE:
"delete it" → {"type":"component.delete"}
"remove button" → {"type":"component.delete"}
"हटाओ" → {"type":"component.delete"}

THEME:
"dark mode" → {"type":"ui.setTheme","value":"dark"}
"light mode" → {"type":"ui.setTheme","value":"light"}

NOT A COMMAND:
"hello" → {"type":"none"}

IMPORTANT: Extract text/names from speech. "button named X" or "button called X" → text: "X"`;

async function transcribeAudio(audioBase64: string, mimeType: string, apiKey: string): Promise<{ transcript: string; language: string }> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: "Transcribe this audio exactly as spoken. Identify the language. Return JSON: {\"transcript\":\"text\",\"language\":\"English\"}" }
        ]
      }]
    }),
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { transcript: parsed.transcript || "", language: parsed.language || "English" };
  } catch {
    return { transcript: text, language: "English" };
  }
}

async function generateIntent(transcript: string, apiKey: string): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `${INTENT_SYSTEM_PROMPT}

USER SPEECH: "${transcript}"

Return the intent JSON now:`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 500,
        topP: 0.95,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Intent generation failed: ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[Intent] No JSON found:", text);
    return { type: "none" };
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[Intent] Parse error:", e);
    return { type: "none" };
  }
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

    console.log("[Voice API] Audio size:", audioFile.size);

    const audioBase64 = await audioToBase64(audioFile);
    const mimeType = audioFile.type || "audio/webm";

    const { transcript, language } = await transcribeAudio(audioBase64, mimeType, apiKey);
    console.log("[Voice API] Transcript:", transcript, "Language:", language);

    if (!transcript.trim()) {
      return NextResponse.json({ success: false, message: "Empty transcript" }, { status: 400 });
    }

    const detectedLocale = mapLanguageToLocale(language);

    const rawIntent = await generateIntent(transcript, apiKey);
    console.log("[Voice API] Raw intent:", JSON.stringify(rawIntent));

    const intent: VoiceIntent = normalizeIntent(rawIntent, transcript, language);
    console.log("[Voice API] Final intent:", JSON.stringify(intent));

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
