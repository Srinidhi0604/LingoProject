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
  if (!rawIntent || typeof rawIntent !== "object") {
    return { type: "none", metadata: { confidence: 0, originalText: transcript, detectedLanguage } };
  }
  
  const raw = rawIntent as Record<string, unknown>;
  const type = normalizeIntentType(raw.type);
  
  if (type === "none") {
    return { type: "none", metadata: { confidence: 0.5, originalText: transcript, detectedLanguage } };
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
