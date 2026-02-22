import type { HistoryState } from "@/builder/history";
import { schemaToPageTsx } from "@/builder/jsxSync";
import type { FileNode } from "@/types/filesystem";

export type WorkspaceFileApi = {
  updateFile: (path: string, content: string) => void;
};

export type FindFileByPath = (path: string) => FileNode | null;

export type SyncEngine = {
  syncEntryPage: (args: {
    history: HistoryState;
    pagePath: string;
    findFileByPath: FindFileByPath;
    workspace: WorkspaceFileApi;
  }) => void;
};

export const FullRewriteSyncEngine: SyncEngine = {
  syncEntryPage({ history, pagePath, findFileByPath, workspace }) {
    const nextCode = schemaToPageTsx(history.present);
    const existing = findFileByPath(pagePath);
    const existingCode = existing?.content || "";
    if (existingCode === nextCode) return;
    workspace.updateFile(pagePath, nextCode);
  },
};
