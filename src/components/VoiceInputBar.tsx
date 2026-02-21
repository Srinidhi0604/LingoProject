"use client";

import { useState } from "react";
import { Mic, Square, Globe, ChevronUp, Sparkles } from "lucide-react";

interface VoiceInputBarProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  currentLocale: string;
  onLocaleChange: (locale: string) => void;
  statusMessage?: string;
}

const LOCALES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "kn", name: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
];

export default function VoiceInputBar({
  isRecording,
  onStartRecording,
  onStopRecording,
  currentLocale,
  onLocaleChange,
  statusMessage,
}: VoiceInputBarProps) {
  const [showLocales, setShowLocales] = useState(false);

  return (
    <div className="bg-[#0A0A0A] border-t border-white/10 px-4 py-3 relative z-50">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        <div className="relative">
          <button
            onClick={() => setShowLocales(!showLocales)}
            className="px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2"
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span>{LOCALES.find(l => l.code === currentLocale)?.flag}</span>
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          
          {showLocales && (
            <div className="absolute bottom-full left-0 mb-2 w-40 bg-[#111] rounded-lg shadow-2xl border border-white/10 overflow-hidden z-50">
              {LOCALES.map((locale) => (
                <button
                  key={locale.code}
                  onClick={() => {
                    onLocaleChange(locale.code);
                    setShowLocales(false);
                  }}
                  className={`w-full px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${
                    currentLocale === locale.code ? "bg-white/5 text-white font-medium" : "text-zinc-400"
                  }`}
                >
                  <span className="text-base">{locale.flag}</span>
                  <span>{locale.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 relative group">
          <div className={`bg-[#111] border rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all duration-300 ${
            isRecording ? "border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]" : "border-white/10 group-hover:border-white/20"
          }`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isRecording ? (
                <div className="flex items-center gap-2 text-indigo-400">
                  <div className="flex gap-1">
                    <span className="w-1 h-3 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_100ms]"></span>
                    <span className="w-1 h-4 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                    <span className="w-1 h-2 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_300ms]"></span>
                  </div>
                  <span className="text-sm font-medium animate-pulse">Listening...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">What would you like to build?</span>
                </div>
              )}
            </div>
            
            {statusMessage && !isRecording && (
              <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md truncate max-w-[200px]">
                {statusMessage}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`relative px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 font-medium shadow-lg ${
            isRecording
              ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
              : "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25"
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span className="text-sm">Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span className="text-sm">Record</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
