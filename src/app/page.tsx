"use client";

import { useState, useRef, useCallback, ReactNode } from "react";
import { useLingoContext } from "@lingo.dev/compiler/react";

type SupportedLocale = "en" | "kn" | "hi";

type UIComponent = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: UIComponent[];
};

type VoiceIntent = {
  type: string;
  target?: string;
  value?: string;
  component?: Partial<UIComponent>;
};

type VoiceIntentHandler = (intent: VoiceIntent) => void;

type APIResponse = {
  success: boolean;
  transcript?: string;
  detectedLocale?: SupportedLocale;
  intent?: VoiceIntent | null;
  message?: string;
};

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

function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function findComponentById(tree: UIComponent[], id: string): UIComponent | null {
  for (const component of tree) {
    if (component.id === id) {
      return component;
    }
    const found = findComponentById(component.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function updateComponentInTree(
  tree: UIComponent[],
  id: string,
  updates: Partial<UIComponent>
): UIComponent[] {
  return tree.map((component) => {
    if (component.id === id) {
      return { ...component, ...updates };
    }
    return {
      ...component,
      children: updateComponentInTree(component.children, id, updates),
    };
  });
}

function deleteComponentFromTree(tree: UIComponent[], id: string): UIComponent[] {
  return tree
    .filter((component) => component.id !== id)
    .map((component) => ({
      ...component,
      children: deleteComponentFromTree(component.children, id),
    }));
}

function renderComponent(component: UIComponent): ReactNode {
  const { id, type, props, children } = component;
  const childElements = children.map(renderComponent);

  switch (type) {
    case "button":
      return (
        <button key={id} {...props}>
          {childElements.length > 0 ? childElements : props.text || "Button"}
        </button>
      );
    case "div":
      return (
        <div key={id} {...props}>
          {childElements}
        </div>
      );
    case "span":
      return (
        <span key={id} {...props}>
          {childElements.length > 0 ? childElements : props.text || ""}
        </span>
      );
    case "text":
      return (
        <span key={id} {...props}>
          {props.text || ""}
        </span>
      );
    case "input":
      return <input key={id} {...props} />;
    case "form":
      return (
        <form key={id} {...props}>
          {childElements}
        </form>
      );
    case "container":
      return (
        <div key={id} {...props} className={`${props.className || ""} p-4 border rounded`}>
          {childElements}
        </div>
      );
    case "image":
      return <img key={id} {...props} />;
    case "heading":
      const Tag = (props.level as "h1" | "h2" | "h3" | "h4" | "h5" | "h6") || "h1";
      return (
        <Tag key={id} {...props}>
          {childElements.length > 0 ? childElements : props.text || ""}
        </Tag>
      );
    default:
      return (
        <div key={id} {...props} data-component-type={type}>
          {childElements}
        </div>
      );
  }
}

const initialComponentTree: UIComponent[] = [
  {
    id: "demo-button",
    type: "button",
    props: { text: "Demo Button", className: "mt-4 rounded-lg px-6 py-3 text-white transition-colors" },
    children: [],
  },
];

export default function Home() {
  const { locale, setLocale } = useLingoContext();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLocale>("en");
  const [statusMessage, setStatusMessage] = useState("");
  const [componentTree, setComponentTree] = useState<UIComponent[]>(initialComponentTree);
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
    if (!intent || intent.type === "none") {
      console.log("[Voice Engine] No valid intent to execute");
      return;
    }

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
      case "component.create": {
        if (intent.component) {
          const newComponent: UIComponent = {
            id: generateId(),
            type: intent.component.type || "div",
            props: intent.component.props || {},
            children: intent.component.children || [],
          };
          setComponentTree((prev) => [...prev, newComponent]);
          console.log("[Voice Engine] Created component:", newComponent.id);
        }
        break;
      }
      case "component.update": {
        if (intent.target) {
          setComponentTree((prev) => updateComponentInTree(prev, intent.target!, intent.component?.props || {}));
          console.log("[Voice Engine] Updated component:", intent.target);
        }
        break;
      }
      case "component.delete": {
        if (intent.target) {
          setComponentTree((prev) => deleteComponentFromTree(prev, intent.target!));
          console.log("[Voice Engine] Deleted component:", intent.target);
        } else if (componentTree.length > 0) {
          const lastComp = componentTree[componentTree.length - 1];
          setComponentTree((prev) => deleteComponentFromTree(prev, lastComp.id));
          console.log("[Voice Engine] Deleted last component:", lastComp.id);
        }
        break;
      }
      default:
        console.log("[Voice Engine] Unknown intent type:", intent.type);
    }
  }, [componentTree]);

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

      const data: APIResponse = await response.json();

      if (data.success && data.transcript) {
        setTranscript(data.transcript);
        setStatusMessage("Transcription complete");

        if (data.detectedLocale) {
          setDetectedLanguage(data.detectedLocale);
          if (data.detectedLocale !== locale) {
            setLocale(data.detectedLocale);
          }
        }

        if (data.intent) {
          executeIntent(data.intent);
        }
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

          <div className="mt-6 flex flex-col items-center gap-4">
            <p className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-black"}`}>Component Tree Preview</p>
            <div className={`min-h-[100px] w-full max-w-md rounded-lg border-2 border-dashed p-4 ${isDarkMode ? "border-zinc-600" : "border-zinc-300"}`}>
              {componentTree.length === 0 ? (
                <p className={`text-sm ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>No components. Speak to create one.</p>
              ) : (
                componentTree.map(renderComponent)
              )}
            </div>
          </div>

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
