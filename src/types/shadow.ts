export type ShadowFileStatus = 
  | "pending"
  | "validated"
  | "committed"
  | "failed"
  | "discarded";

export interface ShadowFile {
  path: string;
  originalContent: string;
  shadowContent: string;
  status: ShadowFileStatus;
  lastModified: number;
  validationErrors: string[];
}

export interface ShadowWorkspaceState {
  files: Map<string, ShadowFile>;
  initialized: boolean;
  projectRoot: string;
  lastCommitTime: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CommitResult {
  success: boolean;
  committedFiles: string[];
  failedFiles: string[];
  errors: Record<string, string>;
}

export interface ShadowOperation {
  type: "create" | "update" | "delete";
  path: string;
  content?: string;
  timestamp: number;
}
