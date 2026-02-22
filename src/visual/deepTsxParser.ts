import path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

import type { BuilderComponentType, BuilderNode, UISchema } from "@/builder/schema";
import { createEmptySchema, generateId } from "@/builder/schema";

type FileGetter = (p: string) => { path: string; content: string } | null;

type ImportMap = Map<string, string>; // localName -> resolvedFilePath

function normalizePosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function dirnamePosix(p: string): string {
  const dir = path.posix.dirname(normalizePosix(p));
  return dir === "." ? "" : dir;
}

function joinPosix(...parts: string[]): string {
  return path.posix.normalize(path.posix.join(...parts.map(normalizePosix)));
}

function nodeTypeFromJsxName(name: string): BuilderComponentType {
  const lower = name.toLowerCase();
  if (lower === "button") return "button";
  if (lower === "img") return "image";
  if (lower === "a") return "link";
  if (lower === "input") return "input";
  if (lower === "p") return "paragraph";
  if (lower === "span") return "text";
  if (lower === "div" || lower === "main" || lower === "section" || lower === "article") return "div";
  if (/^h[1-6]$/.test(lower)) return "heading";
  return "div";
}

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

function getJsxName(el: t.JSXOpeningElement): string {
  if (t.isJSXIdentifier(el.name)) return el.name.name;
  if (t.isJSXMemberExpression(el.name) && t.isJSXIdentifier(el.name.property)) return el.name.property.name;
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

function parseImportMap(filePath: string, code: string, getFile: FileGetter): ImportMap {
  const map: ImportMap = new Map();
  let ast: t.File;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["typescript", "jsx"] });
  } catch {
    return map;
  }

  const fromDir = dirnamePosix(filePath);

  const resolve = (source: string): string | null => {
    const s = normalizePosix(source);

    const tryCandidates = (base: string): string | null => {
      const candidates = [
        base,
        `${base}.tsx`,
        `${base}.ts`,
        `${base}.jsx`,
        `${base}.js`,
        joinPosix(base, "index.tsx"),
        joinPosix(base, "index.ts"),
        joinPosix(base, "index.jsx"),
        joinPosix(base, "index.js"),
      ];
      for (const c of candidates) {
        if (getFile(c)) return c;
      }
      return null;
    };

    if (s.startsWith("./") || s.startsWith("../")) {
      return tryCandidates(joinPosix(fromDir, s));
    }

    if (s.startsWith("@/")) {
      const rest = s.slice(2);
      // common alias patterns
      return (
        tryCandidates(joinPosix("src", rest)) ||
        tryCandidates(rest)
      );
    }

    return null;
  };

  traverse(ast, {
    ImportDeclaration(p) {
      const src = p.node.source.value;
      const resolved = resolve(src);
      if (!resolved) return;
      for (const spec of p.node.specifiers) {
        if (t.isImportDefaultSpecifier(spec)) {
          map.set(spec.local.name, resolved);
        } else if (t.isImportSpecifier(spec)) {
          map.set(spec.local.name, resolved);
        }
      }
    },
  });

  return map;
}

function extractComponentReturn(code: string): t.JSXElement | t.JSXFragment | null {
  try {
    const ast = parse(code, { sourceType: "module", plugins: ["typescript", "jsx"] });
    let found: t.JSXElement | t.JSXFragment | null = null;

    traverse(ast, {
      ExportDefaultDeclaration(p) {
        const decl = p.node.declaration;
        if (t.isFunctionDeclaration(decl) || t.isArrowFunctionExpression(decl) || t.isFunctionExpression(decl)) {
          const body = (decl as t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression).body;
          if (t.isBlockStatement(body)) {
            for (const st of body.body) {
              if (t.isReturnStatement(st)) {
                const unwrapped = unwrapJsxReturn(st.argument as t.Expression | null | undefined);
                if (unwrapped) found = unwrapped;
              }
            }
          } else {
            const unwrapped = unwrapJsxReturn(body as unknown as t.Expression);
            if (unwrapped) found = unwrapped;
          }
        }
      },
      ReturnStatement(p) {
        if (found) return;
        const unwrapped = unwrapJsxReturn(p.node.argument as t.Expression | null | undefined);
        if (unwrapped) found = unwrapped;
      },
    });

    return found;
  } catch {
    return null;
  }
}

type BuildCtx = {
  filePath: string;
  code: string;
  importMap: ImportMap;
  getFile: FileGetter;
  depth: number;
  seen: Set<string>;
};

function jsxChildElements(node: t.JSXElement | t.JSXFragment): t.JSXElement[] {
  const children = node.children;
  return children.filter((c): c is t.JSXElement => t.isJSXElement(c));
}

function jsxToBuilderNodeDeep(el: t.JSXElement, index: number, ctx: BuildCtx): BuilderNode {
  const name = getJsxName(el.openingElement);
  const isHtml = /^[a-z]/.test(name);
  const type = nodeTypeFromJsxName(name);
  const props = attrsToProps(el.openingElement.attributes);
  const text = getTextContent(el.children);
  if (text && (type === "button" || type === "paragraph" || type === "heading" || type === "text")) {
    props.text = props.text ?? text;
  }
  if (type === "heading" && /^h[1-6]$/i.test(name)) {
    props.level = Number(name.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  const baseNode: BuilderNode = {
    id: generateId(type),
    name,
    type,
    props,
    layout: { x: 60, y: 80 + index * 72, w: 360, h: 56 },
    children: [],
  };

  // Expand imported components (best-effort) into their returned JSX.
  if (!isHtml && ctx.depth < 4) {
    const target = ctx.importMap.get(name);
    if (target && !ctx.seen.has(target)) {
      const file = ctx.getFile(target);
      if (file) {
        ctx.seen.add(target);
        const componentImportMap = parseImportMap(file.path, file.content, ctx.getFile);
        const returned = extractComponentReturn(file.content);
        if (returned) {
          const kids = jsxChildElements(returned);
          baseNode.children = kids.map((c, i) =>
            jsxToBuilderNodeDeep(c, i, {
              filePath: file.path,
              code: file.content,
              importMap: componentImportMap,
              getFile: ctx.getFile,
              depth: ctx.depth + 1,
              seen: ctx.seen,
            })
          );
          baseNode.name = `${name}`;
          baseNode.layout = { x: 60, y: 80 + index * 72, w: 480, h: 240 };
          return baseNode;
        }
      }
    }
  }

  const childElements = el.children.filter((c): c is t.JSXElement => t.isJSXElement(c));
  baseNode.children = childElements.map((c, i) => jsxToBuilderNodeDeep(c, i, ctx));
  return baseNode;
}

export function parseWorkspacePageToSchemaDeep(pagePath: string, getFile: FileGetter): UISchema {
  const file = getFile(pagePath);
  if (!file) return createEmptySchema();

  const schema = createEmptySchema();
  const importMap = parseImportMap(file.path, file.content, getFile);

  let ast: t.File;
  try {
    ast = parse(file.content, { sourceType: "module", plugins: ["typescript", "jsx"] });
  } catch {
    return schema;
  }

  let root: t.JSXElement | t.JSXFragment | null = null;
  traverse(ast, {
    ReturnStatement(p) {
      const unwrapped = unwrapJsxReturn(p.node.argument as t.Expression | null | undefined);
      if (unwrapped) root = unwrapped;
    },
  });

  if (!root) return schema;

  const nodes = jsxChildElements(root).map((c, i) =>
    jsxToBuilderNodeDeep(c, i, {
      filePath: file.path,
      code: file.content,
      importMap,
      getFile,
      depth: 0,
      seen: new Set([file.path]),
    })
  );

  // Wrap root itself if it is a JSXElement.
  if (t.isJSXElement(root)) {
    const rootName = getJsxName(root.openingElement);
    const rootType = nodeTypeFromJsxName(rootName);
    const rootProps = attrsToProps(root.openingElement.attributes);
    const wrapper: BuilderNode = {
      id: generateId(rootType),
      name: rootName,
      type: rootType,
      props: rootProps,
      layout: { x: 40, y: 40, w: 1080, h: 720 },
      children: nodes,
    };
    schema.root.children = [wrapper];
  } else {
    schema.root.children = nodes;
  }

  return schema;
}
