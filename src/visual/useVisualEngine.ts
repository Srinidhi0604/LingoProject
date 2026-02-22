"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HistoryState } from "@/builder/history";
import type { UISchema } from "@/builder/schema";
import { createEmptySchema } from "@/builder/schema";
import type { FileNode } from "@/types/filesystem";
import { BasicTsxParserLayer } from "@/visual/domParserLayer";
import { BasicSchemaManager } from "@/visual/schemaManager";
import { FullRewriteSyncEngine } from "@/visual/syncEngine";

export type UseVisualEngineArgs = {
  activeWorkspaceId: string | null;
  workbench: "builder" | "code";
  findFileByPath: (path: string) => FileNode | null;
  computeEntryPagePath: () => string;
  workspaceApi: { updateFile: (path: string, content: string) => void };
};

export type VisualEngine = {
  history: HistoryState;
  schemaRef: React.MutableRefObject<UISchema>;
  entryPagePathRef: React.MutableRefObject<string>;
  setHistory: React.Dispatch<React.SetStateAction<HistoryState>>;
  setHistoryForCanvas: React.Dispatch<React.SetStateAction<HistoryState>>;
  commitSchema: (nextSchema: UISchema, opts?: { pagePath?: string }) => void;
  initializeFromCode: (pagePath: string) => void;
};

export function useVisualEngine({
  activeWorkspaceId,
  workbench,
  findFileByPath,
  computeEntryPagePath,
  workspaceApi,
}: UseVisualEngineArgs): VisualEngine {
  const [history, setHistory] = useState<HistoryState>(() => BasicSchemaManager.create(createEmptySchema()));

  const schemaRef = useRef<UISchema>(history.present);
  const entryPagePathRef = useRef<string>("app/page.tsx");
  const pendingRef = useRef<{ persist: boolean; sync: boolean; pagePath: string | null }>({
    persist: false,
    sync: false,
    pagePath: null,
  });

  useEffect(() => {
    schemaRef.current = history.present;
  }, [history.present]);

  const persistSchema = useCallback(
    (schema: UISchema, pagePath: string) => {
      if (!activeWorkspaceId) return;
      try {
        localStorage.setItem(`voxera.schema.${activeWorkspaceId}.${pagePath}`, JSON.stringify(schema));
      } catch {
        // ignore
      }
    },
    [activeWorkspaceId]
  );

  const initializeFromCode = useCallback(
    (pagePath: string) => {
      entryPagePathRef.current = pagePath;
      if (activeWorkspaceId) {
        try {
          const raw = localStorage.getItem(`voxera.schema.${activeWorkspaceId}.${pagePath}`);
          if (raw) {
            const parsed = JSON.parse(raw) as UISchema;
            if (parsed?.root) {
              setHistory(BasicSchemaManager.create(parsed));
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      const nextSchema = BasicTsxParserLayer.parseWorkspacePageToSchema(pagePath, (p) => {
        const f = findFileByPath(p);
        if (!f) return null;
        return { path: f.path, content: f.content };
      });
      setHistory(BasicSchemaManager.create(nextSchema));
    },
    [activeWorkspaceId, findFileByPath]
  );

  useEffect(() => {
    entryPagePathRef.current = computeEntryPagePath();
  }, [computeEntryPagePath]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending.persist && !pending.sync) return;
    if (workbench !== "builder") {
      pendingRef.current = { persist: false, sync: false, pagePath: null };
      return;
    }

    const pagePath = pending.pagePath || entryPagePathRef.current || computeEntryPagePath();
    pendingRef.current = { persist: false, sync: false, pagePath: null };

    if (pending.persist) persistSchema(history.present, pagePath);
    if (pending.sync) {
      FullRewriteSyncEngine.syncEntryPage({
        history,
        pagePath,
        findFileByPath,
        workspace: workspaceApi,
      });
    }
  }, [computeEntryPagePath, findFileByPath, history, history.present, persistSchema, workbench, workspaceApi]);

  const commitSchema = useCallback(
    (nextSchema: UISchema, opts?: { pagePath?: string }) => {
      pendingRef.current = {
        persist: true,
        sync: true,
        pagePath: opts?.pagePath || entryPagePathRef.current,
      };
      setHistory((prev) => BasicSchemaManager.commit(prev, nextSchema));
    },
    []
  );

  const setHistoryForCanvas = useMemo<React.Dispatch<React.SetStateAction<HistoryState>>>(() => {
    return (action) => {
      setHistory((prev) => {
        const next = typeof action === "function" ? (action as (p: HistoryState) => HistoryState)(prev) : action;
        const didCommit = next.past.length !== prev.past.length;
        if (didCommit) {
          pendingRef.current = { persist: true, sync: true, pagePath: entryPagePathRef.current };
        }
        return next;
      });
    };
  }, []);

  return {
    history,
    schemaRef,
    entryPagePathRef,
    setHistory,
    setHistoryForCanvas,
    commitSchema,
    initializeFromCode,
  };
}
