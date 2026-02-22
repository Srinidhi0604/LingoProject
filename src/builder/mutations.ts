import { BuilderNode, LayoutBox, UISchema, findNode, generateId, mapNodes } from "./schema";

export function select(schema: UISchema, id: string | null): UISchema {
  return { ...schema, selectedId: id };
}

export function addChild(schema: UISchema, parentId: string, node: Omit<BuilderNode, "id">): UISchema {
  const id = generateId(node.type);
  const newNode: BuilderNode = { ...node, id };
  const nextRoot = mapNodes(schema.root, (n) => {
    if (n.id !== parentId) return n;
    return { ...n, children: [...n.children, newNode] };
  });
  return { ...schema, root: nextRoot, selectedId: id };
}

export function updateLayout(schema: UISchema, id: string, layout: Partial<LayoutBox>): UISchema {
  const nextRoot = mapNodes(schema.root, (n) => {
    if (n.id !== id) return n;
    return { ...n, layout: { ...n.layout, ...layout } };
  });
  return { ...schema, root: nextRoot };
}

export function updateProps(schema: UISchema, id: string, props: Record<string, unknown>): UISchema {
  const nextRoot = mapNodes(schema.root, (n) => {
    if (n.id !== id) return n;
    return { ...n, props: { ...n.props, ...props } };
  });
  return { ...schema, root: nextRoot };
}

export function removeNode(schema: UISchema, id: string): UISchema {
  if (schema.root.id === id) return schema;
  const removeRec = (n: BuilderNode): BuilderNode => {
    const children = n.children
      .filter((c) => c.id !== id)
      .map((c) => removeRec(c));
    return { ...n, children };
  };
  const nextRoot = removeRec(schema.root);
  const nextSelected = schema.selectedId === id ? null : schema.selectedId;
  return { ...schema, root: nextRoot, selectedId: nextSelected };
}

export function getSelectedNode(schema: UISchema): BuilderNode | null {
  const id = schema.selectedId;
  if (!id) return null;
  return findNode(schema.root, id);
}
