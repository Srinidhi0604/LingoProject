import { ProjectFileSystem, DirectoryNode, FileNode, isFile, isDirectory } from "@/types/filesystem";
import { ShadowFile, ShadowFileStatus, ValidationResult, CommitResult } from "@/types/shadow";

const SAFE_EDITABLE_PATHS = [
  "app/",
  "src/app/",
  "src/components/",
  "components/",
  "config/",
  "styles/",
  "src/styles/",
  "lib/",
  "src/lib/",
  "utils/",
  "src/utils/",
];

const EXCLUDED_PATHS = [
  "node_modules/",
  ".next/",
  ".git/",
  ".voxera/",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

function isPathEditable(path: string): boolean {
  if (EXCLUDED_PATHS.some(excluded => path.startsWith(excluded))) {
    return false;
  }
  return SAFE_EDITABLE_PATHS.some(safe => path.startsWith(safe)) || !path.includes("/");
}

function validateTypeScriptSyntax(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    return { valid: false, errors: ["File is empty"], warnings: [] };
  }

  let openBraces = 0;
  let closeBraces = 0;
  let openParens = 0;
  let closeParens = 0;
  let openBrackets = 0;
  let closeBrackets = 0;

  // Lightweight syntax scan to avoid false positives from naive regex.
  // Counts brackets only outside of strings/comments and detects unclosed strings.
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = i + 1 < content.length ? content[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingleQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplateQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "`") {
        inTemplateQuote = false;
      }
      continue;
    }

    // Not in string/comment: detect comment starts.
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    // Not in string/comment: detect string starts.
    if (ch === "'") {
      inSingleQuote = true;
      continue;
    }
    if (ch === "\"") {
      inDoubleQuote = true;
      continue;
    }
    if (ch === "`") {
      inTemplateQuote = true;
      continue;
    }

    // Count brackets outside strings/comments.
    if (ch === "{") openBraces++;
    else if (ch === "}") closeBraces++;
    else if (ch === "(") openParens++;
    else if (ch === ")") closeParens++;
    else if (ch === "[") openBrackets++;
    else if (ch === "]") closeBrackets++;
  }

  if (openBraces !== closeBraces) {
    errors.push(`Unbalanced braces: { ${openBraces} vs } ${closeBraces}`);
  }
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses: ( ${openParens} vs ) ${closeParens}`);
  }
  if (openBrackets !== closeBrackets) {
    errors.push(`Unbalanced brackets: [ ${openBrackets} vs ] ${closeBrackets}`);
  }

  if (inSingleQuote || inDoubleQuote || inTemplateQuote) {
    errors.push("Possible unclosed string literal");
  }

  if (inBlockComment) {
    errors.push("Possible unclosed block comment");
  }

  if (content.includes("import ") && !content.includes("from")) {
    warnings.push("Import statement may be incomplete");
  }

  if (content.includes("export ") && !content.includes("function") && 
      !content.includes("const") && !content.includes("class") &&
      !content.includes("interface") && !content.includes("type") &&
      !content.includes("{")) {
    warnings.push("Export statement may be incomplete");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateCSSSyntax(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    return { valid: false, errors: ["File is empty"], warnings: [] };
  }

  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push(`Unbalanced braces in CSS: { ${openBraces} vs } ${closeBraces}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateJSONSyntax(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    return { valid: false, errors: ["File is empty"], warnings: [] };
  }

  try {
    JSON.parse(content);
  } catch (e) {
    errors.push(`Invalid JSON: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateFile(path: string, content: string): ValidationResult {
  if (!isPathEditable(path)) {
    return { valid: false, errors: [`Path "${path}" is not editable`], warnings: [] };
  }

  if (path.endsWith(".tsx") || path.endsWith(".ts") || path.endsWith(".jsx") || path.endsWith(".js")) {
    return validateTypeScriptSyntax(content);
  }

  if (path.endsWith(".css")) {
    return validateCSSSyntax(content);
  }

  if (path.endsWith(".json")) {
    return validateJSONSyntax(content);
  }

  return { valid: true, errors: [], warnings: [] };
}

class ShadowWorkspaceManager {
  private shadowFiles: Map<string, ShadowFile> = new Map();
  private originalFiles: Map<string, string> = new Map();
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  initializeFromFilesystem(fs: ProjectFileSystem): void {
    this.shadowFiles.clear();
    this.originalFiles.clear();
    this.collectOriginalFiles(fs.root);
  }

  private collectOriginalFiles(node: FileNode | DirectoryNode): void {
    if (isFile(node)) {
      if (isPathEditable(node.path)) {
        this.originalFiles.set(node.path, node.content);
      }
    } else if (isDirectory(node)) {
      node.children.forEach(child => this.collectOriginalFiles(child));
    }
  }

  createShadowCopy(path: string, originalContent: string): ShadowFile {
    const existing = this.shadowFiles.get(path);
    if (existing) {
      return existing;
    }

    const shadowFile: ShadowFile = {
      path,
      originalContent,
      shadowContent: originalContent,
      status: "pending",
      lastModified: Date.now(),
      validationErrors: [],
    };

    this.shadowFiles.set(path, shadowFile);
    this.notify();
    return shadowFile;
  }

  readShadowFile(path: string): string | null {
    const shadow = this.shadowFiles.get(path);
    if (shadow) {
      return shadow.shadowContent;
    }
    return this.originalFiles.get(path) || null;
  }

  writeShadowFile(path: string, content: string): ShadowFile {
    const existing = this.shadowFiles.get(path);
    const originalContent = existing?.originalContent || this.originalFiles.get(path) || "";

    const shadowFile: ShadowFile = {
      path,
      originalContent,
      shadowContent: content,
      status: "pending",
      lastModified: Date.now(),
      validationErrors: [],
    };

    const validation = validateFile(path, content);
    if (!validation.valid) {
      shadowFile.status = "failed";
      shadowFile.validationErrors = validation.errors;
    } else {
      shadowFile.status = "validated";
    }

    this.shadowFiles.set(path, shadowFile);
    this.notify();
    return shadowFile;
  }

  validateShadowFile(path: string): ValidationResult {
    const shadow = this.shadowFiles.get(path);
    if (!shadow) {
      return { valid: false, errors: ["File not in shadow workspace"], warnings: [] };
    }
    return validateFile(path, shadow.shadowContent);
  }

  commitShadowFile(path: string): { success: boolean; error?: string } {
    const shadow = this.shadowFiles.get(path);
    if (!shadow) {
      return { success: false, error: "File not in shadow workspace" };
    }

    if (shadow.status === "failed") {
      return { success: false, error: "File has validation errors" };
    }

    const validation = this.validateShadowFile(path);
    if (!validation.valid) {
      shadow.status = "failed";
      shadow.validationErrors = validation.errors;
      this.notify();
      return { success: false, error: validation.errors.join(", ") };
    }

    shadow.status = "committed";
    this.originalFiles.set(path, shadow.shadowContent);
    this.notify();
    return { success: true };
  }

  discardShadowFile(path: string): void {
    const shadow = this.shadowFiles.get(path);
    if (shadow) {
      shadow.shadowContent = shadow.originalContent;
      shadow.status = "discarded";
      shadow.validationErrors = [];
      this.notify();
    }
  }

  deleteShadowFile(path: string): void {
    this.shadowFiles.delete(path);
    this.notify();
  }

  getShadowFile(path: string): ShadowFile | undefined {
    return this.shadowFiles.get(path);
  }

  getAllShadowFiles(): ShadowFile[] {
    return Array.from(this.shadowFiles.values());
  }

  getPendingFiles(): ShadowFile[] {
    return this.getAllShadowFiles().filter(f => f.status === "pending" || f.status === "validated");
  }

  getModifiedFiles(): ShadowFile[] {
    return this.getAllShadowFiles().filter(f => f.shadowContent !== f.originalContent);
  }

  commitAllShadowChanges(): CommitResult {
    const result: CommitResult = {
      success: true,
      committedFiles: [],
      failedFiles: [],
      errors: {},
    };

    const pendingFiles = this.getPendingFiles();

    for (const shadow of pendingFiles) {
      const commitResult = this.commitShadowFile(shadow.path);
      if (commitResult.success) {
        result.committedFiles.push(shadow.path);
      } else {
        result.failedFiles.push(shadow.path);
        result.errors[shadow.path] = commitResult.error || "Unknown error";
        result.success = false;
      }
    }

    return result;
  }

  rollbackAllShadowChanges(): void {
    for (const [path, shadow] of this.shadowFiles) {
      shadow.shadowContent = shadow.originalContent;
      shadow.status = "discarded";
      shadow.validationErrors = [];
    }
    this.notify();
  }

  getShadowStatus(): {
    totalFiles: number;
    pendingFiles: number;
    validatedFiles: number;
    failedFiles: number;
    committedFiles: number;
  } {
    const files = this.getAllShadowFiles();
    return {
      totalFiles: files.length,
      pendingFiles: files.filter(f => f.status === "pending").length,
      validatedFiles: files.filter(f => f.status === "validated").length,
      failedFiles: files.filter(f => f.status === "failed").length,
      committedFiles: files.filter(f => f.status === "committed").length,
    };
  }

  clearShadowWorkspace(): void {
    this.shadowFiles.clear();
    this.notify();
  }
}

export const shadowWorkspace = new ShadowWorkspaceManager();

export {
  isPathEditable,
  validateFile,
  validateTypeScriptSyntax,
  validateCSSSyntax,
  validateJSONSyntax,
};
