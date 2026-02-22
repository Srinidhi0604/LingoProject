import { Component, ComponentType, DEFAULT_PROPS } from "@/types/intent";
import { FileNode, DirectoryNode, isFile, isDirectory, createFile, createDirectory } from "@/types/filesystem";
import {
  FileOperation,
  ComponentInfo,
  PageInfo,
  ApplicationGraph,
  OrchestratorResult,
  ComponentTemplate,
  PageTemplate,
} from "@/types/orchestrator";

function stripExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|ts|jsx|js)$/, "");
}

function dirname(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function joinPath(...parts: string[]): string {
  return parts
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.replace(/^\/+/, "").replace(/\/+$/, ""))
    .filter((p) => p.length > 0)
    .join("/");
}

function toImportPath(fromFile: string, toFile: string): string {
  const fromDir = dirname(fromFile);
  const fromParts = fromDir.split("/").filter(Boolean);
  const toParts = stripExtension(toFile).split("/").filter(Boolean);

  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  const upCount = fromParts.length - common;
  const downParts = toParts.slice(common);
  const downPath = downParts.join("/");

  const upPath = upCount === 0 ? "./" : "../".repeat(upCount);
  const rel = upPath + downPath;
  return rel.startsWith("./") || rel.startsWith("../") ? rel : `./${rel}`;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function sanitizeComponentName(name: string): string {
  let sanitized = name
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase());
  
  if (!sanitized || !/^[A-Z]/.test(sanitized)) {
    sanitized = "Component" + generateId().replace(/_/g, "");
  }
  
  return sanitized;
}

function findNodeByPath(node: FileNode | DirectoryNode, path: string): FileNode | DirectoryNode | null {
  if (node.path === path) return node;
  if (isDirectory(node)) {
    for (const child of node.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }
  return null;
}

export function detectAppRoot(root: DirectoryNode): string {
  const hasApp = findNodeByPath(root, "app/page.tsx");
  if (hasApp && isFile(hasApp)) return "app";

  const hasSrcApp = findNodeByPath(root, "src/app/page.tsx");
  if (hasSrcApp && isFile(hasSrcApp)) return "src/app";

  // Some imported projects (or flattened virtual FS) may have App Router files at repo root.
  const rootPage = findNodeByPath(root, "page.tsx");
  if (rootPage && isFile(rootPage)) return "";

  // Fallback: if either directory exists, prefer it.
  const appDir = findNodeByPath(root, "app");
  if (appDir && isDirectory(appDir)) return "app";
  const srcAppDir = findNodeByPath(root, "src/app");
  if (srcAppDir && isDirectory(srcAppDir)) return "src/app";

  return "app";
}

function findParentDirectory(root: DirectoryNode, path: string): DirectoryNode | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  segments.pop();
  if (segments.length === 0) return root;
  
  const parentPath = segments.join("/");
  const found = findNodeByPath(root, parentPath);
  return found && isDirectory(found) ? found : null;
}

function cloneNode(node: FileNode | DirectoryNode): FileNode | DirectoryNode {
  if (isFile(node)) {
    return { ...node };
  }
  return {
    ...node,
    children: node.children.map(cloneNode) as (FileNode | DirectoryNode)[],
  };
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function extractExports(content: string): { named: string[]; hasDefault: boolean } {
  const named: string[] = [];
  let hasDefault = false;

  const defaultExportRegex = /export\s+default\s+/;
  hasDefault = defaultExportRegex.test(content);

  const namedExportRegex = /export\s+(?:const|function|class|let|var)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    named.push(match[1]);
  }

  return { named, hasDefault };
}

function scanForComponents(root: DirectoryNode): ComponentInfo[] {
  const components: ComponentInfo[] = [];

  const scan = (node: FileNode | DirectoryNode) => {
    if (isFile(node) && (node.path.includes("components/") || node.path.includes("app/"))) {
      const name = node.name.replace(/\.(tsx|ts|jsx|js)$/, "");
      const exports = extractExports(node.content);
      
      if (exports.hasDefault || exports.named.length > 0) {
        components.push({
          name,
          path: node.path,
          exports: exports.named,
          imports: extractImports(node.content),
          hasDefault: exports.hasDefault,
        });
      }
    } else if (isDirectory(node)) {
      node.children.forEach(scan);
    }
  };

  scan(root);
  return components;
}

function scanForPages(root: DirectoryNode, appRoot: string): PageInfo[] {
  const pages: PageInfo[] = [];

  const scan = (node: FileNode | DirectoryNode) => {
    if (isFile(node) && node.name === "page.tsx") {
      const prefix = appRoot.endsWith("/") ? appRoot : `${appRoot}/`;
      const route = node.path.startsWith(prefix)
        ? node.path.slice(prefix.length).replace(/\/page\.tsx$/, "") || "/"
        : node.path.replace(/\/page\.tsx$/, "") || "/";
      const components: string[] = [];
      
      const compRegex = /<([A-Z]\w*)/g;
      let match;
      while ((match = compRegex.exec(node.content)) !== null) {
        if (!components.includes(match[1])) {
          components.push(match[1]);
        }
      }

      pages.push({
        route,
        path: node.path,
        components,
        hasLayout: false,
      });
    } else if (isDirectory(node)) {
      const layoutExists = node.children.some(
        c => isFile(c) && c.name === "layout.tsx"
      );
      if (layoutExists && pages.length > 0) {
        pages[pages.length - 1].hasLayout = true;
      }
      node.children.forEach(scan);
    }
  };

  scan(root);
  return pages;
}

export function buildApplicationGraph(root: DirectoryNode): ApplicationGraph {
  const components = scanForComponents(root);
  const appRoot = detectAppRoot(root);
  const pages = scanForPages(root, appRoot);
  const routes = pages.map(p => p.route);
  
  const imports = new Map<string, string[]>();
  
  const allFiles: FileNode[] = [];
  const collectFiles = (node: FileNode | DirectoryNode) => {
    if (isFile(node)) {
      allFiles.push(node);
    } else if (isDirectory(node)) {
      node.children.forEach(collectFiles);
    }
  };
  collectFiles(root);
  
  allFiles.forEach(file => {
    imports.set(file.path, extractImports(file.content));
  });

  return { pages, components, routes, imports };
}

function generateComponentCode(template: ComponentTemplate): string {
  const { name, type, props, imports = [], hasChildren = false } = template;
  const componentName = sanitizeComponentName(name);
  const displayText = props.text || name;
  const propsEntries = Object.entries(props).filter(([k]) => k !== "text");
  const propsString = propsEntries.length > 0 
    ? propsEntries.map(([k, v]) => {
        if (typeof v === "string") return `${k}="${v}"`;
        if (typeof v === "number") return `${k}={${v}}`;
        if (typeof v === "boolean") return v ? k : "";
        return `${k}={${JSON.stringify(v)}}`;
      }).join(" ")
    : "";

  const normalizedImports = imports
    .map((stmt) => stmt.trim())
    .filter(Boolean)
    .map((stmt) => (stmt.endsWith(";") ? stmt : `${stmt};`));

  const requiredTypeImports: string[] = [];
  requiredTypeImports.push('import type { ReactNode } from "react";');

  const needsLink = type === "link" || type === "nav";
  if (needsLink && !normalizedImports.some((s) => s.includes("next/link"))) {
    normalizedImports.unshift('import Link from "next/link";');
  }

  // Ensure type-only imports are present (dedupe by exact string)
  const allImports = [...new Set([...requiredTypeImports, ...normalizedImports])];
  const importBlock = allImports.length > 0 ? `${allImports.join("\n")}\n\n` : "";

  const defaultProps = DEFAULT_PROPS[type as ComponentType] || {};
  const className = (props.className as string) || defaultProps.className || "";

  const classExpr = className
    ? `const combinedClassName = [${JSON.stringify(className)}, className].filter(Boolean).join(" ");`
    : `const combinedClassName = className || "";`;

  let elementCode = "";
  switch (type) {
    case "button":
      elementCode = `<button className={combinedClassName}>${displayText}</button>`;
      break;
    case "input":
      elementCode = `<input className={combinedClassName} placeholder={${JSON.stringify(String(props.placeholder || "Enter text"))}} />`;
      break;
    case "heading":
      const level = props.level || 1;
      elementCode = `<h${level} className={combinedClassName}>${displayText}</h${level}>`;
      break;
    case "link":
      elementCode = `<Link href={${JSON.stringify(String(props.href || "#"))}} className={combinedClassName}>${displayText}</Link>`;
      break;
    case "nav":
      elementCode = `<nav className={combinedClassName}>\n      {children}\n    </nav>`;
      break;
    case "container":
    case "card":
      elementCode = `<div className={combinedClassName}>\n      {children}\n    </div>`;
      break;
    default:
      elementCode = `<div className={combinedClassName}>${displayText}</div>`;
  }

  return `${importBlock}interface ${componentName}Props {
  className?: string;
  children?: ReactNode;
}

export default function ${componentName}({ className, children }: ${componentName}Props) {
  ${classExpr}

  return (
    ${elementCode}
  );
}
`;
}

function generatePageCode(template: PageTemplate): string {
  const { route, title, components = [], imports = [] } = template;

  const standardImports = imports.length > 0 ? imports.join("\n") : "";

  const componentsJsx = components.length > 0
    ? components.map(c => {
        const componentName = sanitizeComponentName(c.name);
        if (c.type === "div" || c.type === "text") {
          return `<div>${c.props.text || ""}</div>`;
        }
        return `<${componentName} />`;
      }).join("\n      ")
    : "<p>Welcome to this page</p>";

  return `${standardImports}

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-8">${title || route}</h1>
      ${componentsJsx}
    </main>
  );
}
`;
}

function insertImport(content: string, importStatement: string): string {
  const existingImports = extractImports(content);
  const importPath = importStatement.match(/from\s+['"]([^'"]+)['"]/)?.[1];
  
  if (importPath && existingImports.includes(importPath)) {
    return content;
  }

  const firstImportIndex = content.indexOf("import ");
  if (firstImportIndex === -1) {
    return `${importStatement}\n${content}`;
  }

  const lastImportEnd = content.lastIndexOf(";");
  const nextLineIndex = content.indexOf("\n", lastImportEnd);
  
  return content.slice(0, nextLineIndex + 1) + importStatement + "\n" + content.slice(nextLineIndex + 1);
}

function insertComponentIntoJsx(
  content: string,
  componentName: string,
  targetElement: string = "main"
): string {
  const componentJsx = `<${componentName} />`;
  
  const targetRegex = new RegExp(`(<${targetElement}[^>]*>)`, "i");
  const match = content.match(targetRegex);
  
  if (!match) {
    const returnMatch = content.match(/return\s*\(\s*\n?/);
    if (returnMatch) {
      const insertIndex = returnMatch.index! + returnMatch[0].length;
      return content.slice(0, insertIndex) + 
             `      ${componentJsx}\n    ` + 
             content.slice(insertIndex);
    }
    return content + `\n${componentJsx}`;
  }

  const insertIndex = match.index! + match[0].length;
  return content.slice(0, insertIndex) + 
         `\n      ${componentJsx}` + 
         content.slice(insertIndex);
}

export class WorkspaceOrchestrator {
  private root: DirectoryNode;
  private operations: FileOperation[] = [];
  private graph: ApplicationGraph | null = null;
  private appRoot: string;

  constructor(root: DirectoryNode, appRoot?: string) {
    this.root = cloneNode(root) as DirectoryNode;
    this.appRoot = appRoot || detectAppRoot(root);
  }

  scan(): ApplicationGraph {
    if (!this.graph) {
      this.graph = buildApplicationGraph(this.root);
    }
    return this.graph;
  }

  createFile(path: string, content: string): boolean {
    const dirPath = path.split("/").slice(0, -1).join("/");
    
    if (dirPath) {
      this.ensureDirectory(dirPath);
    }

    const parent = findParentDirectory(this.root, path);
    if (!parent) return false;

    const existingIndex = parent.children.findIndex(c => c.path === path);
    const newFile = createFile(path, content);

    if (existingIndex >= 0) {
      parent.children[existingIndex] = newFile;
    } else {
      parent.children.push(newFile);
    }

    this.operations.push({ type: "createFile", path, content });
    this.graph = null;
    return true;
  }

  modifyFile(path: string, transform: (content: string) => string): boolean {
    const node = findNodeByPath(this.root, path);
    if (!node || !isFile(node)) return false;

    const newContent = transform(node.content);
    node.content = newContent;
    node.lastModified = Date.now();

    this.operations.push({ type: "modifyFile", path, transform });
    this.graph = null;
    return true;
  }

  deleteFile(path: string): boolean {
    const parent = findParentDirectory(this.root, path);
    if (!parent) return false;

    const index = parent.children.findIndex(c => c.path === path);
    if (index < 0) return false;

    parent.children.splice(index, 1);
    parent.lastModified = Date.now();

    this.operations.push({ type: "deleteFile", path });
    this.graph = null;
    return true;
  }

  ensureDirectory(dirPath: string): boolean {
    const segments = dirPath.split("/").filter(Boolean);
    if (segments.length === 0) return true;

    let current = this.root;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const currentPath = segments.slice(0, i + 1).join("/");
      
      let child = current.children.find(
        c => c.name === segment && isDirectory(c)
      );

      if (!child) {
        const newDir = createDirectory(currentPath);
        current.children.push(newDir);
        child = newDir;
      }

      if (isDirectory(child)) {
        current = child;
      } else {
        return false;
      }
    }

    this.operations.push({ type: "createDirectory", path: dirPath });
    return true;
  }

  ensureRoute(route: string): string {
    const routePath = route.startsWith("/") ? route.slice(1) : route;
    const pagePath = routePath
      ? joinPath(this.appRoot, routePath, "page.tsx")
      : joinPath(this.appRoot, "page.tsx");
    
    const existing = findNodeByPath(this.root, pagePath);
    if (existing && isFile(existing)) {
      return pagePath;
    }

    const pageTemplate: PageTemplate = {
      route: `/${routePath}`,
      title: routePath.charAt(0).toUpperCase() + routePath.slice(1) || "Home",
      components: [],
    };

    const content = generatePageCode(pageTemplate);
    this.createFile(pagePath, content);
    
    this.operations.push({ type: "ensureRoute", path: pagePath });
    return pagePath;
  }

  createComponent(template: ComponentTemplate): string {
    const componentName = sanitizeComponentName(template.name);
    const componentPath = joinPath(this.appRoot, "components", `${componentName}.tsx`);
    
    this.ensureDirectory(joinPath(this.appRoot, "components"));

    const needsLink = template.type === "link" || template.type === "nav";
    const imports = needsLink ? ['import Link from "next/link"'] : [];

    const content = generateComponentCode({
      ...template,
      imports: [...imports, ...(template.imports || [])],
    });

    this.createFile(componentPath, content);
    this.operations.push({ 
      type: "createFile", 
      path: componentPath, 
      content,
      componentName,
    });

    return componentPath;
  }

  registerComponent(componentPath: string, targetPage?: string): boolean {
    const effectiveTargetPage = targetPage || joinPath(this.appRoot, "page.tsx");
    const componentNode = findNodeByPath(this.root, componentPath);
    if (!componentNode || !isFile(componentNode)) return false;

    const componentName = componentPath.split("/").pop()?.replace(/\.(tsx|ts)$/, "") || "";
    if (!componentName) return false;

    const exports = extractExports(componentNode.content);
    if (!exports.hasDefault && exports.named.length === 0) return false;

    const importPath = toImportPath(effectiveTargetPage, componentPath);
    const importStatement = `import ${componentName} from "${importPath}";`;

    const modified = this.modifyFile(effectiveTargetPage, (content) => {
      let newContent = insertImport(content, importStatement);
      newContent = insertComponentIntoJsx(newContent, componentName);
      return newContent;
    });

    if (!modified) return false;

    this.operations.push({
      type: "registerComponent",
      path: componentPath,
      componentName,
      componentPath,
    });

    return true;
  }

  insertComponentIntoPage(
    componentName: string,
    pagePath: string = "app/page.tsx",
    targetElement: string = "main"
  ): boolean {
    const effectivePagePath = pagePath === "app/page.tsx" ? joinPath(this.appRoot, "page.tsx") : pagePath;
    const pageNode = findNodeByPath(this.root, effectivePagePath);
    if (!pageNode || !isFile(pageNode)) return false;

    const componentPath = joinPath(this.appRoot, "components", `${componentName}.tsx`);
    const componentNode = findNodeByPath(this.root, componentPath);
    
    if (!componentNode || !isFile(componentNode)) {
      return false;
    }

    const importPath = toImportPath(effectivePagePath, componentPath);
    const importStatement = `import ${componentName} from "${importPath}";`;

    this.modifyFile(effectivePagePath, (content) => {
      let newContent = insertImport(content, importStatement);
      newContent = insertComponentIntoJsx(newContent, componentName, targetElement);
      return newContent;
    });

    this.operations.push({
      type: "insertComponent",
      path: pagePath,
      componentName,
      targetElement,
    });

    return true;
  }

  createPageWithComponents(
    route: string,
    components: ComponentTemplate[],
    title?: string
  ): string {
    const pagePath = this.ensureRoute(route);
    
    for (const compTemplate of components) {
      const compPath = this.createComponent(compTemplate);
      this.registerComponent(compPath, pagePath);
    }

    if (title) {
      this.modifyFile(pagePath, (content) => {
        return content.replace(
          /<h1[^>]*>.*?<\/h1>/,
          `<h1 className="text-3xl font-bold mb-8">${title}</h1>`
        );
      });
    }

    return pagePath;
  }

  addNavigationToPage(
    pagePath: string,
    links: { label: string; href: string }[]
  ): boolean {
    const navImports = `import Link from "next/link";`;
    
    const linksJsx = links.map(
      link => `<Link href="${link.href}" className="px-4 py-2 hover:text-blue-400">${link.label}</Link>`
    ).join("\n      ");

    const navJsx = `<nav className="flex items-center gap-4 bg-zinc-900 text-white p-4">
      ${linksJsx}
    </nav>`;

    this.modifyFile(pagePath, (content) => {
      let newContent = insertImport(content, navImports);
      
      const mainMatch = newContent.match(/(<main[^>]*>)/);
      if (mainMatch) {
        const insertIndex = mainMatch.index! + mainMatch[0].length;
        newContent = newContent.slice(0, insertIndex) + 
                    "\n      " + navJsx + 
                    newContent.slice(insertIndex);
      }

      return newContent;
    });

    return true;
  }

  getRoot(): DirectoryNode {
    return this.root;
  }

  getOperations(): FileOperation[] {
    return [...this.operations];
  }

  getFileContent(path: string): string | null {
    const node = findNodeByPath(this.root, path);
    return node && isFile(node) ? node.content : null;
  }

  hasFile(path: string): boolean {
    const node = findNodeByPath(this.root, path);
    return node !== null && isFile(node);
  }

  hasRoute(route: string): boolean {
    const graph = this.scan();
    return graph.routes.includes(route);
  }

  getComponentNames(): string[] {
    const graph = this.scan();
    return graph.components.map(c => c.name);
  }

  getPageRoutes(): string[] {
    const graph = this.scan();
    return graph.pages.map(p => p.route);
  }
}

export function createOrchestrator(root: DirectoryNode): WorkspaceOrchestrator {
  return new WorkspaceOrchestrator(root, detectAppRoot(root));
}
