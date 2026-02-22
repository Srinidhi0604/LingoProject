import { createEmptySchema, type UISchema } from "@/builder/schema";
import { parsePageToSchema } from "@/builder/jsxSync";
import { parseWorkspacePageToSchemaDeep } from "@/visual/deepTsxParser";

export type DOMParserLayer = {
  parseTsxToSchema: (code: string) => UISchema;
  parseWorkspacePageToSchema: (pagePath: string, getFile: (p: string) => { path: string; content: string } | null) => UISchema;
};

export const BasicTsxParserLayer: DOMParserLayer = {
  parseTsxToSchema(code: string): UISchema {
    try {
      const parsed = parsePageToSchema(code);
      if (parsed?.schema?.root) return parsed.schema;
      return createEmptySchema();
    } catch {
      return createEmptySchema();
    }
  },
  parseWorkspacePageToSchema(pagePath, getFile) {
    return parseWorkspacePageToSchemaDeep(pagePath, getFile);
  },
};
