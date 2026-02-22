export type BuilderComponentType =
  | "div"
  | "button"
  | "heading"
  | "paragraph"
  | "text"
  | "input"
  | "image"
  | "link";

export type BuilderProps = Record<string, unknown> & {
  className?: string;
  text?: string;
  href?: string;
  src?: string;
  alt?: string;
  placeholder?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};

export type LayoutBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Constraints = {
  pinLeft?: boolean;
  pinRight?: boolean;
  pinTop?: boolean;
  pinBottom?: boolean;
  centerX?: boolean;
  centerY?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
};

export type BuilderNode = {
  id: string;
  name: string;
  type: BuilderComponentType;
  props: BuilderProps;
  layout: LayoutBox;
  constraints?: Constraints;
  children: BuilderNode[];
};

export type UISchema = {
  version: 1;
  root: BuilderNode;
  selectedId?: string | null;
};

export function generateId(prefix: string = "node"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySchema(): UISchema {
  return {
    version: 1,
    root: {
      id: generateId("root"),
      name: "Root",
      type: "div",
      props: { className: "min-h-screen p-8" },
      layout: { x: 40, y: 40, w: 960, h: 640 },
      children: [],
    },
    selectedId: null,
  };
}

export function findNode(root: BuilderNode, id: string): BuilderNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function mapNodes(root: BuilderNode, fn: (node: BuilderNode) => BuilderNode): BuilderNode {
  const next = fn({ ...root, children: root.children.map((c) => mapNodes(c, fn)) });
  return next;
}
