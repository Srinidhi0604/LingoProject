"use client";

import { useState, useRef, useCallback } from "react";
import { useLingoContext } from "@lingo.dev/compiler/react";

type SupportedLocale = "en" | "kn" | "hi";

type VoiceIntent = {
  type: string;
  target?: string;
  value?: string;
};

type VoiceIntentHandler = (intent: VoiceIntent) => void;

function detectLocaleFromTranscript(transcript: string): SupportedLocale {
  const kannadaRange = /[\u0C80-\u0CFF]/;
  const hindiRange = /[\u0900-\u097F]/;

  if (kannadaRange.test(transcript)) {
    return "kn";
  }
  if (hindiRange.test(transcript)) {
    return "hi";
  }
  return "en";
}

function getLanguageName(locale: SupportedLocale): string {
  switch (locale) {
    case "kn":
      return "Kannada";
    case "hi":
      return "Hindi";
    default:
      return "English";
  }
}

function parseIntent(transcript: string): VoiceIntent | null {
  const text = transcript.toLowerCase();

  if (text.includes("red") || text.includes("ಕೆಂಪು") || text.includes("लाल") || text.includes("red button")) {
    return { type: "ui.setColor", target: "button.demo", value: "red" };
  }
  if (text.includes("green") || text.includes("ಹಸಿರು") || text.includes("हरा") || text.includes("green button")) {
    return { type: "ui.setColor", target: "button.demo", value: "green" };
  }
  if (text.includes("blue") || text.includes("ನೀಲಿ") || text.includes("नीला") || text.includes("blue button")) {
    return { type: "ui.setColor", target: "button.demo", value: "blue" };
  }
  if (text.includes("black") || text.includes("ಕಪ್ಪು") || text.includes("काला") || text.includes("black button")) {
    return { type: "ui.setColor", target: "button.demo", value: "black" };
  }

  if (text.includes("dark mode") || text.includes("ಡಾರ್ಕ್ ಮೋಡ್") || text.includes("डार्क मोड")) {
    return { type: "ui.setTheme", value: "dark" };
  }
  if (text.includes("light mode") || text.includes("ಲೈಟ್ ಮೋಡ್") || text.includes("लाइट मोड")) {
    return { type: "ui.setTheme", value: "light" };
  }

  if (text.includes("dashboard") || text.includes("ಡ್ಯಾಶ್‌ಬೋರ್ಡ್") || text.includes("डैशबोर्ड")) {
    return { type: "nav.go", target: "dashboard" };
  }
  if (text.includes("home") || text.includes("ಹೋಮ್") || text.includes("होम")) {
    return { type: "nav.go", target: "home" };
  }

  return null;
}

export default function Home() {
  const { locale, setLocale } = useLingoContext();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLocale>("en");
  const [statusMessage, setStatusMessage] = useState("");
  const [demoButtonColor, setDemoButtonColor] = useState("black");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const voiceRegistry: Record<string, VoiceIntentHandler> = {
    "button.demo": (intent) => {
      if (intent.value) {
        setDemoButtonColor(intent.value);
      }
    },
    "theme.main": (intent) => {
      if (intent.value === "dark") {
        setIsDarkMode(true);
      } else if (intent.value === "light") {
        setIsDarkMode(false);
      }
    },
  };

  const executeIntent = useCallback((intent: VoiceIntent) => {
    console.log("[Voice Engine] Executing intent:", intent);

    switch (intent.type) {
      case "ui.setColor": {
        const handler = voiceRegistry[intent.target || ""];
        if (handler) {
          handler(intent);
        }
        break;
      }
      case "ui.setTheme": {
        const themeHandler = voiceRegistry["theme.main"];
        if (themeHandler) {
          themeHandler(intent);
        }
        break;
      }
      case "nav.go": {
        console.log("[Voice Engine] Navigation requested to:", intent.target);
        break;
      }
      default:
        console.log("[Voice Engine] Unknown intent type:", intent.type);
    }
  }, []);

  const handleVoiceCommand = useCallback((transcriptText: string) => {
    const detectedLocale = detectLocaleFromTranscript(transcriptText);
    setDetectedLanguage(detectedLocale);

    if (detectedLocale !== locale) {
      setLocale(detectedLocale);
    }

    const intent = parseIntent(transcriptText);
    if (intent) {
      executeIntent(intent);
    }
  }, [locale, setLocale, executeIntent]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setTranscript("");
      setStatusMessage("");
    } catch (error) {
      console.error("Error starting recording:", error);
      setStatusMessage("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudio = async (audioBlob: Blob) => {
    try {
      setStatusMessage("Processing audio...");

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/voice/detect", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.transcript) {
        setTranscript(data.transcript);
        setStatusMessage("Transcription complete");
        handleVoiceCommand(data.transcript);
      } else {
        setStatusMessage(data.message || "Transcription failed");
      }
    } catch (error) {
      console.error("Error sending audio:", error);
      setStatusMessage("Failed to send audio");
    }
  };

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center p-8 ${isDarkMode ? "bg-zinc-900" : "bg-zinc-50"}`}>
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className={`text-4xl font-bold ${isDarkMode ? "text-white" : "text-black"}`}>
          Voice-Native Developer Runtime
        </h1>
        <p className={`max-w-lg text-lg ${isDarkMode ? "text-zinc-300" : "text-zinc-600"}`}>
          This system allows developers to control applications using their native language instead of English.
        </p>
        <p className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-black"}`}>
          Current language: {locale}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setLocale("en")}
            className="rounded-lg bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800"
          >
            English
          </button>
          <button
            onClick={() => setLocale("kn")}
            className="rounded-lg bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800"
          >
            Kannada
          </button>
          <button
            onClick={() => setLocale("hi")}
            className="rounded-lg bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800"
          >
            Hindi
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <p className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-black"}`}>Voice Recording</p>
          <div className="flex gap-4">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className="rounded-lg bg-red-600 px-6 py-3 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isRecording ? "Recording..." : "Start Recording"}
            </button>
            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="rounded-lg bg-gray-600 px-6 py-3 text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              Stop Recording
            </button>
          </div>

          <button
            id="demo-button"
            className="mt-4 rounded-lg px-6 py-3 text-white transition-colors"
            style={{ backgroundColor: demoButtonColor }}
          >
            Demo Button
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-lg bg-purple-600 px-6 py-3 text-white transition-colors hover:bg-purple-700"
          >
            Toggle Dark Mode
          </button>

          {statusMessage && (
            <p className="mt-4 text-lg font-medium text-blue-600">
              {statusMessage}
            </p>
          )}
          {transcript && (
            <div className="mt-4 rounded-lg bg-white p-4 text-left shadow-md">
              <p className="text-lg font-medium text-black">Transcript: {transcript}</p>
              <p className="mt-2 text-lg font-medium text-green-600">
                Detected language: {getLanguageName(detectedLanguage)}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
