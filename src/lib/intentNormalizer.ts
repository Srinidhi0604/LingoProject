import {
  VoiceIntent,
  IntentType,
  ComponentType,
  ComponentProps,
  VALID_INTENT_TYPES,
  VALID_COMPONENT_TYPES,
  DEFAULT_PROPS,
  COMPONENT_ALIASES,
} from "@/types/intent";

export function normalizeComponentType(type: unknown): ComponentType {
  if (typeof type !== "string") return "div";
  
  const lowerType = type.toLowerCase().trim();
  
  if (COMPONENT_ALIASES[lowerType]) {
    return COMPONENT_ALIASES[lowerType];
  }
  
  if (VALID_COMPONENT_TYPES.includes(lowerType as ComponentType)) {
    return lowerType as ComponentType;
  }
  
  return "div";
}

export function normalizeIntentType(type: unknown): IntentType {
  if (typeof type !== "string") return "none";
  
  const lowerType = type.toLowerCase().trim();
  
  if (VALID_INTENT_TYPES.includes(lowerType as IntentType)) {
    return lowerType as IntentType;
  }
  
  if (lowerType.includes("create") || lowerType.includes("add") || lowerType.includes("make")) {
    return "component.create";
  }
  if (lowerType.includes("delete") || lowerType.includes("remove")) {
    return "component.delete";
  }
  if (lowerType.includes("update") || lowerType.includes("modify") || lowerType.includes("change")) {
    return "component.update";
  }
  
  return "none";
}

export function normalizeProps(props: unknown, componentType: ComponentType): ComponentProps {
  if (!props || typeof props !== "object") {
    return { ...DEFAULT_PROPS[componentType] };
  }
  
  const rawProps = props as Record<string, unknown>;
  const normalized: ComponentProps = { ...DEFAULT_PROPS[componentType] };
  
  if (typeof rawProps.text === "string") {
    normalized.text = rawProps.text;
  }
  if (typeof rawProps.className === "string") {
    normalized.className = rawProps.className;
  }
  if (typeof rawProps.placeholder === "string") {
    normalized.placeholder = rawProps.placeholder;
  }
  if (typeof rawProps.href === "string") {
    normalized.href = rawProps.href;
  }
  if (typeof rawProps.src === "string") {
    normalized.src = rawProps.src;
  }
  if (typeof rawProps.alt === "string") {
    normalized.alt = rawProps.alt;
  }
  if (typeof rawProps.type === "string") {
    normalized.type = rawProps.type;
  }
  if (typeof rawProps.name === "string") {
    normalized.name = rawProps.name;
  }
  if (typeof rawProps.value === "string") {
    normalized.value = rawProps.value;
  }
  if (typeof rawProps.level === "number" && rawProps.level >= 1 && rawProps.level <= 6) {
    normalized.level = rawProps.level as 1 | 2 | 3 | 4 | 5 | 6;
  }
  if (typeof rawProps.color === "string") {
    normalized.color = rawProps.color;
  }
  if (typeof rawProps.backgroundColor === "string") {
    normalized.backgroundColor = rawProps.backgroundColor;
  }
  if (typeof rawProps.disabled === "boolean") {
    normalized.disabled = rawProps.disabled;
  }
  
  return normalized;
}

export function validateIntent(intent: unknown): intent is VoiceIntent {
  if (!intent || typeof intent !== "object") return false;
  
  const i = intent as Record<string, unknown>;
  
  if (typeof i.type !== "string") return false;
  
  return VALID_INTENT_TYPES.includes(i.type as IntentType);
}

export function normalizeIntent(
  rawIntent: unknown,
  transcript: string,
  detectedLanguage: string
): VoiceIntent {
  const inferFromTranscript = (): VoiceIntent | null => {
    const originalText = transcript || "";
    const text = originalText.trim();
    if (!text) return null;

    const lower = text.toLowerCase();

    const includesButton =
      lower.includes("button") ||
      text.includes("बटन") ||
      text.includes("बटण") ||
      text.includes("બટન") ||
      text.includes("ಬಟನ್");

    const includesLingoDev =
      // Allow "lingo" without requiring the word "dev" (users often say "lingo button").
      lower.includes("lingo") ||
      // Hindi spellings
      text.includes("लिंगो") ||
      text.includes("लिंगो देव") ||
      text.includes("लिंगोदेव") ||
      // Some detectors strip matras/diacritics: "लिंगो देव" -> "लग दव"
      /(?:लिंगो|लिगो|लिंग|लिग|लग)\s*(?:dev|डेव|दव)?/i.test(text);

    const includesHindiSwitch =
      lower.includes("hindi") ||
      text.includes("हिंदी") ||
      text.includes("हिन्दी") ||
      text.includes("हिंदी में") ||
      // Stripped form sometimes becomes "हद म"
      text.includes("हद म") ||
      // If detector already says Hindi, treat as Hindi intent even if transcript got mangled.
      String(detectedLanguage || "").toLowerCase().startsWith("hi");

    const asksLingoDevButton =
      includesLingoDev && (includesButton || lower.includes("ek button") || text.includes("एक बटन") || lower.includes("add") || text.includes("ऐड"));

    // If the user is asking to switch to Hindi AND wants the Lingo Dev button,
    // prioritize this over the generic "show button" intent.
    if (includesHindiSwitch && asksLingoDevButton) {
      return {
        type: "ui.hindiLingoDev",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    // Combined demo sequence: show Hindi/profile first, then Kannada/calendar.
    const asksBothHindiAndKannada =
      (lower.includes("hindi") || text.includes("हिंदी") || text.includes("हिन्दी")) &&
      (lower.includes("kannada") || text.includes("ಕನ್ನಡ") || text.includes("ಕನ್ನಡದಲ್ಲಿ"));

    const asksDemoSequence =
      lower.includes("demo") ||
      lower.includes("both") ||
      lower.includes("together") ||
      lower.includes("sequence") ||
      (lower.includes("first") && lower.includes("then")) ||
      (lower.includes("profile") && (lower.includes("calendar") || lower.includes("calender"))) ||
      (text.includes("प्रोफाइल") && (text.includes("कैलेंडर") || text.includes("कैलेंड")));

    if (asksBothHindiAndKannada && asksDemoSequence) {
      return {
        type: "ui.demoHiThenKn",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    if (includesLingoDev && includesButton) {
      return {
        type: "ui.showLingoButton",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    const includesAiInsights =
      (lower.includes("ai") && lower.includes("insight")) ||
      text.includes("एआई इनसाइट") ||
      text.includes("ai insights") ||
      text.includes("ai इनसाइट्स") ||
      text.includes("इनसाइट्स");

    if (includesAiInsights) {
      return {
        type: "ui.showAiInsights",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    // Kannada calendar demo: "ಈ ತಿಂಗಳಲ್ಲಿ ಒಂದು ಹೊಸ ಈವೆಂಟ್ ಸೇರಿಸಿ" -> add an event.
    // Some detectors strip/mangle, so we match a few safe stems.
    const includesKannadaCalendar =
      text.includes("ಕ್ಯಾಲೆಂಡ") ||
      text.includes("ಕ್ಯಾಲೆಂಡರ್") ||
      lower.includes("calendar");

    const includesKannadaThisMonth =
      text.includes("ಈ ತಿಂ") ||
      text.includes("ಈ ತಿಂದು") ||
      text.includes("ಈ ತಿಂಗಳು") ||
      text.includes("ಈ ತಿಂಗಳಲ್ಲಿ") ||
      // Stripped form often becomes "ಈ ತ..."
      /ಈ\s*ತ/i.test(text);

    const includesKannadaEventWord =
      text.includes("ಈವೆಂಟ್") ||
      text.includes("ಇವೆಂಟ್") ||
      // Stripped form: "ಈವೆಂಟ್" -> "ಈವಟ"
      text.includes("ಈವಟ") ||
      lower.includes("event");

    const includesKannadaAdd =
      text.includes("ಸೇರ") ||
      text.includes("ಸೇರಿಸಿ") ||
      text.includes("ಸೇರಿಸು") ||
      // Stripped form: "ಸೇರಿಸಿ" -> "ಸರಸ"
      text.includes("ಸರಸ") ||
      lower.includes("add");

    if ((includesKannadaCalendar || includesKannadaThisMonth) && includesKannadaEventWord && includesKannadaAdd) {
      return {
        type: "ui.calendarKnAddEvent",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    // Deterministic Kannada screenshot demo routing.
    // Rule: If transcript contains Kannada characters AND mentions calendar/kannada keywords.
    // (Append-only; does not affect Hindi logic.)
    const hasKannadaChars = /[\u0C80-\u0CFF]/.test(text);
    // Some detectors strip vowel signs/diacritics (e.g. "ಕ್ಯಾಲೆಂಡರ್" -> "ಕಯಲಡರ", "ಕನ್ನಡ" -> "ಕನನಡ").
    const stripped = text.replace(/[\u0CBE-\u0CCD\u0CD5\u0CD6]/g, "");
    const mentionsKannadaCalendarKeyword =
      text.includes("ಕ್ಯಾಲೆಂಡರ್") ||
      text.includes("ಕನ್ನಡ") ||
      stripped.includes("ಕಯಲಡರ") ||
      stripped.includes("ಕನನಡ");
    if (hasKannadaChars && mentionsKannadaCalendarKeyword) {
      return {
        type: "KANNADA_CALENDAR_DEMO",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    const includesMinimalMode =
      lower.includes("switch to minimal mode") ||
      lower.includes("minimal mode") ||
      lower.includes("minimal") && lower.includes("mode");

    const includesInvestor = /\binvest\w*\b/i.test(lower);
    const includesAnalytics = /\banalyt\w*\b/i.test(lower) || lower.includes("analysis") || lower.includes("insights");
    const includesDashboard = lower.includes("dashboard") || /\bdash\w*\b/i.test(lower);
    const asksConvertView = /\b(convert|turn|make)\b/i.test(lower) || lower.includes("into");
    const includesMinimal = lower.includes("minimal");

    if (includesMinimal && (includesAnalytics || includesDashboard) && asksConvertView) {
      return {
        type: "ui.activatePreset",
        value: "minimal_investor",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    if (includesMinimalMode) {
      return {
        type: "ui.switchMinimalMode",
        metadata: {
          confidence: 0.9,
          originalText,
          detectedLanguage,
        },
      };
    }

    // (Hindi+LingoDev handled above)

    if (!includesButton) return null;

    // Extract a name/label if user said “named/called …” (English) or “नाम … / जिसका नाम …” (Hindi)
    // or “ಹೆಸರು …” (Kannada). Fall back to a generic label.
    const namePatterns: RegExp[] = [
      /\b(?:named|called)\b\s+(.+)$/i,
      /(?:जिसका\s+नाम|नाम|नेम|नाम\s+का)\s+(.+)$/i,
      /(?:ಹೆಸರು|ಎಂದು)\s+(.+)$/i,
    ];

    let label = "Button";
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        label = match[1].trim();
        break;
      }
    }

    label = label
      .replace(/^[:\-\s"'“”‘’]+/, "")
      .replace(/["'“”‘’\s]+$/, "")
      .replace(/[.?!]+$/, "")
      .replace(/\s+(?:है|हैं|हूँ|हो|था|थी|थे|hai)\s*$/i, "")
      .trim();

    if (!label) label = "Button";
    if (label.length > 80) label = label.slice(0, 80).trim();

    return {
      type: "component.create",
      component: {
        type: "button",
        props: {
          ...DEFAULT_PROPS.button,
          text: label,
        },
      },
      metadata: {
        confidence: 0.6,
        originalText,
        detectedLanguage,
      },
    };
  };

  // High-priority override: if the transcript clearly asks for Hindi + Lingo button,
  // always honor that even if the upstream detector returns a generic component intent.
  const inferred = inferFromTranscript();
  if (inferred?.type === "ui.hindiLingoDev") return inferred;

  if (!rawIntent || typeof rawIntent !== "object") {
    return inferred || { type: "none", metadata: { confidence: 0, originalText: transcript, detectedLanguage } };
  }
  
  const raw = rawIntent as Record<string, unknown>;

  // Upstream models sometimes return custom types directly.
  if (typeof raw.type === "string" && raw.type === "calendar_kn_add_event") {
    return {
      type: "ui.calendarKnAddEvent",
      metadata: {
        confidence: 1,
        originalText: transcript,
        detectedLanguage,
      },
    };
  }

  const type = normalizeIntentType(raw.type);
  
  if (type === "none") {
    return inferred || { type: "none", metadata: { confidence: 0.5, originalText: transcript, detectedLanguage } };
  }
  
  const intent: VoiceIntent = {
    type,
    metadata: {
      confidence: 1,
      originalText: transcript,
      detectedLanguage,
    },
  };
  
  if (typeof raw.target === "string") {
    intent.target = raw.target;
  }
  
  if (typeof raw.value === "string") {
    intent.value = raw.value;
  }
  
  if (typeof raw.pageName === "string") {
    intent.pageName = raw.pageName;
  }
  
  if (raw.component && typeof raw.component === "object") {
    const rawComponent = raw.component as Record<string, unknown>;
    
    const componentType = normalizeComponentType(rawComponent.type);
    
    intent.component = {
      type: componentType,
      props: normalizeProps(rawComponent.props, componentType),
    };
    
    if (Array.isArray(rawComponent.children)) {
      intent.component.children = rawComponent.children;
    }
  }
  
  return intent;
}

export function applyColorToClassName(className: string, color: string): string {
  const colorMap: Record<string, string> = {
    red: "bg-red-600",
    green: "bg-green-600",
    blue: "bg-blue-600",
    yellow: "bg-yellow-500",
    purple: "bg-purple-600",
    pink: "bg-pink-600",
    orange: "bg-orange-500",
    black: "bg-black",
    white: "bg-white",
    gray: "bg-gray-600",
    grey: "bg-gray-600",
  };
  
  const bgClass = colorMap[color.toLowerCase()];
  if (!bgClass) return className;
  
  return className.replace(/bg-\w+-\d+/, bgClass);
}
