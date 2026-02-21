export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  type: "created" | "modified" | "deleted";
}

export interface AgentOperation {
  id: string;
  timestamp: number;
  instruction: string;
  explanation: string;
  filesChanged: FileChange[];
  status: "pending" | "processing" | "completed" | "failed";
  transcript?: string;
  detectedLanguage?: string;
}

export interface AgentState {
  operations: AgentOperation[];
  currentOperation: AgentOperation | null;
  isProcessing: boolean;
  lastInstruction: string;
}

let operationCounter = 0;

export function createOperation(
  instruction: string,
  transcript?: string,
  detectedLanguage?: string
): AgentOperation {
  operationCounter++;
  return {
    id: `op_${Date.now()}_${operationCounter}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    instruction,
    explanation: "",
    filesChanged: [],
    status: "pending",
    transcript,
    detectedLanguage,
  };
}

export function updateOperationStatus(
  operation: AgentOperation,
  status: AgentOperation["status"],
  explanation?: string
): AgentOperation {
  return {
    ...operation,
    status,
    explanation: explanation || operation.explanation,
  };
}

export function addFileChange(
  operation: AgentOperation,
  change: FileChange
): AgentOperation {
  return {
    ...operation,
    filesChanged: [...operation.filesChanged, change],
  };
}

export function calculateTotalChanges(files: FileChange[]): { additions: number; deletions: number } {
  return files.reduce(
    (acc, file) => ({
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 }
  );
}
