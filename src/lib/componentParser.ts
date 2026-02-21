import { Component, ComponentType, ComponentProps, DEFAULT_PROPS } from "@/types/intent";
import { FileNode, DirectoryNode, isFile, isDirectory } from "@/types/filesystem";

interface ParsedAttribute {
  name: string;
  value: string | number | boolean;
}

interface ParsedElement {
  type: string;
  props: Record<string, unknown>;
  children: ParsedElement[];
  text?: string;
}

function parseJsxAttributes(attrString: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const attrRegex = /(\w+)(?:=\{([^}]+)\}|="([^"]*)")?/g;
  let match;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1];
    const curlyValue = match[2];
    const quoteValue = match[3];

    if (curlyValue !== undefined) {
      if (curlyValue === "true") props[name] = true;
      else if (curlyValue === "false") props[name] = false;
      else if (/^\d+$/.test(curlyValue)) props[name] = parseInt(curlyValue, 10);
      else props[name] = curlyValue;
    } else if (quoteValue !== undefined) {
      props[name] = quoteValue;
    } else {
      props[name] = true;
    }
  }

  return props;
}

function extractTextContent(content: string): string {
  const textMatch = content.match(/>([^<]+)</);
  return textMatch ? textMatch[1].trim() : "";
}

function parseJsxElement(jsx: string, startIndex: number = 0): { element: ParsedElement | null; endIndex: number } {
  const openTagMatch = jsx.slice(startIndex).match(/<(\w+)([^>]*)>/);
  if (!openTagMatch) return { element: null, endIndex: startIndex };

  const tagName = openTagMatch[1];
  const attrString = openTagMatch[2];
  const fullMatchLength = openTagMatch[0].length;
  const tagStart = startIndex + fullMatchLength;

  const props = parseJsxAttributes(attrString);
  const children: ParsedElement[] = [];
  let currentIndex = tagStart;
  let text = "";

  const selfClosing = openTagMatch[0].endsWith("/>");
  if (selfClosing) {
    return {
      element: { type: tagName, props, children: [], text: "" },
      endIndex: startIndex + fullMatchLength,
    };
  }

  const closeTag = `</${tagName}>`;
  let depth = 1;

  while (currentIndex < jsx.length && depth > 0) {
    const remainingContent = jsx.slice(currentIndex);

    const nextOpenTag = remainingContent.match(/<(\w+)[^>]*>/);
    const nextCloseTag = remainingContent.match(/<\/(\w+)>/);
    const nextSelfClose = remainingContent.match(/<\w+[^>]*\/>/);

    if (nextSelfClose && (!nextOpenTag || nextSelfClose.index! < nextOpenTag.index!)) {
      const selfCloseMatch = nextSelfClose[0];
      const selfCloseTag = nextSelfClose[1];
      const selfCloseAttr = selfCloseMatch.slice(1, -2).replace(selfCloseTag, "").trim();
      
      children.push({
        type: selfCloseTag,
        props: parseJsxAttributes(selfCloseAttr),
        children: [],
        text: "",
      });
      currentIndex += selfCloseMatch.length;
    } else if (nextCloseTag && (!nextOpenTag || nextCloseTag.index! <= nextOpenTag.index!)) {
      if (nextCloseTag[1] === tagName) {
        const textBeforeClose = jsx.slice(currentIndex, currentIndex + nextCloseTag.index!);
        if (textBeforeClose.trim() && children.length === 0) {
          text = textBeforeClose.trim();
        }
        currentIndex += nextCloseTag.index! + nextCloseTag[0].length;
        depth--;
      } else {
        currentIndex += nextCloseTag.index! + nextCloseTag[0].length;
      }
    } else if (nextOpenTag) {
      const textBeforeOpen = jsx.slice(currentIndex, currentIndex + nextOpenTag.index!);
      if (textBeforeOpen.trim() && children.length === 0 && depth === 1) {
        text = textBeforeOpen.trim();
      }

      const childResult = parseJsxElement(jsx, currentIndex + nextOpenTag.index!);
      if (childResult.element) {
        children.push(childResult.element);
      }
      currentIndex = childResult.endIndex;
    } else {
      break;
    }
  }

  return {
    element: { type: tagName, props, children, text },
    endIndex: currentIndex,
  };
}

function parsedElementToComponent(element: ParsedElement, idPrefix: string = "comp"): Component {
  const componentType = normalizeElementType(element.type);
  const defaultProps = DEFAULT_PROPS[componentType] || {};
  const props: ComponentProps = {
    ...defaultProps,
    ...element.props,
    text: element.text || element.props.text as string || defaultProps.text || "",
  };

  if (element.props.className && typeof element.props.className === "string") {
    props.className = element.props.className;
  }

  const children = element.children.map((child, index) => 
    parsedElementToComponent(child, `${idPrefix}_${index}`)
  );

  return {
    id: `${idPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    type: componentType,
    props,
    children,
  };
}

function normalizeElementType(tagName: string): ComponentType {
  const typeMap: Record<string, ComponentType> = {
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    p: "paragraph",
    a: "link",
    ul: "list",
    li: "listItem",
    div: "div",
    span: "span",
    button: "button",
    input: "input",
    textarea: "textarea",
    img: "image",
    form: "form",
  };

  return typeMap[tagName] || "div";
}

function extractJsxFromPage(content: string): string {
  const returnMatch = content.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*\n?\}/);
  if (returnMatch) {
    return returnMatch[1];
  }
  return content;
}

export function parsePageFile(content: string): Component[] {
  const jsxContent = extractJsxFromPage(content);
  const components: Component[] = [];

  let currentIndex = 0;
  let componentIndex = 0;

  while (currentIndex < jsxContent.length) {
    const result = parseJsxElement(jsxContent, currentIndex);
    
    if (result.element) {
      const component = parsedElementToComponent(result.element, `page_${componentIndex}`);
      components.push(component);
      componentIndex++;
      currentIndex = result.endIndex;
    } else {
      currentIndex++;
    }

    if (currentIndex === result.endIndex) {
      currentIndex++;
    }
  }

  return components;
}

export function parseComponentFile(content: string, fileName: string): Component[] {
  return parsePageFile(content);
}

export function extractComponentsFromFile(file: FileNode): Component[] {
  if (file.fileType !== "tsx" && file.fileType !== "jsx") {
    return [];
  }

  if (file.path.includes("layout.tsx") || file.path.includes("layout.jsx")) {
    return [];
  }

  if (file.path.includes("globals.css") || file.path.includes(".css")) {
    return [];
  }

  return parsePageFile(file.content);
}

export function extractAllComponents(node: FileNode | DirectoryNode): Component[] {
  const components: Component[] = [];

  if (isFile(node)) {
    const fileComponents = extractComponentsFromFile(node);
    components.push(...fileComponents);
  } else if (isDirectory(node)) {
    for (const child of node.children) {
      components.push(...extractAllComponents(child));
    }
  }

  return components;
}
