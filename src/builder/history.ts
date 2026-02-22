import { UISchema } from "./schema";

export type HistoryState = {
  past: UISchema[];
  present: UISchema;
  future: UISchema[];
};

export function createHistory(initial: UISchema): HistoryState {
  return { past: [], present: initial, future: [] };
}

export function pushHistory(state: HistoryState, next: UISchema, limit: number = 50): HistoryState {
  const past = [...state.past, state.present];
  const trimmed = past.length > limit ? past.slice(past.length - limit) : past;
  return { past: trimmed, present: next, future: [] };
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const prev = state.past[state.past.length - 1];
  const past = state.past.slice(0, -1);
  return { past, present: prev, future: [state.present, ...state.future] };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const future = state.future.slice(1);
  return { past: [...state.past, state.present], present: next, future };
}
