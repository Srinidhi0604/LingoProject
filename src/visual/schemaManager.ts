import type { HistoryState } from "@/builder/history";
import { createHistory, pushHistory } from "@/builder/history";
import type { UISchema } from "@/builder/schema";

export type SchemaManager = {
  create: (schema: UISchema) => HistoryState;
  commit: (state: HistoryState, nextSchema: UISchema) => HistoryState;
  commitIfChanged: (state: HistoryState, nextSchema: UISchema) => HistoryState;
};

export const BasicSchemaManager: SchemaManager = {
  create(schema) {
    return createHistory(schema);
  },
  commit(state, nextSchema) {
    return pushHistory(state, nextSchema);
  },
  commitIfChanged(state, nextSchema) {
    if (state.present === nextSchema) return state;
    return pushHistory(state, nextSchema);
  },
};
