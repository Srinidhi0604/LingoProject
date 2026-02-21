export type OperationType = 
  | "createFile"
  | "modifyFile"
  | "deleteFile"
  | "createDirectory"
  | "insertImport"
  | "insertComponent"
  | "ensureRoute"
  | "registerComponent";

export interface FileOperation {
  type: OperationType;
  path: string;
  content?: string;
  transform?: (content: string) => string;
  componentName?: string;
  componentPath?: string;
  importStatement?: string;
  jsxInsertion?: string;
  targetElement?: string;
}

export interface ComponentInfo {
  name: string;
  path: string;
  exports: string[];
  imports: string[];
  hasDefault: boolean;
}

export interface PageInfo {
  route: string;
  path: string;
  components: string[];
  hasLayout: boolean;
}

export interface ApplicationGraph {
  pages: PageInfo[];
  components: ComponentInfo[];
  routes: string[];
  imports: Map<string, string[]>;
}

export interface OrchestratorResult {
  success: boolean;
  message: string;
  affectedFiles: string[];
  operations: FileOperation[];
  graph?: ApplicationGraph;
}

export interface ComponentTemplate {
  name: string;
  type: string;
  props: Record<string, unknown>;
  imports?: string[];
  hasChildren?: boolean;
}

export interface PageTemplate {
  route: string;
  title?: string;
  components?: ComponentTemplate[];
  imports?: string[];
}
