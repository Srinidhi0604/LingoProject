import type { BuilderNode, BuilderComponentType, UISchema } from "./schema";

import { createEmptySchema, generateId } from "./schema";

import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

type ParseResult = { schema: UISchema; warnings: string[] };

function unwrapJsxReturn(node: t.Expression | null | undefined): t.JSXElement | t.JSXFragment | null {
  let cur: t.Expression | null | undefined = node;
  while (cur) {
    if (t.isJSXElement(cur) || t.isJSXFragment(cur)) return cur;
    if (t.isParenthesizedExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    if (t.isTSAsExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    if (t.isTSNonNullExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    break;
  }
  return null;
}

function nodeTypeFromJsxName(name: string): BuilderComponentType {
  const lower = name.toLowerCase();
  if (lower === "button") return "button";
  if (lower === "img") return "image";
  if (lower === "a") return "link";
  if (lower === "input") return "input";
  if (lower === "p") return "paragraph";
  if (lower === "span") return "text";
  if (lower === "div" || lower === "main" || lower === "section") return "div";
  if (/^h[1-6]$/.test(lower)) return "heading";
  return "div";
}

function getJsxName(el: t.JSXOpeningElement): string {
  if (t.isJSXIdentifier(el.name)) return el.name.name;
  return "div";
}

function literalToValue(expr: t.Expression | t.JSXEmptyExpression | null | undefined): unknown {
  if (!expr || t.isJSXEmptyExpression(expr)) return undefined;
  if (t.isStringLiteral(expr)) return expr.value;
  if (t.isNumericLiteral(expr)) return expr.value;
  if (t.isBooleanLiteral(expr)) return expr.value;
  return undefined;
}

function attrsToProps(attrs: Array<t.JSXAttribute | t.JSXSpreadAttribute>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const a of attrs) {
    if (t.isJSXSpreadAttribute(a)) continue;
    if (!t.isJSXIdentifier(a.name)) continue;
    const key = a.name.name;
    if (!a.value) {
      props[key] = true;
      continue;
    }
    if (t.isStringLiteral(a.value)) {
      props[key] = a.value.value;
      continue;
    }
    if (t.isJSXExpressionContainer(a.value)) {
      props[key] = literalToValue(a.value.expression);
    }
  }
  return props;
}

function getTextContent(children: t.JSXChild[]): string {
  const parts: string[] = [];
  for (const c of children) {
    if (t.isJSXText(c)) {
      const v = c.value.replace(/\s+/g, " ").trim();
      if (v) parts.push(v);
    }
  }
  return parts.join(" ");
}

function jsxToBuilderNode(el: t.JSXElement, index: number): BuilderNode {
  const name = getJsxName(el.openingElement);
  const type = nodeTypeFromJsxName(name);
  const props = attrsToProps(el.openingElement.attributes);
  const text = getTextContent(el.children);
  if (text && (type === "button" || type === "paragraph" || type === "heading" || type === "text")) {
    props.text = props.text ?? text;
  }
  if (type === "heading" && /^h[1-6]$/i.test(name)) {
    props.level = Number(name.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  const node: BuilderNode = {
    id: generateId(type),
    name: typeof props.text === "string" && props.text.trim() ? String(props.text).trim() : name,
    type,
    props,
    layout: { x: 60, y: 80 + index * 72, w: 260, h: 48 },
    children: [],
  };

  const childElements = el.children.filter((c): c is t.JSXElement => t.isJSXElement(c));
  node.children = childElements.map((c, i) => jsxToBuilderNode(c, i));
  return node;
}

export function parsePageToSchema(pageTsx: string): ParseResult {
  const warnings: string[] = [];

  try {
    const ast = parse(pageTsx, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });

    let rootJsx: t.JSXElement | t.JSXFragment | null = null;

    traverse(ast, {
      ReturnStatement(path) {
        const arg = path.node.argument;
        const unwrapped = unwrapJsxReturn(arg);
        if (unwrapped) rootJsx = unwrapped;
      },
    });

    const schema = createEmptySchema();
    if (!rootJsx) {
      warnings.push("No JSX return found; using empty schema");
      return { schema, warnings };
    }

    const rootChildren = (t.isJSXElement(rootJsx) ? rootJsx.children : rootJsx.children).filter((c): c is t.JSXElement => t.isJSXElement(c));
    if (t.isJSXElement(rootJsx)) {
      // If the root is a wrapper component (e.g. <Layout>), include it as a node.
      const rootName = getJsxName(rootJsx.openingElement);
      const rootType = nodeTypeFromJsxName(rootName);
      const rootProps = attrsToProps(rootJsx.openingElement.attributes);

      const wrapper: BuilderNode = {
        id: generateId(rootType),
        name: rootName,
        type: rootType,
        props: rootProps,
        layout: { x: 40, y: 40, w: 980, h: 640 },
        children: rootChildren.map((c, i) => jsxToBuilderNode(c, i)),
      };

      schema.root.children = [wrapper];
    } else {
      schema.root.children = rootChildren.map((c, i) => jsxToBuilderNode(c, i));
    }
    return { schema, warnings };
  } catch {
    warnings.push("Failed to parse TSX; using empty schema");
    return { schema: createEmptySchema(), warnings };
  }
}

function propsToAttrString(props: Record<string, unknown>): string {
  const entries = Object.entries(props).filter(([k, v]) => v !== undefined && k !== "text" && k !== "level");
  const parts: string[] = [];
  for (const [k, v] of entries) {
    if (typeof v === "string") {
      parts.push(`${k}={${JSON.stringify(v)}}`);
    } else if (typeof v === "number" || typeof v === "boolean") {
      parts.push(`${k}={${String(v)}}`);
    }
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function nodeToJsx(node: BuilderNode, indent: string): string {
  const type = node.type;
  const className = typeof node.props.className === "string" ? node.props.className : "";
  const style = `position: 'absolute', left: ${Math.round(node.layout.x)}, top: ${Math.round(node.layout.y)}, width: ${Math.round(node.layout.w)}, height: ${Math.round(node.layout.h)}`;
  const baseStyle = `{ ${style} }`;
  const mergedClass = className ? ` className={${JSON.stringify(className)}}` : "";
  const styleAttr = ` style={${baseStyle}}`;
  const extra = propsToAttrString(node.props);

  const tag = (() => {
    if (type === "heading") {
      const level = (node.props.level as number) || 1;
      return `h${Math.min(6, Math.max(1, level))}`;
    }
    if (type === "paragraph") return "p";
    if (type === "text") return "span";
    if (type === "link") return "a";
    if (type === "image") return "img";
    return type;
  })();

  const text = typeof node.props.text === "string" ? node.props.text : "";

  if (tag === "img") {
    const src = typeof node.props.src === "string" ? node.props.src : "";
    const alt = typeof node.props.alt === "string" ? node.props.alt : "";
    const imgExtra = `${src ? ` src={${JSON.stringify(src)}}` : ""}${alt ? ` alt={${JSON.stringify(alt)}}` : ""}`;
    return `${indent}<${tag}${mergedClass}${styleAttr}${imgExtra}${extra} />`;
  }

  if (node.children.length === 0) {
    return `${indent}<${tag}${mergedClass}${styleAttr}${extra}>${text ? text : ""}</${tag}>`;
  }

  const children = node.children.map((c) => nodeToJsx(c, indent + "  ")).join("\n");
  return `${indent}<${tag}${mergedClass}${styleAttr}${extra}>\n${children}\n${indent}</${tag}>`;
}

export function schemaToPageTsx(schema: UISchema): string {
  const body = schema.root.children.map((c) => nodeToJsx(c, "      ")).join("\n");
  return `export default function Page() {
  return (
    <main style={{ position: 'relative', minHeight: '100vh' }}>
${body || "      <div />"}
    </main>
  );
}
`;
}
