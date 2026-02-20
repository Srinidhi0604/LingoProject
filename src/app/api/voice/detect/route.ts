import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["en", "kn", "hi"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function mapLanguageToLocale(language: string): SupportedLocale {
  const langLower = language.toLowerCase();
  
  if (langLower.includes("english") || langLower.includes("en")) return "en";
  if (langLower.includes("kannada") || langLower.includes("kn") || langLower.includes("ಕನ್ನಡ")) return "kn";
  if (langLower.includes("hindi") || langLower.includes("hi") || langLower.includes("हिन्दी")) return "hi";
  
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { success: false, message: "No audio file provided" },
        { status: 400 }
      );
    }

    console.log("[Voice API] Audio received, size:", audioFile.size, "type:", audioFile.type);

    const geminiApiKey = process.env.GEMINI_API_KEY;
    console.log("[Voice API] GEMINI_API_KEY present:", !!geminiApiKey);
    if (!geminiApiKey || geminiApiKey === "your_gemini_api_key_here") {
      console.error("[Voice API] GEMINI_API_KEY not configured");
      return NextResponse.json(
        { success: false, message: "Transcription service not configured" },
        { status: 500 }
      );
    }

    const audioBase64 = await audioToBase64(audioFile);
    const mimeType = audioFile.type || "audio/webm";

    console.log("[Voice API] Calling Gemini with audio, mimeType:", mimeType);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiRequest = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64,
              },
            },
            {
              text: "Transcribe this audio and detect the language. Respond with JSON: {\"transcript\": \"text\", \"language\": \"English\"}",
            },
          ],
        },
      ],
    };

    console.log("[Voice API] Sending request to Gemini...");
    console.log("[Voice API] Request parts:", JSON.stringify(geminiRequest.contents[0].parts).substring(0, 200));

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiRequest),
    });

    const geminiResultText = await geminiResponse.text();
    console.log("[Voice API] Gemini response status:", geminiResponse.status);
    console.log("[Voice API] Gemini response:", geminiResultText.substring(0, 500));

    if (!geminiResponse.ok) {
      console.error("[Voice API] Gemini API error:", geminiResultText);
      return NextResponse.json(
        { success: false, message: "Transcription failed: " + geminiResponse.statusText + " - " + geminiResultText.substring(0, 100) },
        { status: 500 }
      );
    }

    let geminiResult;
    try {
      geminiResult = JSON.parse(geminiResultText);
    } catch (e) {
      console.error("[Voice API] Failed to parse Gemini response:", geminiResultText.substring(0, 500));
      return NextResponse.json(
        { success: false, message: "Invalid response from transcription service: " + geminiResultText.substring(0, 100) },
        { status: 500 }
      );
    }
    
    console.log("[Voice API] Gemini result:", JSON.stringify(geminiResult).substring(0, 200));
    
    let transcript = "";
    let detectedLanguage = "English";

    try {
      const textResponse = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log("[Voice API] Gemini text response:", textResponse);
      if (textResponse) {
        const parsed = JSON.parse(textResponse);
        transcript = parsed.transcript || "";
        detectedLanguage = parsed.language || "English";
      }
    } catch (parseError) {
      console.error("[Voice API] Failed to parse Gemini response:", parseError);
      transcript = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const detectedLocale = mapLanguageToLocale(detectedLanguage);

    console.log("[Voice API] Transcription complete:", { transcript, detectedLocale });

    return NextResponse.json({
      success: true,
      transcript,
      detectedLocale,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Voice API] Error processing audio:", errorMessage);
    return NextResponse.json(
      { success: false, message: "Failed to process audio: " + errorMessage },
      { status: 500 }
    );
  }
}
