import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { Component, ComponentType, ComponentProps, VALID_COMPONENT_TYPES, COMPONENT_ALIASES } from "@/types/intent";

export interface ImportResult {
  success: boolean;
  components: Component[];
  errors: string[];
  warnings: string[];
}

function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function normalizeComponentType(tagName: string): ComponentType {
  const lowerTag = tagName.toLowerCase();
  
  if (COMPONENT_ALIASES[lowerTag]) {
    return COMPONENT_ALIASES[lowerTag];
  }
  
  if (VALID_COMPONENT_TYPES.includes(lowerTag as ComponentType)) {
    return lowerTag as ComponentType;
  }
  
  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(lowerTag)) {
    return "heading";
  }
  
  if (["p"].includes(lowerTag)) {
    return "paragraph";
  }
  
  if (["ul", "ol"].includes(lowerTag)) {
    return "list";
  }
  
  if (["li"].includes(lowerTag)) {
    return "listItem";
  }
  
  if (["a"].includes(lowerTag)) {
    return "link";
  }
  
  if (["img"].includes(lowerTag)) {
    return "image";
  }
  
  return "div";
}

function extractTextContent(node: t.JSXElement): string {
  let text = "";
  
  traverse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { type: "File", program: { type: "Program", body: [], sourceType: "module" } } as any,
    {
      JSXText(path) {
        text += path.node.value.trim();
      },
      StringLiteral(path) {
        if (path.parent.type === "JSXAttribute") {
          return;
        }
        text += path.node.value;
      },
    },
    undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { node } as any
  );
  
  return text.trim();
}

function parseJsxAttributes(attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]): ComponentProps {
  const props: ComponentProps = {};
  
  for (const attr of attributes) {
    if (attr.type !== "JSXAttribute") continue;
    
    const name = attr.name.type === "JSXIdentifier" ? attr.name.name : "";
    if (!name) continue;
    
    if (attr.value === null) {
      props[name] = true;
      continue;
    }
    
    if (attr.value.type === "StringLiteral") {
      props[name] = attr.value.value;
      continue;
    }
    
    if (attr.value.type === "JSXExpressionContainer") {
      const expr = attr.value.expression;
      
      if (expr.type === "StringLiteral") {
        props[name] = expr.value;
      } else if (expr.type === "NumericLiteral") {
        props[name] = expr.value;
      } else if (expr.type === "BooleanLiteral") {
        props[name] = expr.value;
      } else if (expr.type === "ObjectExpression") {
        try {
          const obj: Record<string, unknown> = {};
          expr.properties.forEach((prop) => {
            if (prop.type === "ObjectProperty" && prop.key.type === "Identifier") {
              if (prop.value.type === "StringLiteral") {
                obj[prop.key.name] = prop.value.value;
              } else if (prop.value.type === "NumericLiteral") {
                obj[prop.key.name] = prop.value.value;
              } else if (prop.value.type === "BooleanLiteral") {
                obj[prop.key.name] = prop.value.value;
              }
            }
          });
          props[name] = obj;
        } catch {
          // Skip complex expressions
        }
      }
    }
  }
  
  return props;
}

function parseJsxElement(node: t.JSXElement, warnings: string[]): Component | null {
  const openingElement = node.openingElement;
  
  let tagName = "";
  if (openingElement.name.type === "JSXIdentifier") {
    tagName = openingElement.name.name;
  } else if (openingElement.name.type === "JSXMemberExpression") {
    warnings.push(`Skipping member expression component: ${openingElement.name.type}`);
    return null;
  }
  
  const lowerTag = tagName.toLowerCase();
  
  if (
    lowerTag === "html" ||
    lowerTag === "head" ||
    lowerTag === "body" ||
    lowerTag === "script" ||
    lowerTag === "style" ||
    lowerTag === "link" ||
    lowerTag === "meta"
  ) {
    return null;
  }
  
  const componentType = normalizeComponentType(tagName);
  const props = parseJsxAttributes(openingElement.attributes);
  
  const children: Component[] = [];
  let textContent = "";
  
  for (const child of node.children) {
    if (child.type === "JSXText") {
      const trimmed = child.value.trim();
      if (trimmed) {
        textContent += (textContent ? " " : "") + trimmed;
      }
    } else if (child.type === "JSXElement") {
      const childComponent = parseJsxElement(child, warnings);
      if (childComponent) {
        children.push(childComponent);
      }
    } else if (child.type === "JSXExpressionContainer") {
      if (child.expression.type === "StringLiteral") {
        textContent += (textContent ? " " : "") + child.expression.value;
      } else if (child.expression.type === "TemplateLiteral") {
        const quasis = child.expression.quasis.map((q) => q.value.raw).join("");
        if (quasis.trim()) {
          textContent += (textContent ? " " : "") + quasis.trim();
        }
      }
    }
  }
  
  if (componentType === "heading" && props.level === undefined) {
    const level = parseInt(tagName.charAt(1), 10);
    if (level >= 1 && level <= 6) {
      props.level = level as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }
  
  if (textContent && !props.text) {
    props.text = textContent;
  }
  
  const component: Component = {
    id: generateId(),
    type: componentType,
    props,
    children,
  };
  
  return component;
}

function extractComponentsFromJsx(code: string): { components: Component[]; warnings: string[] } {
  const components: Component[] = [];
  const warnings: string[] = [];
  
  try {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    
    traverse(ast, {
      JSXElement(path) {
        const parent = path.parent;
        
        if (
          parent.type === "ReturnStatement" ||
          parent.type === "VariableDeclarator" ||
          parent.type === "ArrowFunctionExpression" ||
          parent.type === "FunctionDeclaration"
        ) {
          const component = parseJsxElement(path.node, warnings);
          if (component) {
            const isTopLevel =
              parent.type === "ReturnStatement" &&
              path.parentPath?.parent?.type === "BlockStatement";
            
            if (isTopLevel || components.length === 0) {
              components.push(component);
            }
          }
        }
      },
    });
  } catch (error) {
    warnings.push(`Parse error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  
  return { components, warnings };
}

export function parsePageFile(content: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const { components, warnings: parseWarnings } = extractComponentsFromJsx(content);
  warnings.push(...parseWarnings);
  
  if (components.length === 0) {
    warnings.push("No components found in page file");
  }
  
  return {
    success: components.length > 0,
    components,
    errors,
    warnings,
  };
}

export function parseProjectFiles(files: { path: string; content: string }[]): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allComponents: Component[] = [];
  
  const pageFile = files.find(
    (f) =>
      f.path === "app/page.tsx" ||
      f.path === "src/app/page.tsx" ||
      f.path.endsWith("/page.tsx") ||
      f.path === "page.tsx"
  );
  
  if (!pageFile) {
    errors.push("No page.tsx file found in project");
    return { success: false, components: [], errors, warnings };
  }
  
  const result = parsePageFile(pageFile.content);
  
  return {
    success: result.success,
    components: result.components,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export function validateImportedComponents(components: Component[]): {
  valid: Component[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const valid: Component[] = [];
  
  for (const component of components) {
    if (!component.type) {
      warnings.push(`Component missing type, defaulting to div`);
      component.type = "div";
    }
    
    if (!component.props) {
      component.props = {};
    }
    
    if (!component.id) {
      component.id = generateId();
    }
    
    if (component.children && component.children.length > 0) {
      const { valid: validChildren, warnings: childWarnings } = validateImportedComponents(
        component.children
      );
      component.children = validChildren;
      warnings.push(...childWarnings);
    }
    
    valid.push(component);
  }
  
  return { valid, warnings };
}
